'use client';

type SkeletonCardBlockProps = {
  cards?: number;
  title?: boolean;
  linesPerCard?: number;
  className?: string;
};

export default function SkeletonCardBlock({
  cards = 3,
  title = true,
  linesPerCard = 3,
  className = '',
}: SkeletonCardBlockProps) {
  return (
    <section
      aria-busy='true'
      aria-label='Loading cards'
      className={`space-y-3 rounded-box border border-base-300/60 bg-base-100/80 p-4 ${className}`.trim()}
    >
      {title ? <div className='skeleton h-6 w-44' /> : null}
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
        {Array.from({ length: cards }).map((_, cardIndex) => (
          <article
            key={`card-${cardIndex}`}
            className='space-y-2 rounded-box border border-base-300/50 bg-base-200/45 p-3'
          >
            <div className='skeleton h-4 w-2/3' />
            {Array.from({ length: linesPerCard }).map((__, lineIndex) => (
              <div
                key={`card-${cardIndex}-line-${lineIndex}`}
                className={`skeleton h-3 ${lineIndex === linesPerCard - 1 ? 'w-1/2' : 'w-full'}`}
              />
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
