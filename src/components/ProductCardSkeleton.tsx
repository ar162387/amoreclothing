import { Skeleton } from '@/components/ui/skeleton';

const ProductCardSkeleton = () => {
  return (
    <div className="group">
      <div className="block">
        <div className="relative overflow-hidden bg-secondary aspect-[3/4] mb-4">
          <Skeleton className="w-full h-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
};

export default ProductCardSkeleton;
