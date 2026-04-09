import { ReactNode } from 'react';

type HeadlineMetric = {
  key: string;
  label: string;
  value: string;
  valueClass: string;
};

type StageItem = {
  label: string;
  icon: ReactNode;
  done: boolean;
  active: boolean;
};

type BacktestRunHeaderSectionProps = {
  runName: string;
  runPreviewLabel: string;
  runStatusClassName: string;
  runStatusLabel: string;
  marketGroupLabelText: string;
  marketGroupValue: string;
  strategyLabelText: string;
  strategyValue: string;
  calcStartLabelText: string;
  calcStartValue: string;
  calcEndLabelText: string;
  calcEndValue: string;
  showProgress: boolean;
  progressLabel: string;
  progressValue: number;
  progressClassName: string;
  headlineMetrics: HeadlineMetric[];
  stagesLabel: string;
  stages: StageItem[];
};

export default function BacktestRunHeaderSection(props: BacktestRunHeaderSectionProps) {
  return (
    <section className='rounded-box border border-base-300/60 bg-base-100/80 p-4 space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='space-y-1'>
          <h2 className='text-lg font-semibold'>{props.runName}</h2>
          <p className='text-xs opacity-60'>{props.runPreviewLabel}</p>
        </div>
        <span className={`badge ${props.runStatusClassName}`}>{props.runStatusLabel}</span>
      </div>

      <div className='rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-xs'>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
          <span className='opacity-70'>{props.marketGroupLabelText}</span>
          <span className='font-semibold text-sm tracking-wide'>{props.marketGroupValue}</span>
          <span className='opacity-40'>|</span>
          <span className='opacity-70'>{props.strategyLabelText}</span>
          <span className='font-medium'>{props.strategyValue}</span>
          <span className='opacity-40'>|</span>
          <span className='opacity-70'>{props.calcStartLabelText}</span>
          <span className='font-medium'>{props.calcStartValue}</span>
          <span className='opacity-40'>|</span>
          <span className='opacity-70'>{props.calcEndLabelText}</span>
          <span className='font-medium'>{props.calcEndValue}</span>
        </div>
      </div>

      {props.showProgress ? (
        <div className='space-y-1'>
          <div className='flex items-center justify-between text-xs opacity-70'>
            <span>{props.progressLabel}</span>
            <span>{props.progressValue}%</span>
          </div>
          <progress className={`progress w-full ${props.progressClassName}`} value={props.progressValue} max={100} />
        </div>
      ) : null}

      <div className='rounded-box border border-base-300/60 bg-base-200/55 p-3 text-sm'>
        <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
          {props.headlineMetrics.map((metric) => (
            <div key={metric.key} className='rounded-md border border-base-300 bg-base-100 px-2 py-2'>
              <p className='text-[11px] uppercase tracking-wide opacity-60'>{metric.label}</p>
              <p className={`font-medium ${metric.valueClass}`}>{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className='rounded-lg border border-base-300 bg-base-200 px-3 py-2'>
        <div className='flex flex-wrap items-center gap-2 text-xs'>
          <span className='text-[11px] uppercase tracking-wide opacity-60'>{props.stagesLabel}</span>
          {props.stages.map((stage) => (
            <span
              key={stage.label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 ${
                stage.done
                  ? 'border-success/40 bg-success/10 text-success'
                  : stage.active
                    ? 'border-info/40 bg-info/10 text-info'
                    : 'border-base-300 bg-base-100 opacity-70'
              }`}
            >
              <span className={stage.active ? 'animate-pulse' : ''}>{stage.icon}</span>
              <span className='font-medium'>{stage.label}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
