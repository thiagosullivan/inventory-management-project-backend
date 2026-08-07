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
  trendDays?: number; // Padrão: 7
}
