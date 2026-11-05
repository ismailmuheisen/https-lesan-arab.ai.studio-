import React from 'react';

export const ToolSkeleton: React.FC = () => {
  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 animate-pulse space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div className="space-y-2.5">
          <div className="h-8 w-48 bg-slate-800/80 rounded-xl" />
          <div className="h-4 w-72 bg-slate-850/60 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-slate-800/70 rounded-xl" />
          <div className="h-9 w-28 bg-slate-800/70 rounded-xl" />
        </div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-44 bg-slate-900/60 border border-white/5 rounded-2xl p-6 space-y-3">
            <div className="h-4 w-3/4 bg-slate-800/70 rounded" />
            <div className="h-4 w-1/2 bg-slate-800/70 rounded" />
            <div className="h-10 w-full bg-slate-800/40 rounded-xl mt-4" />
          </div>

          <div className="h-64 bg-slate-900/40 border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="h-5 w-40 bg-slate-800/60 rounded" />
            <div className="h-4 w-full bg-slate-800/40 rounded" />
            <div className="h-4 w-5/6 bg-slate-800/40 rounded" />
            <div className="h-4 w-4/6 bg-slate-800/40 rounded" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-56 bg-slate-900/60 border border-white/5 rounded-2xl p-5 space-y-3">
            <div className="h-5 w-32 bg-slate-800/70 rounded" />
            <div className="h-4 w-full bg-slate-800/40 rounded" />
            <div className="h-4 w-4/5 bg-slate-800/40 rounded" />
            <div className="h-8 w-full bg-slate-800/50 rounded-xl mt-6" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolSkeleton;
