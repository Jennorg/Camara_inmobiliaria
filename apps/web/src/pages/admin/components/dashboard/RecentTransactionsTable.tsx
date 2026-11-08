import React from 'react'

type TxStatus = 'Completed' | 'Pending' | 'Cancelled'

interface Transaction {
  id: string
  date: string
  orderId: string
  description: string
  category: string
  status: TxStatus
  amount: string
  positive: boolean
}

const STATUS_STYLES: Record<TxStatus, string> = {
  Completed: 'bg-emerald-50 text-emerald-600',
  Pending: 'bg-amber-50 text-amber-600',
  Cancelled: 'bg-red-50 text-red-500',
}

const STATUS_LABELS: Record<TxStatus, string> = {
  Completed: 'Completado',
  Pending: 'Pendiente',
  Cancelled: 'Cancelado',
}

interface RecentTransactionsTableProps {
  transactions?: Transaction[]
  title?: string
  onViewAll?: () => void
}

const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: '1', date: 'Mar 01, 2026', orderId: 'TRN-001245', description: 'Pago cuota mensual — Afiliado #001', category: 'Cuota de afiliado', status: 'Completed', amount: '+$2,450.00', positive: true },
  { id: '2', date: 'Feb 28, 2026', orderId: 'TRN-001244', description: 'Inscripción taller de formación', category: 'Formación', status: 'Completed', amount: '-$340.50', positive: false },
  { id: '3', date: 'Feb 25, 2026', orderId: 'TRN-001243', description: 'Servicios públicos sede gremial', category: 'Servicios', status: 'Pending', amount: '-$185.00', positive: false },
  { id: '4', date: 'Feb 20, 2026', orderId: 'TRN-001242', description: 'Pago convenio Cámara de Comercio', category: 'Convenio', status: 'Completed', amount: '+$6,500.00', positive: true },
]

const RecentTransactionsTable = ({
  transactions = DEFAULT_TRANSACTIONS,
  title = 'Transacciones Recientes',
  onViewAll,
}: RecentTransactionsTableProps) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button onClick={onViewAll} className="text-xs font-medium text-[#00C07A] hover:underline">
          Ver todo
        </button>
      </div>

      {/* ── MOBILE: cards ── */}
      <div className="sm:hidden divide-y divide-gray-50">
        {transactions.map((tx) => (
          <div key={tx.id} className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{tx.description}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[11px] text-slate-400">{tx.date}</span>
                <span className="text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{tx.category}</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_STYLES[tx.status]}`}>
                  {STATUS_LABELS[tx.status]}
                </span>
              </div>
            </div>
            <span className={`flex-shrink-0 text-sm font-bold tabular-nums ${tx.positive ? 'text-emerald-600' : 'text-slate-600'}`}>
              {tx.amount}
            </span>
          </div>
        ))}
      </div>

      {/* ── DESKTOP: full table ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="bg-gray-50/60">
              {['FECHA', 'ID TRANSACCIÓN', 'DESCRIPCIÓN', 'CATEGORÍA', 'ESTADO', 'MONTO'].map((h) => (
                <th key={h} className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 tracking-wide uppercase whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{tx.date}</td>
                <td className="px-5 py-3 text-slate-500 text-xs font-mono">{tx.orderId}</td>
                <td className="px-5 py-3 text-slate-700 font-medium text-xs max-w-[200px] truncate">{tx.description}</td>
                <td className="px-5 py-3">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                    {tx.category}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${STATUS_STYLES[tx.status]}`}>
                    {STATUS_LABELS[tx.status]}
                  </span>
                </td>
                <td className={`px-5 py-3 font-semibold text-sm tabular-nums whitespace-nowrap ${tx.positive ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {tx.amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RecentTransactionsTable
