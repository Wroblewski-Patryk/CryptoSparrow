export type StrategyDto = {
    id: string;
    name: string;
    description: Text;
    leverage: number;
    interval: string;
    createdAt: string;
    config?: any;
};

export type StrategyFormProps = {
    initial?: StrategyFormState;
    onSubmit?: (data: StrategyFormState) => Promise<void>;
    mode?: "create" | "edit";
};

export type StrategyFormState = {
    name: string;
    description: string;
    interval: string;
    leverage: number;
    walletRisk: number;
    openConditions: OpenConditions;
    closeConditions: CloseConditions;
    additional: any;
};

//SECTION BASIC
export type BasicProps = {
    data: StrategyFormState;
    setData: (updater: (prev: StrategyFormState) => StrategyFormState) => void;
};

//SECTION OPEN
export type OpenConditions = {
    direction: "both" | "long" | "short";
    indicatorsLong: UserIndicator[];
    indicatorsShort: UserIndicator[];
};
export type OpenProps = {
    data: OpenConditions;
    setData: (updater: (prev: OpenConditions) => OpenConditions) => void;
}

//SECTION OPEN - COMPONENT INDICATORS
export type IndicatorMeta = {
    name: string;
    group: string;
    type: string;
    params: { name: string; default: number; min: number; max: number }[];
};

export type UserIndicator = {
    group: string;
    name: string;
    params: Record<string, number>;
    condition: ">" | "<";
    value: number;
    weight: number;
    expanded?: boolean;
};

export type IndicatorsProps = {
    side: "LONG" | "SHORT";
    indicators: IndicatorMeta[];   // <-- TU zmiana: meta z API
    value: UserIndicator[];        // <-- stan formularza
    setValue: (arr: UserIndicator[]) => void;
};


//SECTION CLOSE
export type Threshold = { percent: number; arm: number };
export type CloseConditions = {
    mode: "basic" | "advanced";
    tp: number;
    sl: number;
    ttp: Threshold[];
    tsl: Threshold[];
};
export type CloseProps = {
    data: CloseConditions;
    setData: (updater: (prev: CloseConditions) => CloseConditions) => void;
};

//SECTION ADDITIONAL
export type TimeUnit = "min" | "h" | "d" | "w";
export type DcaMode = "basic" | "advanced";
export type DcaLevel = { percent: number; multiplier: number };

export type AdditionalState = {
    // DCA
    dcaEnabled: boolean;
    dcaMode: DcaMode;
    dcaTimes: number;         // basic
    dcaMultiplier: number;    // basic
    dcaLevels: DcaLevel[];    // advanced

    // Limits
    maxPositions: number;
    maxOrders: number;

    // Lifetimes
    positionLifetime: number;
    positionUnit: TimeUnit;
    orderLifetime: number;
    orderUnit: TimeUnit;
};

export type AdditionalProps = {
    data: AdditionalState;
    setData: (updater: (prev: AdditionalState) => AdditionalState) => void;
};