import { Label } from '@/components/ui/label';
import { scenarioOptions } from '@/types/analysis';

type ScenarioSelectFieldProps = {
  scenario: string;
  onChange: (value: string) => void;
};

export function ScenarioSelectField({
  scenario,
  onChange,
}: ScenarioSelectFieldProps) {
  return (
    <div className='space-y-2'>
      <Label htmlFor='scenario'>Scenario</Label>
      <select
        id='scenario'
        value={scenario}
        onChange={(event) => onChange(event.target.value)}
        className='flex h-11 w-full rounded-[22px] glass-panel-soft px-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      >
        {scenarioOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
