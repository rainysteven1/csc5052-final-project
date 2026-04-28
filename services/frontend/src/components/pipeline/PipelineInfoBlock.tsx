import type { ReactNode } from "react";

import { SurfaceInfoBlock } from "@/components/shared/SurfaceInfoBlock";

type PipelineInfoBlockProps = {
  label: string;
  value: string;
  tone?: string;
  className?: string;
  valueClassName?: string;
  detail?: ReactNode;
};

export function PipelineInfoBlock({
  label,
  value,
  tone = "console-surface",
  className,
  valueClassName,
  detail,
}: PipelineInfoBlockProps) {
  return (
    <SurfaceInfoBlock
      label={label}
      value={value}
      tone={tone}
      className={className}
      valueClassName={valueClassName}
      detail={detail}
    />
  );
}
