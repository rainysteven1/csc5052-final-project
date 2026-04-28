import { FolderOpen } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { defaultReplayPath } from '@/types/analysis';

type ReplayPathFieldProps = {
  replayPath: string;
  onChange: (value: string) => void;
  recommendedPath?: string | null;
};

export function ReplayPathField({
  replayPath,
  onChange,
  recommendedPath = defaultReplayPath,
}: ReplayPathFieldProps) {
  return (
    <>
      <div className='space-y-2'>
        <Label htmlFor='replay-path'>Replay source</Label>
        <Input
          id='replay-path'
          value={replayPath}
          onChange={(event) => onChange(event.target.value)}
          placeholder={defaultReplayPath}
        />
      </div>
      {recommendedPath ? (
        <div className='panel-block glass-panel-soft text-sm leading-6 text-muted-foreground'>
          <div className='mb-2 flex items-center gap-2 font-medium text-foreground'>
            <FolderOpen className='h-4 w-4' />
            Recommended replay sample
          </div>
          <div className='console-surface px-3 py-2 font-mono text-xs text-foreground'>
            {recommendedPath}
          </div>
        </div>
      ) : null}
    </>
  );
}
