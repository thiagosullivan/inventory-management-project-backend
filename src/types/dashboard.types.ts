export interface DashboardOverviewResponse {
  summary: {
    totalProducts: number;
    totalUnits: number;
    totalMovements: number;
    movementsPeriod: string;
  };
  alerts: {
    lowStock: number;
    outOfStock: number;
    expired: number;
    expiringSoon: number;
    activeAlerts: number;
  };
  ratios: {
    stockOccupancyRate: number;
    activeProducts: number;
    activeProductsPercentage: number;
  };
  topItems: {
    lowestQuantityProducts: {
      id: string;
      name: string;
      sku: string | null;
      quantity: number;
    }[];
    highestQuantityProducts: {
      id: string;
      name: string;
      sku: string | null;
      quantity: number;
    }[];
    categoryDistribution: {
      category: string;
      count: number;
    }[];
  };
  trends: {
    dailyMovements: {
      date: string;
      entries: number;
      exits: number;
    }[];
  };
}

export interface DashboardOverviewFilters {
  periodDays?: number; // Padrão: 30
  trendDays?: number; // Padrão:
}

// /dashboard/stock
export interface StockMetricsResponse {
  summary: {
    totalProducts: number;
    totalUnits: number;
    averageStockPerProduct: number;
    productsWithStock: number;
    productsWithoutStock: number;
  };
  stockStatus: {
    healthy: number; // quantity > minStock
    low: number; // quantity <= minStock && quantity > 0
    outOfStock: number; // quantity === 0
    overStock: number; // quantity >= maxStock (se maxStock definido)
    noMinStockDefined: number; // produtos sem minStock definido
  };
  expiryStatus: {
    expired: number;
    expiringSoon: number; // 30 dias
    valid: number;
    noExpiryDate: number;
  };
  distribution: {
    byCategory: {
      category: string;
      count: number;
      totalUnits: number;
    }[];
    byLocation: {
      location: string;
      count: number;
      totalUnits: number;
    }[];
    bySupplier: {
      supplier: string;
      count: number;
      totalUnits: number;
    }[];
  };
  details: {
    productsWithLowStock: {
      id: string;
      name: string;
      sku: string | null;
      quantity: number;
      minStock: number | null;
      location: string | null;
      supplier: string | null;
      expiryDate: Date | null;
    }[];
    productsExpiringSoon: {
      id: string;
      name: string;
      sku: string | null;
      quantity: number;
      expiryDate: Date;
      location: string | null;
      supplier: string | null;
    }[];
    productsOutOfStock: {
      id: string;
      name: string;
      sku: string | null;
      location: string | null;
      supplier: string | null;
    }[];
  };
}

export interface StockMetricsFilters {
  limit?: number; // Para listagens detalhadas (padrão: 10)
  category?: string; // Filtrar por categoria
  location?: string; // Filtrar por localização
  supplier?: string; // Filtrar por fornecedor
}
