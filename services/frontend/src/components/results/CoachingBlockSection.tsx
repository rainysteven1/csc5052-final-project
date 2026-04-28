import { Badge } from "@/components/ui/badge";
import { ResultInfoBlock } from "@/components/results/ResultInfoBlock";
import { ResultSectionCard } from "@/components/results/ResultSectionCard";

type CoachingBlockSectionProps = {
  title: string;
  rows: string[];
  badge: string;
};

export function CoachingBlockSection({ title, rows, badge }: CoachingBlockSectionProps) {
  return (
    <ResultSectionCard title={title} action={<Badge variant="outline">{badge}</Badge>}>
      {rows.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((item, index) => (
            <ResultInfoBlock
              key={`${title}-${index}-${item}`}
              label={`${title} ${index + 1}`}
              value={item}
              tone="tone-secondary-muted"
            />
          ))}
        </div>
      ) : (
        <ResultInfoBlock
          label={title}
          value="No entries captured."
          tone="console-surface-dashed"
        />
      )}
    </ResultSectionCard>
  );
}
