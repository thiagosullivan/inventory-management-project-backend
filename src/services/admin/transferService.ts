// src/services/admin/transferService.ts
import { prisma } from "../../lib/prisma.js";
import { sectorService } from "./sectorService.js";
import { productService } from "./productService.js";
import {
  CancelTransferData,
  CreateTransferData,
  TransferFilters,
  TransferResponse,
  TransfersListResponse,
} from "../../types/transfer.types.js";
import { Role } from "../../generated/prisma/enums.js";
import {
  MovementStatus,
  MovementType,
  PurchaseRequestStatus,
  TransferStatus as PrismaTransferStatus,
} from "../../generated/prisma/client.js";

// ============================================================
// HELPERS DE PERMISSÃO
// ============================================================

/**
 * 🔹 Verifica se o usuário pode CRIAR remessa:
 * - STAFF do Almoxarifado, OU
 * - MANAGER
 */
async function ensureCanCreateTransfer(
  userId: string,
  userSectorId: string,
  userRole: Role,
): Promise<string> {
  const almoxarifadoId = await sectorService.getAlmoxarifadoId();

  const isManager = userRole === Role.MANAGER;
  const isAlmoxarifadoStaff = userSectorId === almoxarifadoId;

  if (!isManager && !isAlmoxarifadoStaff) {
    throw new Error(
      "Apenas STAFF do Almoxarifado ou MANAGER podem criar remessas",
    );
  }

  return almoxarifadoId;
}

/**
 * 🔹 Verifica se o usuário pode CONFIRMAR/RECUSAR a Transfer:
 * - STAFF do setor destino, OU
 * - MANAGER
 */
function ensureCanConfirmOrRefuse(
  transferToSectorId: string,
  userSectorId: string,
  userRole: Role,
): void {
  const isManager = userRole === Role.MANAGER;
  const isDestinationStaff = userSectorId === transferToSectorId;

  if (!isManager && !isDestinationStaff) {
    throw new Error(
      "Apenas STAFF do setor destino ou MANAGER podem confirmar/recusar remessas",
    );
  }
}

/**
 * 🔹 Verifica se o usuário pode CANCELAR a Transfer:
 * - STAFF do Almoxarifado (fromSectorId), OU
 * - MANAGER
 */
function ensureCanCancel(
  transferFromSectorId: string,
  almoxarifadoId: string,
  userSectorId: string,
  userRole: Role,
): void {
  const isManager = userRole === Role.MANAGER;
  const isAlmoxarifadoStaff = userSectorId === almoxarifadoId;

  if (!isManager && !isAlmoxarifadoStaff) {
    throw new Error(
      "Apenas STAFF do Almoxarifado ou MANAGER podem cancelar remessas",
    );
  }

  // 🔹 Segurança extra: a Transfer só pode ser cancelada se fromSectorId = Almoxarifado
  if (transferFromSectorId !== almoxarifadoId) {
    throw new Error(
      "Apenas remessas originadas do Almoxarifado podem ser canceladas",
    );
  }
}

// ============================================================
// INCLUDE PADRÃO
// ============================================================

const transferInclude = {
  fromSector: { select: { id: true, name: true, isWarehouse: true } },
  toSector: { select: { id: true, name: true, isWarehouse: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  confirmedBy: { select: { id: true, name: true, email: true } },
  refusedBy: { select: { id: true, name: true, email: true } },
  cancelledBy: { select: { id: true, name: true, email: true } },
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          imageUrl: true,
          priceInCents: true,
        },
      },
    },
  },
} as const;

// ============================================================
// SERVICE
// ============================================================

export const transferService = {
  /**
   * Criar remessa (only STAFF do Almoxarifado ou MANAGER)
   * - fromSectorId forçado = Almoxarifado
   * - Debita Product.quantity
   * - Cria N Movement de TRANSFERENCIA (PENDENTE, quantity negativo)
   * - Cria N StockHistory (vinculados aos Movements)
   * - Se purchaseRequestId e pedido PENDENTE → muda pra EM_ATENDIMENTO
   * - Tudo em transação atômica
   * - checkStockAlerts dispara em TRANSFERENCIA (pós-commit)
   */
  async createTransfer(
    data: CreateTransferData,
    userId: string,
    userSectorId: string,
    userRole: Role,
  ): Promise<TransferResponse> {
    // ================================================
    // FASE 1 — VALIDAÇÕES (fora da transação)
    // ================================================

    // 1.1 — Permissão + pegar almoxarifadoId
    const almoxarifadoId = await ensureCanCreateTransfer(
      userId,
      userSectorId,
      userRole,
    );

    // 1.2 — toSectorId existe, ativo, e NÃO é Almoxarifado
    const toSector = await prisma.sector.findUnique({
      where: { id: data.toSectorId },
      select: { id: true, name: true, isWarehouse: true, isActive: true },
    });
    if (!toSector) {
      throw new Error("Setor destino não encontrado");
    }
    if (!toSector.isActive) {
      throw new Error("Setor destino está desativado");
    }
    if (toSector.isWarehouse) {
      throw new Error("Não é possível transferir para o Almoxarifado");
    }

    // 1.3 — items não vazio
    if (!data.items || data.items.length === 0) {
      throw new Error("Remessa deve ter pelo menos 1 item");
    }

    // 1.4 — Sem produto duplicado
    const productIds = data.items.map((i) => i.productId);
    const uniqueProductIds = new Set(productIds);
    if (uniqueProductIds.size !== productIds.length) {
      throw new Error(
        "Produto duplicado na remessa. Some as quantidades antes de enviar.",
      );
    }

    // 1.5 — Cada quantity > 0
    for (const item of data.items) {
      if (!item.productId) {
        throw new Error("Todos os itens devem ter productId");
      }
      if (!item.quantity || item.quantity <= 0) {
        throw new Error(
          `Quantidade inválida para o produto ${item.productId}: deve ser maior que zero`,
        );
      }
    }

    // 1.6 — purchaseRequestId? (se vier) é válido
    let purchaseRequest: {
      id: string;
      status: PurchaseRequestStatus;
      sectorId: string;
    } | null = null;
    if (data.purchaseRequestId) {
      purchaseRequest = await prisma.purchaseRequest.findUnique({
        where: { id: data.purchaseRequestId },
        select: { id: true, status: true, sectorId: true },
      });

      if (!purchaseRequest) {
        throw new Error("Pedido não encontrado");
      }

      if (
        purchaseRequest.status !== PurchaseRequestStatus.PENDENTE &&
        purchaseRequest.status !== PurchaseRequestStatus.EM_ATENDIMENTO
      ) {
        throw new Error(
          `Pedido não pode receber remessa (status atual: ${purchaseRequest.status})`,
        );
      }

      if (purchaseRequest.sectorId !== toSector.id) {
        throw new Error(
          `Pedido pertence a outro setor, não pode ser vinculado a uma remessa pra ${toSector.name}`,
        );
      }
    }

    // ================================================
    // FASE 2 — EXECUÇÃO (transação atômica)
    // ================================================

    const transfer = await prisma.$transaction(async (tx) => {
      // 2.1 — Criar Transfer (header) + TransferItems via nested create
      const createdTransfer = await tx.transfer.create({
        data: {
          fromSectorId: almoxarifadoId, // 🔹 forçado
          toSectorId: toSector.id,
          purchaseRequestId: data.purchaseRequestId ?? null,
          status: PrismaTransferStatus.PENDENTE,
          reason: data.reason?.trim() || null,
          createdById: userId,
          items: {
            create: data.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
          },
        },
      });

      // 2.2 — Para cada item: buscar produto, validar estoque, criar Movement + StockHistory, debitar Product.quantity
      for (const item of data.items) {
        // 2.2.1 — Buscar produto (estado atual)
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            quantity: true,
            avgPriceInCents: true,
          },
        });

        if (!product) {
          throw new Error(`Produto não encontrado: ${item.productId}`);
        }

        // 2.2.2 — Validar estoque (rollback se insuficiente)
        if (product.quantity < item.quantity) {
          throw new Error(
            `Estoque insuficiente para ${product.name}: disponível ${product.quantity}, solicitado ${item.quantity}`,
          );
        }

        // 2.2.3 — Criar Movement de TRANSFERENCIA (PENDENTE, quantity NEGATIVO)
        const movement = await tx.movement.create({
          data: {
            productId: item.productId,
            type: MovementType.TRANSFERENCIA,
            quantity: -item.quantity, // 🔹 negativo
            reason: `Remessa ${createdTransfer.id} — ${toSector.name}`,
            status: MovementStatus.PENDENTE,
            fromSectorId: almoxarifadoId,
            toSectorId: toSector.id,
            transferId: createdTransfer.id,
            unitPriceInCents: product.avgPriceInCents, // 🔹 herda a média
            createdById: userId,
          },
        });

        // 2.2.4 — Debitar Product.quantity
        const newQuantity = product.quantity - item.quantity;
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: newQuantity },
        });

        // 2.2.5 — StockHistory vinculado ao Movement
        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            oldQuantity: product.quantity,
            newQuantity,
            movementId: movement.id,
            changedById: userId,
            reason: `Remessa ${createdTransfer.id} — ${toSector.name}`,
          },
        });
      }

      // 2.3 — Se purchaseRequestId e pedido PENDENTE → EM_ATENDIMENTO
      if (
        purchaseRequest &&
        purchaseRequest.status === PurchaseRequestStatus.PENDENTE
      ) {
        await tx.purchaseRequest.update({
          where: { id: purchaseRequest.id },
          data: { status: PurchaseRequestStatus.EM_ATENDIMENTO },
        });
      }

      // 2.4 — Retornar com include
      return tx.transfer.findUnique({
        where: { id: createdTransfer.id },
        include: transferInclude,
      });
    });

    if (!transfer) {
      throw new Error("Erro ao criar remessa");
    }

    // 🔹 NOVO — Fase 6: disparar checkStockAlerts em TRANSFERENCIA
    // (fora da transação, depois que commitou)
    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { quantity: true, minStock: true, expiryDate: true },
      });
      if (product) {
        await productService.checkStockAlerts(
          item.productId,
          product.quantity,
          product.minStock,
          product.expiryDate,
        );
      }
    }

    return transfer;
  },

  /**
   * Listar remessas (filtrada por setor do user)
   * - Almoxarifado vê todas
   * - Outros setores veem só as endereçadas a eles (toSectorId)
   * - MANAGER vê todas
   */
  async listTransfers(
    filters: TransferFilters | undefined,
    userSectorId: string,
    userRole: Role,
  ): Promise<TransfersListResponse> {
    const almoxarifadoId = await sectorService.getAlmoxarifadoId();

    const isManager = userRole === Role.MANAGER;
    const isAlmoxarifadoStaff = userSectorId === almoxarifadoId;

    const where: any = {};

    // 🔹 Filtro de visibilidade por setor
    if (!isManager && !isAlmoxarifadoStaff) {
      // Setor comum só vê as remessas endereçadas a ele
      where.toSectorId = userSectorId;
    }

    // Filtros explícitos (sobrescrevem a visibilidade só se o user pode ver)
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.fromSectorId) {
      where.fromSectorId = filters.fromSectorId;
    }
    if (filters?.toSectorId) {
      where.toSectorId = filters.toSectorId;
    }
    if (filters?.purchaseRequestId) {
      where.purchaseRequestId = filters.purchaseRequestId;
    }
    if (filters?.createdById) {
      where.createdById = filters.createdById;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = filters?.sortBy || "createdAt";
    const sortOrder = filters?.sortOrder || "desc";

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        include: transferInclude,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.transfer.count({ where }),
    ]);

    return {
      transfers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Buscar remessa por ID (detalhe)
   * Mesma regra de visibilidade da listagem
   */
  async getTransferById(
    transferId: string,
    userSectorId: string,
    userRole: Role,
  ): Promise<TransferResponse | null> {
    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
      include: transferInclude,
    });

    if (!transfer) return null;

    const almoxarifadoId = await sectorService.getAlmoxarifadoId();
    const isManager = userRole === Role.MANAGER;
    const isAlmoxarifadoStaff = userSectorId === almoxarifadoId;

    // Setor comum só vê se for o destino
    if (
      !isManager &&
      !isAlmoxarifadoStaff &&
      transfer.toSectorId !== userSectorId
    ) {
      throw new Error("Você não tem permissão para visualizar esta remessa");
    }

    return transfer;
  },

  /**
   * Confirmar remessa (STAFF do destino ou MANAGER)
   * - Transfer.status = CONCLUIDO
   * - Movement.status = CONCLUIDO (todos os vinculados)
   * - Nada muda no estoque (já saiu na criação)
   */
  async confirmTransfer(
    transferId: string,
    userId: string,
    userSectorId: string,
    userRole: Role,
  ): Promise<TransferResponse> {
    // Buscar transfer
    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
      select: { id: true, status: true, toSectorId: true, fromSectorId: true },
    });

    if (!transfer) {
      throw new Error("Remessa não encontrada");
    }

    // Permissão
    ensureCanConfirmOrRefuse(transfer.toSectorId, userSectorId, userRole);

    // Só confirma se estiver PENDENTE
    if (transfer.status !== PrismaTransferStatus.PENDENTE) {
      throw new Error(
        `Remessa não pode ser confirmada (status atual: ${transfer.status})`,
      );
    }

    // Transação: Transfer + N Movements
    const updated = await prisma.$transaction(async (tx) => {
      await tx.transfer.update({
        where: { id: transferId },
        data: {
          status: PrismaTransferStatus.CONCLUIDO,
          confirmedById: userId,
          confirmedAt: new Date(),
        },
      });

      await tx.movement.updateMany({
        where: { transferId },
        data: { status: MovementStatus.CONCLUIDO },
      });

      return tx.transfer.findUnique({
        where: { id: transferId },
        include: transferInclude,
      });
    });

    if (!updated) {
      throw new Error("Erro ao confirmar remessa");
    }

    return updated;
  },

  /**
   * Recusar remessa (STAFF do destino ou MANAGER)
   * - Transfer.status = RECUSADO
   * - Movement.status = CANCELADO (todos os vinculados)
   * - Devolve estoque ao Almoxarifado (Product.quantity += qtd)
   * - Cria N StockHistory de devolução
   * - checkStockAlerts re-checado (estoque voltou)
   */
  async refuseTransfer(
    transferId: string,
    userId: string,
    userSectorId: string,
    userRole: Role,
  ): Promise<TransferResponse> {
    // Buscar transfer com items
    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
      select: {
        id: true,
        status: true,
        toSectorId: true,
        fromSectorId: true,
        items: { select: { productId: true, quantity: true } },
      },
    });

    if (!transfer) {
      throw new Error("Remessa não encontrada");
    }

    // Permissão
    ensureCanConfirmOrRefuse(transfer.toSectorId, userSectorId, userRole);

    // Só recusa se estiver PENDENTE
    if (transfer.status !== PrismaTransferStatus.PENDENTE) {
      throw new Error(
        `Remessa não pode ser recusada (status atual: ${transfer.status})`,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Transfer → RECUSADO
      await tx.transfer.update({
        where: { id: transferId },
        data: {
          status: PrismaTransferStatus.RECUSADO,
          refusedById: userId,
          refusedAt: new Date(),
        },
      });

      // 2. Movements → CANCELADO
      await tx.movement.updateMany({
        where: { transferId },
        data: { status: MovementStatus.CANCELADO },
      });

      // 3. Devolver estoque + StockHistory por item
      for (const item of transfer.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, quantity: true },
        });
        if (!product) {
          throw new Error(`Produto não encontrado: ${item.productId}`);
        }

        const newQuantity = product.quantity + item.quantity;

        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: newQuantity },
        });

        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            oldQuantity: product.quantity,
            newQuantity,
            changedById: userId,
            reason: `Devolução (recusa da remessa ${transferId})`,
          },
        });
      }

      return tx.transfer.findUnique({
        where: { id: transferId },
        include: transferInclude,
      });
    });

    if (!updated) {
      throw new Error("Erro ao recusar remessa");
    }

    // 🔹 NOVO — re-checar alertas (estoque voltou)
    for (const item of transfer.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { quantity: true, minStock: true, expiryDate: true },
      });
      if (product) {
        await productService.checkStockAlerts(
          item.productId,
          product.quantity,
          product.minStock,
          product.expiryDate,
        );
      }
    }

    return updated;
  },

  /**
   * Cancelar remessa (STAFF do Almoxarifado ou MANAGER, só PENDENTE)
   * - cancelReason obrigatório
   * - Transfer.status = CANCELADO
   * - Movement.status = CANCELADO
   * - Devolve estoque
   * - checkStockAlerts re-checado (estoque voltou)
   */
  async cancelTransfer(
    transferId: string,
    data: CancelTransferData,
    userId: string,
    userSectorId: string,
    userRole: Role,
  ): Promise<TransferResponse> {
    // 1. cancelReason obrigatório
    const cancelReason = data.cancelReason?.trim();
    if (!cancelReason) {
      throw new Error("Motivo do cancelamento é obrigatório");
    }

    // 2. Buscar transfer
    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
      select: {
        id: true,
        status: true,
        toSectorId: true,
        fromSectorId: true,
        items: { select: { productId: true, quantity: true } },
      },
    });

    if (!transfer) {
      throw new Error("Remessa não encontrada");
    }

    // 3. Permissão
    const almoxarifadoId = await sectorService.getAlmoxarifadoId();
    ensureCanCancel(
      transfer.fromSectorId,
      almoxarifadoId,
      userSectorId,
      userRole,
    );

    // 4. Só cancela se PENDENTE
    if (transfer.status !== PrismaTransferStatus.PENDENTE) {
      throw new Error(
        `Remessa não pode ser cancelada (status atual: ${transfer.status})`,
      );
    }

    // 5. Transação
    const updated = await prisma.$transaction(async (tx) => {
      await tx.transfer.update({
        where: { id: transferId },
        data: {
          status: PrismaTransferStatus.CANCELADO,
          cancelReason,
          cancelledById: userId,
          cancelledAt: new Date(),
        },
      });

      await tx.movement.updateMany({
        where: { transferId },
        data: { status: MovementStatus.CANCELADO },
      });

      for (const item of transfer.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, quantity: true },
        });
        if (!product) {
          throw new Error(`Produto não encontrado: ${item.productId}`);
        }

        const newQuantity = product.quantity + item.quantity;

        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: newQuantity },
        });

        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            oldQuantity: product.quantity,
            newQuantity,
            changedById: userId,
            reason: `Devolução (cancelamento da remessa ${transferId}): ${cancelReason}`,
          },
        });
      }

      return tx.transfer.findUnique({
        where: { id: transferId },
        include: transferInclude,
      });
    });

    if (!updated) {
      throw new Error("Erro ao cancelar remessa");
    }

    // 🔹 NOVO — re-checar alertas (estoque voltou)
    for (const item of transfer.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { quantity: true, minStock: true, expiryDate: true },
      });
      if (product) {
        await productService.checkStockAlerts(
          item.productId,
          product.quantity,
          product.minStock,
          product.expiryDate,
        );
      }
    }

    return updated;
  },
};
