import React from 'react';

const pulse = {
  animation: 'tp-skeleton-pulse 1.2s ease-in-out infinite',
  backgroundColor: 'var(--bs-secondary-bg, #e9ecef)'
};

export function SkeletonLine({ className = '', height = 12, width = '100%' }) {
  return (
    <div
      className={`rounded-2 ${className}`}
      style={{ ...pulse, height, width, minHeight: height }}
      aria-hidden
    />
  );
}

export function SkeletonCard({ rows = 3 }) {
  return (
    <div className="card border-0 shadow-sm rounded-3 overflow-hidden mb-3">
      <div className="card-body p-3">
        <SkeletonLine height={14} width="40%" className="mb-3" />
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonLine key={i} height={10} width={i === rows - 1 ? '60%' : '100%'} className="mb-2" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ cols = 5, rows = 6 }) {
  return (
    <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
      <div className="table-responsive">
        <table className="table mb-0">
          <thead className="table-light">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="py-3">
                  <SkeletonLine height={10} width="70%" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c} className="py-3">
                    <SkeletonLine height={10} width={c === cols - 1 ? '50%' : '85%'} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SkeletonStatCards({ count = 4 }) {
  return (
    <div className="row g-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="col-12 col-md-6 col-xl-4">
          <div className="card border-0 shadow-sm h-100 rounded-3">
            <div className="card-body py-4">
              <SkeletonLine height={10} width="50%" className="mb-3" />
              <SkeletonLine height={28} width="35%" className="mb-2" />
              <SkeletonLine height={12} width="70%" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
