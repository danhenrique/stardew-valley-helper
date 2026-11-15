import { render, screen } from '@testing-library/react';
import { iconUrl } from '../lib/icons';
import { MachineCalendar } from './MachineCalendar';
import { MACHINE_SCHEDULE, MACHINES, machineBatch } from './testData';

describe('MachineCalendar', () => {
  it('should show the small machine sprite on a ready day when the machine has one', () => {
    render(
      <MachineCalendar
        batches={[
          machineBatch({
            schedule: {
              ...MACHINE_SCHEDULE,
              readyOn: { year: 1, season: 'spring', day: 3 },
            },
          }),
        ]}
        machines={MACHINES}
        today={{ year: 1, season: 'spring', day: 1 }}
      />,
    );
    const img = screen.getByTestId('calendar-day-3').querySelector('img');
    expect(img).toHaveAttribute('src', iconUrl('keg'));
    expect(img).toHaveClass('size-4');
  });
});
