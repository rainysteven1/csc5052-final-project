import { ReplayPathField } from "@/components/run/ReplayPathField";

type RunReplayFieldsProps = {
  replayPath: string;
  onReplayPathChange: (value: string) => void;
};

export function RunReplayFields({ replayPath, onReplayPathChange }: RunReplayFieldsProps) {
  return <ReplayPathField replayPath={replayPath} onChange={onReplayPathChange} />;
}
