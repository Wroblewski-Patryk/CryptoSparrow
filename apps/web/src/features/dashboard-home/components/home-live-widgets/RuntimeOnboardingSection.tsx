import Link from "next/link";
import type { ReactNode } from "react";

type RuntimeOnboardingStep = {
  key: string;
  icon: ReactNode;
  toneClass: string;
  title: string;
  description: string;
  cta: string;
  href: string;
};

type RuntimeOnboardingSectionProps = {
  cardClassName: string;
  title: string;
  description: string;
  badgeLabel: string;
  steps: RuntimeOnboardingStep[];
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  primaryHref: string;
  secondaryHref: string;
  primaryButtonClassName: string;
  secondaryButtonClassName: string;
};

export default function RuntimeOnboardingSection(props: RuntimeOnboardingSectionProps) {
  return (
    <section className={`${props.cardClassName} p-4 md:p-5`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-base font-semibold md:text-lg">{props.title}</h3>
          <p className="text-sm opacity-70">{props.description}</p>
        </div>
        <span className="badge badge-outline badge-sm">{props.badgeLabel}</span>
      </div>

      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {props.steps.map((step, index) => (
          <li key={step.key}>
            <article className="flex h-full flex-col gap-2 rounded-box border border-base-300/60 bg-base-200/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-box border ${step.toneClass}`}>
                  {step.icon}
                </span>
                <span className="badge badge-ghost badge-xs">{index + 1}</span>
              </div>
              <p className="text-sm font-semibold">{step.title}</p>
              <p className="text-xs opacity-70">{step.description}</p>
              <Link href={step.href} className="mt-auto inline-flex items-center text-xs font-medium text-primary hover:underline">
                {step.cta}
              </Link>
            </article>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={props.primaryHref} className={props.primaryButtonClassName}>
          {props.primaryCtaLabel}
        </Link>
        <Link href={props.secondaryHref} className={props.secondaryButtonClassName}>
          {props.secondaryCtaLabel}
        </Link>
      </div>
    </section>
  );
}
