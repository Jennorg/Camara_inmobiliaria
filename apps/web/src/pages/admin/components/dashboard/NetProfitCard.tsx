import React from 'react'

interface NetProfitCardProps {
  value: string
  change?: string
  changePositive?: boolean
  incomePercent?: number
  expensePercent?: number
}

const NetProfitCard = ({
  value = '$16,250',
  change = '+81%',
  changePositive = true,
  incomePercent = 81,
  expensePercent = 63,
}: NetProfitCardProps) => {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Ganancia Neta</h3>
        {change && (
          <span
            className={[
              'inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full',
              changePositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500',
            ].join(' ')}
          >
            {changePositive ? '▲' : '▼'} {change}
          </span>
        )}
      </div>

      <p className="text-2xl font-bold text-slate-900 leading-none">{value}
        <span className="text-sm font-normal text-slate-400 ml-1">este mes</span>
      </p>

      {/* Income bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-slate-400 font-medium">
          <span>● Ingresos</span>
          <span>${incomePercent}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-colors duration-700"
            style={{ width: `${incomePercent}%` }}
          />
        </div>
      </div>

      {/* Expense bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-slate-400 font-medium">
          <span>● Gastos</span>
          <span>{expensePercent}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-rose-300 rounded-full transition-colors duration-700"
            style={{ width: `${expensePercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default NetProfitCard
