import { Button } from "@/components/ui/button";

type RunSubmitButtonProps = {
  mode: "live" | "replay";
  isSubmitting: boolean;
  onClick: () => void;
};

export function RunSubmitButton({ mode, isSubmitting, onClick }: RunSubmitButtonProps) {
  const label =
    mode === "live"
      ? isSubmitting
        ? "Submitting..."
        : "Launch live analysis"
      : isSubmitting
        ? "Loading replay..."
        : "Load static replay";

  return (
    <Button className="w-full" size="lg" onClick={onClick} disabled={isSubmitting}>
      {label}
    </Button>
  );
}
