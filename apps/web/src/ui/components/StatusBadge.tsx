type ModeKind = 'paper' | 'live' | 'local';
type RiskKind = 'safe' | 'warning' | 'danger';

type StatusBadgeProps =
  | {
      kind: 'mode';
      value: ModeKind;
      label?: string;
    }
  | {
      kind: 'risk';
      value: RiskKind;
      label?: string;
    };

const modeClassMap: Record<ModeKind, string> = {
  paper: 'mode-paper',
  live: 'mode-live',
  local: 'mode-local',
};

const riskClassMap: Record<RiskKind, string> = {
  safe: 'risk-safe',
  warning: 'risk-warning',
  danger: 'risk-danger',
};

const defaultModeLabel: Record<ModeKind, string> = {
  paper: 'Mode: PAPER',
  live: 'Mode: LIVE',
  local: 'Mode: LOCAL',
};

const defaultRiskLabel: Record<RiskKind, string> = {
  safe: 'Risk: Safe',
  warning: 'Risk: Warning',
  danger: 'Risk: Danger',
};

export default function StatusBadge(props: StatusBadgeProps) {
  if (props.kind === 'mode') {
    const cssClass = modeClassMap[props.value];
    const label = props.label ?? defaultModeLabel[props.value];

    return <span className={`status-badge ${cssClass}`}>{label}</span>;
  }

  const cssClass = riskClassMap[props.value];
  const label = props.label ?? defaultRiskLabel[props.value];
  return <span className={`status-badge ${cssClass}`}>{label}</span>;
}
