import { Button } from '@/components/ui/button';
import { isFakeDeployment } from '@/lib/runtime-config';

type RunSubmitButtonProps = {
  mode: 'live' | 'replay';
  isSubmitting: boolean;
  onClick: () => void;
};

export function RunSubmitButton({
  mode,
  isSubmitting,
  onClick,
}: RunSubmitButtonProps) {
  const label =
    mode === 'live'
      ? isSubmitting
        ? 'Submitting...'
        : 'Launch custom live analysis'
      : isSubmitting
        ? 'Loading replay...'
        : isFakeDeployment
          ? 'Load selected replay'
          : 'Load custom replay';

  return (
    <Button
      className='w-full'
      size='lg'
      onClick={onClick}
      disabled={isSubmitting}
    >
      {label}
    </Button>
  );
}
