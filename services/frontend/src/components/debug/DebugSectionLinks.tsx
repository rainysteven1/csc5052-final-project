import { Button } from "@/components/ui/button";

const sections = [
  { id: "debug-metadata", label: "Metadata" },
  { id: "debug-state-json", label: "State JSON" },
  { id: "debug-event-json", label: "Event JSON" },
] as const;

export function DebugSectionLinks() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {sections.map((section) => (
        <Button key={section.id} type="button" variant="secondary" size="sm" className="rounded-full" asChild>
          <a href={`#${section.id}`}>{section.label}</a>
        </Button>
      ))}
    </div>
  );
}
