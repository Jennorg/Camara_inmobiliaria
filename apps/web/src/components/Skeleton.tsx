import React from 'react';

export const Skeleton = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <div 
    className={`animate-pulse bg-slate-200 rounded-lg ${className}`} 
    style={{ 
      backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0, rgba(255,255,255,0.2) 20%, rgba(255,255,255,0.5) 60%, rgba(255,255,255,0))',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.5s infinite linear',
      ...style 
    }} 
  />
);

export const SkeletonWidget = () => (
  <div className="flex flex-col gap-6 p-4 animate-pulse">
    <div className="flex flex-col sm:flex-row justify-between gap-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-40" />
      </div>
      <div className="flex-grow max-w-xs space-y-4">
        <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-12" /></div>
        <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" /></div>
      </div>
    </div>
    <Skeleton className="h-12 w-full sm:w-64 rounded-xl" />
  </div>
);

export const SkeletonCard = () => (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-44 w-full rounded-2xl" />
    <div className="space-y-2">
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  </div>
);

export const SkeletonNotification = () => (
  <div className="flex gap-3 p-3.5 rounded-xl border border-gray-100 bg-slate-50 animate-pulse">
    <Skeleton className="w-1 h-10 rounded-full shrink-0" />
    <div className="flex-grow space-y-2">
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-2 w-1/4 opacity-60" />
    </div>
  </div>
);

export const SkeletonList = ({ count = 6 }: { count?: number }) => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: count }).map((_, itemIndex) => (
      <div key={`skel-item-${itemIndex}`} className="py-3 flex flex-col gap-2 border-b border-gray-50 last:border-0">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/4 opacity-60" />
      </div>
    ))}
  </div>
);
