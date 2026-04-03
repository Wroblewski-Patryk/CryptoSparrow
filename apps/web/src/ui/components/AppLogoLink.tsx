import Link from 'next/link';

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
  return (
    <Link href={href} className={joinClasses('flex items-center gap-2', className)}>
      <span
        aria-hidden
        className={joinClasses(
          "h-8 w-8 bg-current [mask-image:url('/logo.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
          iconClassName
        )}
      />
      <span className={joinClasses('brand-wordmark', wordmarkClassName)}>{label}</span>
    </Link>
  );
}

