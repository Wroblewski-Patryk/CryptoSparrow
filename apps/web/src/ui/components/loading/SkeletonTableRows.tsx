'use client';

type SkeletonTableRowsProps = {
  columns?: number;
  rows?: number;
  title?: boolean;
  toolbar?: boolean;
  className?: string;
};

export default function SkeletonTableRows({
  columns = 7,
  rows = 6,
  title = true,
  toolbar = true,
  className = '',
}: SkeletonTableRowsProps) {
  const safeColumns = Math.max(1, columns);
  const safeRows = Math.max(1, rows);

  return (
    <section
      aria-busy='true'
      aria-label='Loading table rows'
      className={`space-y-3 rounded-box border border-base-300/60 bg-base-100/80 p-4 ${className}`.trim()}
    >
      {title ? <div className='skeleton h-6 w-40' /> : null}
      {toolbar ? (
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='skeleton h-9 w-full md:w-72' />
          <div className='skeleton h-9 w-28' />
        </div>
      ) : null}
      <div className='overflow-x-auto'>
        <table className='table w-full'>
          <thead>
            <tr>
              {Array.from({ length: safeColumns }).map((_, index) => (
                <th key={`head-${index}`}>
                  <div className='skeleton h-3.5 w-20' />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: safeRows }).map((_, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {Array.from({ length: safeColumns }).map((__, colIndex) => (
                  <td key={`row-${rowIndex}-col-${colIndex}`}>
                    <div className={`skeleton h-3.5 ${colIndex === 0 ? 'w-24' : 'w-16'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
