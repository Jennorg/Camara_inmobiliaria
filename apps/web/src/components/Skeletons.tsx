import React from 'react';

export const CourseSkeleton = () => {
  return (
    <div className="group rounded-[2.5rem] overflow-hidden border-2 bg-white border-emerald-50 shadow-[0_15px_35px_rgba(16,185,129,0.05)] animate-pulse">
      <div className="h-56 bg-slate-100 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
      </div>
      <div className="p-8 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-4 w-12 bg-slate-100 rounded-full" />
          <div className="h-3 w-16 bg-slate-100 rounded-full" />
        </div>
        <div className="h-6 w-3/4 bg-slate-100 rounded-lg" />
        <div className="h-4 w-1/2 bg-slate-100 rounded-lg" />
        <div className="h-[1px] w-full bg-slate-100" />
        <div className="flex justify-between items-center pt-2">
          <div className="space-y-1">
            <div className="h-3 w-10 bg-slate-100 rounded" />
            <div className="h-5 w-16 bg-slate-100 rounded" />
          </div>
          <div className="w-12 h-12 bg-slate-100 rounded-2xl" />
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
};

export const CourseSkeletonGrid = ({ count = 4 }: { count?: number }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, skelIdx) => (
        <CourseSkeleton key={`course-skeleton-${skelIdx}`} />
      ))}
    </>
  );
};
