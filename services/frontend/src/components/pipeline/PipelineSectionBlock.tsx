import type { ReactNode } from "react";

import { SurfaceLabelSection } from "@/components/shared/SurfaceSection";

type PipelineSectionBlockProps = {
  label: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function PipelineSectionBlock({
  label,
  children,
  className,
  bodyClassName,
}: PipelineSectionBlockProps) {
  return (
    <SurfaceLabelSection
      label={label}
      className={className}
      bodyClassName={bodyClassName}
    >
      {children}
    </SurfaceLabelSection>
  );
}
