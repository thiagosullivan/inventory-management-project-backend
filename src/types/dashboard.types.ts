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

// /dashboard/activity
export interface ActivityMetricsResponse {
  summary: {
    totalMovements: number;
    totalEntries: number;
    totalExits: number;
    totalAdjustments: number;
    entriesExitsRatio: number;
    averageMovementsPerDay: number;
    periodDays: number;
  };
  byPeriod: {
    daily: {
      date: string;
      entries: number;
      exits: number;
      adjustments: number;
      total: number;
    }[];
    weekly: {
      week: string;
      entries: number;
      exits: number;
      adjustments: number;
      total: number;
    }[];
    monthly: {
      month: string;
      entries: number;
      exits: number;
      adjustments: number;
      total: number;
    }[];
  };
  byUser: {
    topUsers: {
      userId: string;
      name: string | null;
      email: string;
      role: string;
      totalMovements: number;
      entries: number;
      exits: number;
      adjustments: number;
      lastActivity: Date | null;
    }[];
    summary: {
      activeUsers: number;
      totalUsers: number;
      averageMovementsPerUser: number;
      mostActiveUser: string | null;
      mostActiveUserCount: number;
    };
  };
  byProduct: {
    mostMovedProducts: {
      productId: string;
      name: string;
      sku: string | null;
      totalMovements: number;
      entries: number;
      exits: number;
      currentQuantity: number;
    }[];
    leastMovedProducts: {
      productId: string;
      name: string;
      sku: string | null;
      totalMovements: number;
      currentQuantity: number;
      daysWithoutMovement: number;
    }[];
  };
  byReason: {
    reason: string;
    count: number;
    percentage: number;
  }[];
  trends: {
    hourlyDistribution: {
      hour: number;
      entries: number;
      exits: number;
      total: number;
    }[];
    weekdayDistribution: {
      day: string;
      dayOfWeek: number;
      entries: number;
      exits: number;
      total: number;
    }[];
    monthlySeasonality: {
      month: string;
      monthNumber: number;
      entries: number;
      exits: number;
      total: number;
    }[];
  };
}

export interface ActivityMetricsFilters {
  periodDays?: number; // Padrão: 30
  limit?: number; // Para listagens (padrão: 10)
  userId?: string; // Filtrar por usuário específico
  productId?: string; // Filtrar por produto específico
  type?: string; // Filtrar por tipo (ENTRADA, SAIDA, AJUSTE)
}

// /dashboard/alerts

export interface AlertsMetricsResponse {
  summary: {
    totalAlerts: number;
    resolvedAlerts: number;
    activeAlerts: number;
    resolutionRate: number;
    averageResolutionTimeHours: number;
    alertsByType: {
      type: string;
      count: number;
      percentage: number;
    }[];
  };
  activeAlerts: {
    lowStock: {
      count: number;
      products: {
        id: string;
        name: string;
        sku: string | null;
        quantity: number;
        minStock: number;
        location: string | null;
        supplier: string | null;
        createdAt: Date;
      }[];
    };
    outOfStock: {
      count: number;
      products: {
        id: string;
        name: string;
        sku: string | null;
        quantity: number;
        minStock: number;
        location: string | null;
        supplier: string | null;
        createdAt: Date;
      }[];
    };
    expiringSoon: {
      count: number;
      products: {
        id: string;
        name: string;
        sku: string | null;
        quantity: number;
        expiryDate: Date;
        location: string | null;
        supplier: string | null;
        createdAt: Date;
      }[];
    };
    expired: {
      count: number;
      products: {
        id: string;
        name: string;
        sku: string | null;
        quantity: number;
        expiryDate: Date;
        location: string | null;
        supplier: string | null;
        createdAt: Date;
      }[];
    };
  };
  history: {
    resolvedLast7Days: number;
    resolvedLast30Days: number;
    resolutionTrend: {
      date: string;
      resolved: number;
      created: number;
    }[];
    topProductsWithAlerts: {
      productId: string;
      name: string;
      sku: string | null;
      totalAlerts: number;
      resolvedAlerts: number;
      activeAlerts: number;
    }[];
  };
  byCategory: {
    category: string;
    alertCount: number;
    lowStock: number;
    expiringSoon: number;
    expired: number;
  }[];
  details: {
    recentAlerts: {
      id: string;
      productId: string;
      productName: string;
      productSku: string | null;
      alertType: string;
      message: string;
      isResolved: boolean;
      createdAt: Date;
      resolvedAt: Date | null;
      resolvedBy: {
        id: string;
        name: string | null;
        email: string;
      } | null;
    }[];
  };
}

export interface AlertsMetricsFilters {
  limit?: number; // Para listagens (padrão: 10)
  alertType?: string; // Filtrar por tipo (LOW_STOCK, EXPIRING_SOON, EXPIRED)
  isResolved?: boolean; // Filtrar por status de resolução
  productId?: string; // Filtrar por produto específico
  startDate?: string; // Data inicial para o histórico (ISO)
  endDate?: string; // Data final para o histórico (ISO)
}
