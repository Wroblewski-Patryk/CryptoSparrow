export type BotMode = "PAPER" | "LIVE" | "LOCAL";
export type TradeMarket = "FUTURES" | "SPOT";
export type PositionMode = "ONE_WAY" | "HEDGE";

export type Bot = {
  id: string;
  name: string;
  mode: BotMode;
  marketType: TradeMarket;
  positionMode: PositionMode;
  isActive: boolean;
  liveOptIn: boolean;
  consentTextVersion?: string | null;
  maxOpenPositions: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateBotInput = {
  name: string;
  mode: BotMode;
  marketType: TradeMarket;
  positionMode: PositionMode;
  isActive: boolean;
  liveOptIn: boolean;
  consentTextVersion?: string | null;
  maxOpenPositions: number;
};

export type UpdateBotInput = Partial<CreateBotInput>;
