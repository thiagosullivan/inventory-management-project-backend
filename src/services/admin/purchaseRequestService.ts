// src/services/admin/purchaseRequestService.ts
import { prisma } from "../../lib/prisma.js";
import { sectorService } from "./sectorService.js";
import {
  CatalogProduct,
  CreatePurchaseRequestData,
  FinalizePurchaseRequestData,
  PurchaseRequestFilters,
  PurchaseRequestResponse,
  PurchaseRequestStatus,
  PurchaseRequestsListResponse,
  RefusePurchaseRequestData,
} from "../../types/purchaseRequest.types.js";
import { Role } from "../../generated/prisma/enums.js";
import {
  PurchaseRequestStatus as PrismaPurchaseRequestStatus,
  TransferStatus as PrismaTransferStatus,
} from "../../generated/prisma/client.js";

// ============================================================
// INCLUDE PADRÃO
// ============================================================

const requestInclude = {
  sector: { select: { id: true, name: true, isWarehouse: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  finalizedBy: { select: { id: true, name: true, email: true } },
  refusedBy: { select: { id: true, name: true, email: true } },
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
  transfers: {
    select: {
      id: true,
      status: true,
      createdAt: true,
      confirmedAt: true,
      refusedAt: true,
      cancelledAt: true,
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  _count: { select: { items: true, transfers: true } },
} as const;

// ============================================================
// HELPERS
// ============================================================

/**
 * 🔹 Soma a quantidade total pedida no PurchaseRequest
 */
async function sumRequestedQuantity(
  tx: any,
  requestId: string,
): Promise<number> {
  const items = await tx.purchaseRequestItem.findMany({
    where: { requestId },
    select: { quantity: true },
  });
  return items.reduce(
    (sum: number, i: { quantity: number }) => sum + i.quantity,
    0,
  );
}

/**
 * 🔹 Soma a quantidade total enviada em Transfers CONCLUIDO vinculadas
 */
async function sumConfirmedTransferQuantity(
  tx: any,
  requestId: string,
): Promise<number> {
  const transfers = await tx.transfer.findMany({
    where: {
      purchaseRequestId: requestId,
      status: PrismaTransferStatus.CONCLUIDO,
    },
    select: {
      items: { select: { quantity: true } },
    },
  });
  return transfers.reduce(
    (sum: number, t: { items: { quantity: number }[] }) =>
      sum +
      t.items.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0),
    0,
  );
}

// ============================================================
// SERVICE
// ============================================================

export const purchaseRequestService = {
  /**
   * Criar pedido (STAFF do setor não-Almoxarifado ou MANAGER)
   * - Setor do pedido = setor do user
   * - Items = produtos cadastrados (quantity > 0)
   * - notes = textarea livre (itens não cadastrados)
   */
  async createPurchaseRequest(
    data: CreatePurchaseRequestData,
    userId: string,
    userSectorId: string,
    userRole: Role,
  ): Promise<PurchaseRequestResponse> {
    // 1. Permissão: STAFF do setor não-Almoxarifado ou MANAGER
    const almoxarifadoId = await sectorService.getAlmoxarifadoId();
    const isManager = userRole === Role.MANAGER;
    const isAlmoxarifadoStaff = userSectorId === almoxarifadoId;

    if (isAlmoxarifadoStaff && !isManager) {
      throw new Error(
        "O Almoxarifado não cria pedidos. Use remessas pra atender os pedidos dos outros setores.",
      );
    }

    // 2. Validações
    if (!data.items || data.items.length === 0) {
      throw new Error("Pedido deve ter pelo menos 1 item cadastrado");
    }

    // Sem produto duplicado
    const productIds = data.items.map((i) => i.productId);
    const uniqueProductIds = new Set(productIds);
    if (uniqueProductIds.size !== productIds.length) {
      throw new Error(
        "Produto duplicado no pedido. Some as quantidades antes de enviar.",
      );
    }

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

    // 3. Validar que todos os produtos existem (1 query)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      throw new Error(`Produto(s) não encontrado(s): ${missing.join(", ")}`);
    }

    // 4. Criar (transação + nested create)
    const request = await prisma.purchaseRequest.create({
      data: {
        sectorId: userSectorId,
        status: PrismaPurchaseRequestStatus.PENDENTE,
        notes: data.notes?.trim() || null,
        createdById: userId,
        items: {
          create: data.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        },
      },
      include: requestInclude,
    });

    return request;
  },

  /**
   * Listar pedidos (filtrada por setor do user)
   * - Almoxarifado/MANAGER veem todos
   * - Outros setores veem só os do próprio setor
   */
  async listPurchaseRequests(
    filters: PurchaseRequestFilters | undefined,
    userSectorId: string,
    userRole: Role,
  ): Promise<PurchaseRequestsListResponse> {
    const almoxarifadoId = await sectorService.getAlmoxarifadoId();
    const isManager = userRole === Role.MANAGER;
    const isAlmoxarifadoStaff = userSectorId === almoxarifadoId;

    const where: any = {};

    // Visibilidade por setor
    if (!isManager && !isAlmoxarifadoStaff) {
      where.sectorId = userSectorId;
    }

    // Filtros explícitos
    if (filters?.sectorId) where.sectorId = filters.sectorId;
    if (filters?.status) where.status = filters.status;

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

    const [requests, total] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        include: requestInclude,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.purchaseRequest.count({ where }),
    ]);

    return {
      requests,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Buscar pedido por ID (detalhe)
   */
  async getPurchaseRequestById(
    requestId: string,
    userSectorId: string,
    userRole: Role,
  ): Promise<PurchaseRequestResponse | null> {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      include: requestInclude,
    });

    if (!request) return null;

    const almoxarifadoId = await sectorService.getAlmoxarifadoId();
    const isManager = userRole === Role.MANAGER;
    const isAlmoxarifadoStaff = userSectorId === almoxarifadoId;

    if (
      !isManager &&
      !isAlmoxarifadoStaff &&
      request.sectorId !== userSectorId
    ) {
      throw new Error("Você não tem permissão para visualizar este pedido");
    }

    return request;
  },

  /**
   * Recusar pedido (Almoxarifado STAFF ou MANAGER)
   * - refusalReason obrigatório
   * - Final (não reabre)
   */
  async refusePurchaseRequest(
    requestId: string,
    data: RefusePurchaseRequestData,
    userId: string,
    userSectorId: string,
    userRole: Role,
  ): Promise<PurchaseRequestResponse> {
    // 1. refusalReason obrigatório
    const refusalReason = data.refusalReason?.trim();
    if (!refusalReason) {
      throw new Error("Motivo da recusa é obrigatório");
    }

    // 2. Permissão: STAFF do Almoxarifado ou MANAGER
    const almoxarifadoId = await sectorService.getAlmoxarifadoId();
    const isManager = userRole === Role.MANAGER;
    const isAlmoxarifadoStaff = userSectorId === almoxarifadoId;

    if (!isManager && !isAlmoxarifadoStaff) {
      throw new Error(
        "Apenas STAFF do Almoxarifado ou MANAGER podem recusar pedidos",
      );
    }

    // 3. Buscar pedido
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true },
    });
    if (!request) {
      throw new Error("Pedido não encontrado");
    }

    // 4. Só recusa se PENDENTE ou EM_ATENDIMENTO
    if (
      request.status !== PrismaPurchaseRequestStatus.PENDENTE &&
      request.status !== PrismaPurchaseRequestStatus.EM_ATENDIMENTO
    ) {
      throw new Error(
        `Pedido não pode ser recusado (status atual: ${request.status})`,
      );
    }

    // 5. Atualizar
    const updated = await prisma.purchaseRequest.update({
      where: { id: requestId },
      data: {
        status: PrismaPurchaseRequestStatus.RECUSADO,
        refusalReason,
        refusedById: userId,
        refusedAt: new Date(),
      },
      include: requestInclude,
    });

    return updated;
  },

  /**
   * Finalizar pedido (Almoxarifado STAFF ou MANAGER)
   * - Regra X: nenhuma Transfer vinculada PENDENTE
   * - finalizeNote obrigatório se:
   *   (3a) houver Transfer RECUSADO/CANCELADO vinculada, OU
   *   (3b) soma enviada (CONCLUIDO) < soma pedida
   */
  async finalizePurchaseRequest(
    requestId: string,
    data: FinalizePurchaseRequestData,
    userId: string,
    userSectorId: string,
    userRole: Role,
  ): Promise<PurchaseRequestResponse> {
    const finalizeNote = data.finalizeNote?.trim() || null;

    // 1. Permissão: STAFF do Almoxarifado ou MANAGER
    const almoxarifadoId = await sectorService.getAlmoxarifadoId();
    const isManager = userRole === Role.MANAGER;
    const isAlmoxarifadoStaff = userSectorId === almoxarifadoId;

    if (!isManager && !isAlmoxarifadoStaff) {
      throw new Error(
        "Apenas STAFF do Almoxarifado ou MANAGER podem finalizar pedidos",
      );
    }

    // 2. Buscar pedido
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true },
    });
    if (!request) {
      throw new Error("Pedido não encontrado");
    }

    // 3. Só finaliza se EM_ATENDIMENTO
    if (request.status !== PrismaPurchaseRequestStatus.EM_ATENDIMENTO) {
      throw new Error(
        `Pedido não pode ser finalizado (status atual: ${request.status}). Apenas pedidos EM_ATENDIMENTO podem ser finalizados.`,
      );
    }

    // 4. Trava: nenhuma Transfer PENDENTE
    const pendingCount = await prisma.transfer.count({
      where: {
        purchaseRequestId: requestId,
        status: PrismaTransferStatus.PENDENTE,
      },
    });
    if (pendingCount > 0) {
      throw new Error(
        `Existem ${pendingCount} remessa(s) pendente(s). Confirme ou recuse antes de finalizar.`,
      );
    }

    // 5. Regras 3a e 3b
    const hasRejectedOrCancelled =
      (await prisma.transfer.count({
        where: {
          purchaseRequestId: requestId,
          status: {
            in: [PrismaTransferStatus.RECUSADO, PrismaTransferStatus.CANCELADO],
          },
        },
      })) > 0;

    const totalPedido = await sumRequestedQuantity(prisma, requestId);
    const totalEnviado = await sumConfirmedTransferQuantity(prisma, requestId);
    const hasIncompleteDelivery = totalEnviado < totalPedido;

    const needsFinalizeNote = hasRejectedOrCancelled || hasIncompleteDelivery;

    if (needsFinalizeNote && !finalizeNote) {
      const reasons: string[] = [];
      if (hasRejectedOrCancelled) reasons.push("remessa recusada/cancelada");
      if (hasIncompleteDelivery)
        reasons.push(
          `entrega incompleta (enviado ${totalEnviado} de ${totalPedido})`,
        );
      throw new Error(
        `Justificativa obrigatória: o pedido tem ${reasons.join(" e ")}.`,
      );
    }

    // 6. Finalizar
    const updated = await prisma.purchaseRequest.update({
      where: { id: requestId },
      data: {
        status: PrismaPurchaseRequestStatus.ATENDIDO,
        finalizedById: userId,
        finalizedAt: new Date(),
        finalizeNote,
      },
      include: requestInclude,
    });

    return updated;
  },

  /**
   * Cancelar pedido (só setor criador ou MANAGER)
   * - Encerra na hora → CANCELADO
   * - Só enquanto não foi ATENDIDO/RECUSADO
   */
  async cancelPurchaseRequest(
    requestId: string,
    userId: string,
    userSectorId: string,
    userRole: Role,
  ): Promise<PurchaseRequestResponse> {
    // 1. Buscar pedido
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true, sectorId: true },
    });
    if (!request) {
      throw new Error("Pedido não encontrado");
    }

    // 2. Permissão: setor criador ou MANAGER
    const isManager = userRole === Role.MANAGER;
    const isCreatorSector = userSectorId === request.sectorId;

    if (!isManager && !isCreatorSector) {
      throw new Error(
        "Apenas o setor criador do pedido ou MANAGER podem cancelá-lo",
      );
    }

    // 3. Só cancela se PENDENTE ou EM_ATENDIMENTO
    if (
      request.status !== PrismaPurchaseRequestStatus.PENDENTE &&
      request.status !== PrismaPurchaseRequestStatus.EM_ATENDIMENTO
    ) {
      throw new Error(
        `Pedido não pode ser cancelado (status atual: ${request.status})`,
      );
    }

    // 4. Cancelar
    const updated = await prisma.purchaseRequest.update({
      where: { id: requestId },
      data: {
        status: PrismaPurchaseRequestStatus.CANCELADO,
      },
      include: requestInclude,
    });

    return updated;
  },

  /**
   * Catálogo de produtos pro setor escolher (STAFF + MANAGER)
   * - Produtos do Almoxarifado (todos — não existe StockBySector)
   * - SEM quantity (só isOutOfStock)
   * - isOutOfStock = Product.quantity === 0
   */
  async getCatalog(): Promise<CatalogProduct[]> {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        imageUrl: true,
        priceInCents: true,
        quantity: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      imageUrl: p.imageUrl,
      priceInCents: p.priceInCents,
      isOutOfStock: p.quantity === 0,
      category: p.category,
    }));
  },
};
