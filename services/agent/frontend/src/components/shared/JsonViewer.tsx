import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type JsonViewerProps = {
  value: unknown;
  className?: string;
  exportName?: string;
};

export function JsonViewer({ value, className, exportName = "payload.json" }: JsonViewerProps) {
  const handleExport = () => {
    const json = JSON.stringify(value, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col rounded-[24px] border border-stone-800 bg-stone-950/96 p-4 text-stone-100 shadow-inner", className)}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400">JSON payload</div>
        <Button type="button" size="sm" variant="outline" className="border-stone-700 bg-stone-900 text-stone-100 hover:bg-stone-800/90" onClick={handleExport}>
          <Download className="mr-2 h-3.5 w-3.5" />
          Export
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 pr-2">
        <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-stone-100/95">{JSON.stringify(value, null, 2)}</pre>
      </ScrollArea>
    </div>
  );
}
