'use client';

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export default function LoadingSkeleton({
  className = '',
  variant = 'rectangular'
}: LoadingSkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-700';

  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      aria-label="Loading..."
    />
  );
}

export function SessionPageSkeleton() {
  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header Skeleton */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <LoadingSkeleton className="w-6 h-6" variant="circular" />
            <div>
              <LoadingSkeleton className="w-48 h-6 mb-2" />
              <LoadingSkeleton className="w-32 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LoadingSkeleton className="w-24 h-9" />
            <LoadingSkeleton className="w-24 h-9" />
            <LoadingSkeleton className="w-24 h-9" />
          </div>
        </div>
      </header>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer Skeleton */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 p-4">
          <LoadingSkeleton className="w-full h-8 mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <LoadingSkeleton key={i} className="w-full h-6" />
            ))}
          </div>
        </div>

        {/* Editor Skeleton */}
        <div className="flex-1 bg-gray-900 p-4">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <LoadingSkeleton key={i} className="w-full h-5" />
            ))}
          </div>
        </div>

        {/* Chat Panel Skeleton */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 p-4">
          <LoadingSkeleton className="w-full h-8 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-2">
                <LoadingSkeleton className="w-8 h-8" variant="circular" />
                <div className="flex-1">
                  <LoadingSkeleton className="w-24 h-4 mb-2" />
                  <LoadingSkeleton className="w-full h-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <LoadingSkeleton className="w-48 h-6 mb-2" />
          <LoadingSkeleton className="w-32 h-4" />
        </div>
        <LoadingSkeleton className="w-16 h-6" />
      </div>
      <LoadingSkeleton className="w-full h-4 mb-2" />
      <div className="flex items-center gap-4 mt-4">
        <LoadingSkeleton className="w-24 h-4" />
        <LoadingSkeleton className="w-24 h-4" />
      </div>
    </div>
  );
}
