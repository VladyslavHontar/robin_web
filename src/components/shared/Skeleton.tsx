export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-surface-overlay ${className}`}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>
      <Skeleton className="h-4 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-16" />
      </div>
      <Skeleton className="h-4 w-full" />
    </div>
  )
}
