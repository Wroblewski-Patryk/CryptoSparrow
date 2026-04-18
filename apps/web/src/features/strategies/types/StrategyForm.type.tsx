export type StrategyDto = {
    id: string;
    name: string;
    description: string;
    leverage: number;
    interval: string;
    createdAt: string;
    walletRisk?: number;
    config?: Record<string, unknown>;
};

export type StrategyFormProps = {
    initial?: StrategyFormState;
    onSubmit?: (data: StrategyFormState) => Promise<void>;
    mode?: "create" | "edit";
    formId?: string;
    submitting?: boolean;
};

export type StrategyFormState = {
    name: string;
    description: string;
    interval: string;
    leverage: number;
    walletRisk: number;
    openConditions: OpenConditions;
    closeConditions: CloseConditions;
    additional: AdditionalState;
};

//SECTION BASIC
export type BasicProps = {
    data: StrategyFormState;
    setData: (updater: (prev: StrategyFormState) => StrategyFormState) => void;
    errors?: {
        name?: string;
        interval?: string;
    };
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
    condition: StrategyConditionOperator;
    value: number | [number, number];
    weight: number;
    expanded?: boolean;
};

export type StrategyConditionOperator =
    | ">"
    | ">="
    | "<"
    | "<="
    | "=="
    | "!="
    | "CROSS_ABOVE"
    | "CROSS_BELOW"
    | "IN_RANGE"
    | "OUT_OF_RANGE";

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
export type MarginMode = "CROSSED" | "ISOLATED";

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
    marginMode: MarginMode;
};

export type AdditionalProps = {
    data: AdditionalState;
    setData: (updater: (prev: AdditionalState) => AdditionalState) => void;
};
