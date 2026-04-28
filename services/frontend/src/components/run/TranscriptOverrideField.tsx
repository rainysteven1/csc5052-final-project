import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TranscriptOverrideFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function TranscriptOverrideField({ value, onChange }: TranscriptOverrideFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="transcript">Transcript override</Label>
      <Textarea
        id="transcript"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Optional: paste transcript text to bypass ASR."
        className="min-h-[180px]"
      />
    </div>
  );
}
