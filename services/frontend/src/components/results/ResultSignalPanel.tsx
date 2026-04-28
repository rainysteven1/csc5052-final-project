import type { ReactNode } from "react";

import { SectionEyebrow } from "@/components/shared/SectionEyebrow";
import { SurfaceLabelSection } from "@/components/shared/SurfaceSection";
import { Badge } from "@/components/ui/badge";

type ResultSignalPanelProps = {
  title: string;
  items: string[];
  emptyLabel: string;
  icon: ReactNode;
};

export function ResultSignalPanel({ title, items, emptyLabel, icon }: ResultSignalPanelProps) {
  return (
    <SurfaceLabelSection
      label={title}
      bodyClassName="mt-3 flex flex-wrap gap-2"
      action={
        <SectionEyebrow className="flex items-center gap-2">
          {icon}
        </SectionEyebrow>
      }
    >
      {items.length ? (
        items.map((item) => (
          <Badge key={`${title}-${item}`} variant="outline">
            {item}
          </Badge>
        ))
      ) : (
        <span className="text-sm text-muted-foreground">{emptyLabel}</span>
      )}
    </SurfaceLabelSection>
  );
}
