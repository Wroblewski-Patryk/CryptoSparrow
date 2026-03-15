export type BotMode = "PAPER" | "LIVE" | "LOCAL";

export type Bot = {
  id: string;
  name: string;
  mode: BotMode;
  isActive: boolean;
  liveOptIn: boolean;
  maxOpenPositions: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateBotInput = {
  name: string;
  mode: BotMode;
  isActive: boolean;
  liveOptIn: boolean;
  maxOpenPositions: number;
};

export type UpdateBotInput = Partial<CreateBotInput>;

