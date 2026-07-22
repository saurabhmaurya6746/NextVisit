import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonStatsGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-20" />
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
          <Skeleton className="h-8 w-full rounded-full" />
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