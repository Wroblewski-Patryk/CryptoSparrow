export type FundingRatePoint = {
  timestamp: number;
  fundingRate: number;
};

export type OpenInterestPoint = {
  timestamp: number;
  openInterest: number;
};

export type OrderBookPoint = {
  timestamp: number;
  imbalance: number;
  spreadBps: number;
  depthRatio: number;
};
