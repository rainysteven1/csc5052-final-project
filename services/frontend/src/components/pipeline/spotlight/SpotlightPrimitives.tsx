import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { PipelineInfoBlock } from "@/components/pipeline/PipelineInfoBlock";
import { SurfaceCalloutList } from "@/components/shared/SurfaceCalloutList";

export function SpotlightTile({ label, value }: { label: string; value: ReactNode }) {
  return <PipelineInfoBlock label={label} value={String(value)} tone="console-surface" />;
}

export function SpotlightChipList({ items }: { items: string[] }) {
  if (!items.length) {
    return <div className="text-sm text-muted-foreground">--</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge
          key={item}
          variant="outline"
          className="glass-chip-soft max-w-full break-words whitespace-normal [overflow-wrap:anywhere]"
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}

export function SpotlightCalloutList({ items }: { items: string[] }) {
  return <SurfaceCalloutList items={items} />;
}
