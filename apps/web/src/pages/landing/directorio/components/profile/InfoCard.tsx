import React from 'react';
import { LucideIcon } from 'lucide-react';

interface InfoCardProps {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  variant?: 'compact' | 'standard';
}

export const InfoCard = ({ icon: Icon, label, children, variant = 'compact' }: InfoCardProps) => {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 py-2 px-1 group">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-grow">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight leading-none mb-0.5">{label}</p>
          <div className="text-sm font-extrabold text-slate-800 dark:text-emerald-50 truncate">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-[1.25rem] bg-slate-100/50 dark:bg-[#022c22] border border-slate-100 dark:border-emerald-500/5 shadow-xs flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-grow">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide leading-tight">{label}</p>
        <div className="text-xs md:text-sm font-extrabold text-slate-800 dark:text-emerald-50 leading-tight truncate">
          {children}
        </div>
      </div>
    </div>
  );
};

