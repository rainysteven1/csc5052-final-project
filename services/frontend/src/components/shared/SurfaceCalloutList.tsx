import { cn } from "@/lib/utils";

type SurfaceCalloutListProps = {
  items: string[];
  emptyText?: string;
  className?: string;
  itemClassName?: string;
};

export function SurfaceCalloutList({
  items,
  emptyText = "--",
  className,
  itemClassName,
}: SurfaceCalloutListProps) {
  if (!items.length) {
    return <div className="text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className={cn("space-y-2 text-sm leading-6", className)}>
      {items.map((item) => (
        <div
          key={item}
          className={cn(
            "console-block-soft break-words whitespace-normal [overflow-wrap:anywhere]",
            itemClassName,
          )}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
