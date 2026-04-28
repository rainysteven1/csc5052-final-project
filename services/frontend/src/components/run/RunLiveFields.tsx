import { AudioUploadField } from '@/components/run/AudioUploadField';
import { ScenarioSelectField } from '@/components/run/ScenarioSelectField';
import { TranscriptOverrideField } from '@/components/run/TranscriptOverrideField';

type RunLiveFieldsProps = {
  audioFile: File | null;
  scenario: string;
  transcriptOverride: string;
  onAudioChange: (file: File | null) => void;
  onScenarioChange: (value: string) => void;
  onTranscriptChange: (value: string) => void;
};

export function RunLiveFields({
  audioFile,
  scenario,
  transcriptOverride,
  onAudioChange,
  onScenarioChange,
  onTranscriptChange,
}: RunLiveFieldsProps) {
  return (
    <>
      <AudioUploadField audioFile={audioFile} onChange={onAudioChange} />
      <ScenarioSelectField scenario={scenario} onChange={onScenarioChange} />
      <TranscriptOverrideField
        value={transcriptOverride}
        onChange={onTranscriptChange}
      />
    </>
  );
}
