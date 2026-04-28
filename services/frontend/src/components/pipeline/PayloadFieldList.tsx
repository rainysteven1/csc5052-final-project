import { SurfaceCalloutList } from "@/components/shared/SurfaceCalloutList";

type PayloadFieldListProps = {
  payload: Record<string, unknown>;
};

export function PayloadFieldList({ payload }: PayloadFieldListProps) {
  const entries = Object.entries(payload).slice(0, 12);

  if (!entries.length) {
    return <div className="text-muted-foreground">No payload fields captured.</div>;
  }

  return (
    <SurfaceCalloutList
      items={entries.map(([key, value]) => `${key}: ${formatPayloadValue(value)}`)}
      itemClassName="tone-secondary-soft"
    />
  );
}

function formatPayloadValue(value: unknown) {
  if (value == null) {
    return "--";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `${value.length} items`;
  }
  if (typeof value === "object") {
    return `${Object.keys(value as Record<string, unknown>).length} fields`;
  }
  return String(value);
}
