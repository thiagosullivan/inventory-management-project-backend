// src/types/sector.types.ts

// Dados para criar um setor (only MANAGER)
export interface CreateSectorData {
  name: string;
  description?: string;
  isWarehouse?: boolean; // 🔹 só 1 pode ser true no sistema
  isActive?: boolean;
}

// Dados para atualizar um setor (only MANAGER)
// 🔹 isWarehouse NÃO está aqui de propósito (é imutável)
export interface UpdateSectorData {
  name?: string;
  description?: string;
  isActive?: boolean;
}

// Resposta da API para setor
export interface SectorResponse {
  id: string;
  name: string;
  description: string | null;
  isWarehouse: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    users: number;
    transfersFrom: number;
    transfersTo: number;
    purchaseRequests: number;
  };
}

// Lista de setores (sem paginação — volume baixo)
export interface SectorsListResponse {
  sectors: SectorResponse[];
  total: number;
}

// Filtros para listagem
export interface SectorFilters {
  search?: string;
  isWarehouse?: boolean;
  isActive?: boolean;
}

// 🔹 Tipo do /options
export interface SectorOption {
  label: string;
  value: string;
  isWarehouse: boolean;
}
