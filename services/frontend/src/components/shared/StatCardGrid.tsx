import { ControlStatCard } from "@/components/shared/ControlStatCard";

export type StatCardItem = {
  label: string;
  value: string;
  meta?: string;
};

type StatCardGridProps = {
  items: StatCardItem[];
  columnsClassName?: string;
};

export function StatCardGrid({
  items,
  columnsClassName = "grid gap-3 lg:grid-cols-3",
}: StatCardGridProps) {
  return (
    <div className={columnsClassName}>
      {items.map((item) => (
        <ControlStatCard
          key={`${item.label}-${item.value}-${item.meta || ""}`}
          label={item.label}
          value={item.value}
          meta={item.meta}
        />
      ))}
    </div>
  );
}
