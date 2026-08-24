import React from 'react';
import { CreditCard, Download } from 'lucide-react';
import DashboardCard from '@/pages/landing/afiliado/components/DashboardCard';
import { SkeletonWidget } from '@/components/Skeleton';

interface WidgetFinancieroProps {
  balanceUsd?: string;
  cuotasPendientes?: string;
  proximoVencimiento?: string;
  onGenerarSolvencia?: () => void;
  loading?: boolean;
}

const WidgetFinanciero = ({
  balanceUsd = '$150.00',
  cuotasPendientes = '2 Meses',
  proximoVencimiento = '23/05/2026',
  onGenerarSolvencia,
  loading = false,
}: WidgetFinancieroProps) => (
  <DashboardCard title="Contabilidad y Solvencias" icon={CreditCard} actionText="Ver historial de pagos">
    {loading ? (
      <SkeletonWidget />
    ) : (
      <>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 py-4">
          {/* Balance */}
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-faint)' }}>
              Balance Actual (USD)
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black" style={{ color: 'var(--color-primary)' }}>
                {balanceUsd}
              </span>
              <span className="font-bold text-base uppercase" style={{ color: 'var(--color-text-faint)' }}>Neto</span>
            </div>
          </div>

          {/* Details */}
          <div className="flex-grow max-w-xs space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span style={{ color: 'var(--color-text-muted)' }} className="font-medium">Cuotas Pendientes:</span>
              <span
                className="font-black text-xs px-2.5 py-1 rounded-md"
                style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-accent-muted)', border: '1px solid var(--color-border-accent)' }}
              >
                {cuotasPendientes}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span style={{ color: 'var(--color-text-muted)' }} className="font-medium">Próximo Vencimiento:</span>
              <span className="font-bold" style={{ color: 'var(--color-accent-hover)' }}>{proximoVencimiento}</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={onGenerarSolvencia}
            className="w-full sm:w-auto font-black py-3.5 px-8 rounded-xl flex items-center justify-center gap-3 transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
            style={{
              backgroundColor: 'var(--color-accent-hover)',
              color: 'var(--color-text-on-accent)',
              boxShadow: '0 6px 20px rgba(5,150,105,0.25)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)')}
          >
            <Download size={17} />
            Generar Solvencia Automática
          </button>
        </div>
      </>
    )}
  </DashboardCard>
);

export default WidgetFinanciero;
