import React from 'react'

interface StatCardProps {
  label: string
  value: string
  change?: string
  changePositive?: boolean
  icon: React.ReactNode
  iconBg?: string
}

const StatCard = ({
  label,
  value,
  change,
  changePositive = true,
  icon,
  iconBg = 'bg-emerald-50',
}: StatCardProps) => {
  return (
    <div className="min-w-0 bg-white rounded-2xl p-3 sm:p-5 border border-gray-100 flex flex-col gap-2 sm:gap-3">
      {/* Label + icon */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-slate-400 truncate">{label}</span>
        <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${iconBg}`}>
          {icon}
        </div>
      </div>

      {/* Value + change badge — stacked on mobile, side-by-side on sm+ */}
      <div className="flex flex-col xs:flex-row sm:flex-row items-start sm:items-end gap-1 sm:gap-2 sm:justify-between">
        <span className="text-xl sm:text-2xl font-bold text-slate-900 leading-none">{value}</span>
        {change && (
          <span
            className={[
              'inline-flex flex-shrink-0 items-center gap-0.5 text-[11px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full',
              changePositive
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-red-50 text-red-500',
            ].join(' ')}
          >
            {changePositive ? (
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
            {change}
          </span>
        )}
      </div>
    </div>
  )
}

export default StatCard
