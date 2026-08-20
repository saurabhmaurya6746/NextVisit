import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-3 sm:p-5 shadow-xs space-y-3 min-h-[120px] sm:min-h-[140px] flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-3.5 w-24 sm:w-32 rounded-sm" />
        <Skeleton className="h-7 w-7 sm:h-10 sm:w-10 rounded-xl shrink-0" />
      </div>
      <div className="space-y-1.5 mt-auto">
        <Skeleton className="h-6 w-20 sm:h-8 sm:w-28 rounded-md" />
        <Skeleton className="h-3 w-16 rounded-sm" />
      </div>
    </div>
  );
}

export function SkeletonStatsGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SkeletonBucketCards({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card p-5 space-y-2.5 shadow-xs">
          <Skeleton className="h-2.5 w-20 rounded-sm" />
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-sm mt-2" />
          <Skeleton className="h-5 w-28 rounded-full mt-2" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCampaignCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card p-5 space-y-3.5 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-32 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-24 rounded-sm" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTablesGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border-2 border-dashed p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl border overflow-hidden">
      <div className="border-b bg-muted/40 p-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 w-16" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3 border-b p-3 last:border-0" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} className="h-4 w-full" />)}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCustomerCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card p-4 space-y-3 shadow-xs">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28 rounded-sm" />
              <Skeleton className="h-3 w-20 rounded-sm" />
            </div>
            <div className="space-y-1 flex flex-col items-end">
              <Skeleton className="h-4 w-12 rounded-full" />
              <Skeleton className="h-3 w-10 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <Skeleton className="h-9 rounded-lg" />
            <Skeleton className="h-9 rounded-lg" />
            <Skeleton className="h-9 rounded-lg" />
            <Skeleton className="h-9 rounded-lg" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-4 w-24 rounded-sm" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function useShortMountFlag(ms = 450) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return loading;
}