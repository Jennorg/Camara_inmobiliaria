import React from 'react';

interface DashboardCardProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  icon?: React.ElementType;
  actionText?: string;
  actionIcon?: React.ElementType;
  onAction?: () => void;
  /** When true, constrains the body to a max height and enables vertical scrolling */
  scrollable?: boolean;
}

const DashboardCard = ({
  children,
  title,
  description,
  icon: Icon,
  actionText,
  actionIcon: ActionIcon,
  onAction,
  scrollable = false,
}: DashboardCardProps) => (
  <div
    className="rounded-2xl overflow-hidden flex flex-col hover:shadow-md transition-shadow"
    style={{
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}
  >
    {/* Header */}
    <div
      className="px-6 py-4 flex justify-between items-center"
      style={{
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-subtle)',
      }}
    >
      <div className="flex items-center gap-2.5">
        {Icon && <Icon size={17} style={{ color: 'var(--color-accent-hover)' }} />}
        <div>
          <h3 className="font-bold text-sm uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
            {title}
          </h3>
          {description && (
            <p className="text-[10px] text-gray-400 font-medium normal-case mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      {actionText && (
        <button
          onClick={onAction}
          className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors hover:underline"
          style={{ color: 'var(--color-accent-hover)' }}
        >
          {actionText}
          {ActionIcon && <ActionIcon size={11} />}
        </button>
      )}
    </div>

    <div
      className={`p-6 flex-grow${scrollable ? ' custom-scrollbar-light' : ''}`}
      style={scrollable ? { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } : undefined}
    >{children}</div>
  </div>
);

export default DashboardCard;
