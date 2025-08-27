// Typ strategii w bazie
export interface Strategy {
    id: string;
    userId: string;
    name: string;
    description?: string;
    type: string;
    config: any; // można dać Record<string, any> albo zdefiniować dokładniej
    createdAt: Date;
    updatedAt: Date;
}

// DTO do tworzenia/edycji
export interface CreateStrategyDto {
    name: string;
    description?: string;
    interval: string;
    leverage: number;
    walletRisk: number;
    config: any;
}