import { SectionEyebrow } from "@/components/shared/SectionEyebrow";

type SessionSummaryBoxProps = {
  label: string;
  value: string;
  large?: boolean;
};

export function SessionSummaryBox({ label, value, large = false }: SessionSummaryBoxProps) {
  return (
    <div className="console-surface p-4">
      <SectionEyebrow>{label}</SectionEyebrow>
      <div
        className={
          large
            ? "mt-2 break-words text-sm leading-6 text-foreground"
            : "mt-2 break-words text-sm font-medium text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}
