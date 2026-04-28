import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SectionTabItem<T extends string> = {
  id: T;
  label: string;
};

type SectionTabsProps<T extends string> = {
  items: Array<SectionTabItem<T>>;
  active: T;
  onChange: (value: T) => void;
  className?: string;
};

export function SectionTabs<T extends string>({
  items,
  active,
  onChange,
  className,
}: SectionTabsProps<T>) {
  return (
    <div className={cn("console-tab-shell shadow-soft", className)}>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={item.id === active ? "default" : "secondary"}
            size="sm"
            onClick={() => onChange(item.id)}
            className={cn(
              "min-w-[120px] justify-center",
              item.id !== active && "console-tab-idle",
            )}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
