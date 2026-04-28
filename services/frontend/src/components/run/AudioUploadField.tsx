import { useRef } from "react";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type AudioUploadFieldProps = {
  audioFile: File | null;
  onChange: (file: File | null) => void;
};

export function AudioUploadField({ audioFile, onChange }: AudioUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor="audio">Audio file</Label>
      <input
        ref={fileInputRef}
        id="audio"
        type="file"
        accept=".wav,.mp3,.m4a,.flac"
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <div className="grid gap-3">
        <Button type="button" variant="secondary" className="w-full" onClick={() => fileInputRef.current?.click()}>
          <UploadCloud className="mr-2 h-4 w-4" />
          {audioFile ? "Replace audio file" : "Choose audio file"}
        </Button>
        <div className="console-surface px-4 py-3 text-sm text-muted-foreground">
          <span className="break-all">{audioFile ? `${audioFile.name} · ${(audioFile.size / 1024 / 1024).toFixed(2)} MB` : "--"}</span>
        </div>
      </div>
    </div>
  );
}
