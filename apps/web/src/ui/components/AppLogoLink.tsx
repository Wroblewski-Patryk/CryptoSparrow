import Link from 'next/link';
import type { CSSProperties } from 'react';

type AppLogoLinkProps = {
  href?: string;
  label?: string;
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
};

const joinClasses = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(' ');

export default function AppLogoLink({
  href = '/',
  label = 'Soar',
  className,
  iconClassName,
  wordmarkClassName,
}: AppLogoLinkProps) {
  const iconSizeRem = 2;
  const gapRem = 0.5;
  const estimatedWordmarkRem = Math.max(4, label.length * 0.9);
  const gradientSpanRem = iconSizeRem + gapRem + estimatedWordmarkRem;
  const brandGradientStyle = {
    ['--brand-gradient' as string]: 'linear-gradient(to right, var(--color-primary), var(--color-secondary))',
    ['--brand-gradient-size' as string]: `${gradientSpanRem}rem`,
    ['--brand-text-offset' as string]: `${iconSizeRem + gapRem}rem`,
  } as CSSProperties;

  return (
    <Link href={href} className={joinClasses('flex items-center gap-2', className)} style={brandGradientStyle}>
      <span
        aria-hidden
        className={joinClasses(
          "h-8 w-8 shrink-0 [background-image:var(--brand-gradient)] [background-size:var(--brand-gradient-size)_100%] [background-position:0_50%] [mask-image:url('/logo.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
          iconClassName
        )}
      />
      <span
        className={joinClasses(
          'brand-wordmark text-2xl leading-none font-semibold [background-image:var(--brand-gradient)] [background-size:var(--brand-gradient-size)_100%] [background-position:calc(-1*var(--brand-text-offset))_50%] bg-clip-text text-transparent',
          wordmarkClassName
        )}
      >
        {label}
      </span>
    </Link>
  );
}
