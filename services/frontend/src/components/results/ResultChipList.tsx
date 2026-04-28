import { Badge } from '@/components/ui/badge';

type ResultChipListProps = {
  items: string[];
  emptyLabel?: string;
  className?: string;
};

export function ResultChipList({
  items,
  emptyLabel = 'No items captured.',
  className,
}: ResultChipListProps) {
  if (!items.length) {
    return <div className='text-sm text-muted-foreground'>{emptyLabel}</div>;
  }

  return (
    <div className={className || 'flex flex-wrap gap-2'}>
      {items.map((item) => (
        <Badge key={item} variant='outline' className='glass-chip-strong'>
          {item}
        </Badge>
      ))}
    </div>
  );
}
