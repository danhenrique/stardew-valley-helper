import { screen, within } from '@testing-library/react';
import type { GameEntityOut } from '../generated/stardew-valley-api/types.gen';
import { iconUrl } from '../lib/icons';
import { buildReminders } from '../lib/reminders';
import { expectLoading } from './expectLoading';
import type { MachineCatalogStatus } from './MachineCatalogNotice';
import { renderWithIntl } from './renderWithIntl';
import { TodayReminders } from './TodayReminders';

// Day 5 is a Friday.
const FRIDAY = { year: 1, season: 'spring', day: 5 } as const;
const MONDAY = { year: 1, season: 'spring', day: 8 } as const;
const text = (s: string) => ({ en: s, ptBr: s });
const reminderEntity = (
  id: string,
  name: string,
  detail: string,
  order: number,
  weekdays: string[],
): GameEntityOut => ({
  type: 'reminders',
  id,
  name: text(name),
  attributes: {
    detail: text(detail),
    order,
    trigger: { kind: 'weekly', weekdays },
  },
});
const REMINDERS = buildReminders([
  reminderEntity('traveling-cart', 'Carroça Teste', 'Sexta e domingo', 1, [
    'fri',
  ]),
  reminderEntity('unknown-id', 'Lembrete Teste', 'Detalhe teste', 2, ['fri']),
  reminderEntity('other-day', 'Outro Dia', 'Detalhe outro', 3, ['tue']),
]);

const renderReminders = (
  today: typeof FRIDAY | typeof MONDAY = FRIDAY,
  status: MachineCatalogStatus = 'success',
) =>
  renderWithIntl(
    <TodayReminders
      reminders={REMINDERS}
      events={[]}
      today={today}
      status={status}
    />,
  );

describe('TodayReminders', () => {
  it('should list the reminders of today with their detail when some apply', () => {
    renderReminders();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Lembretes' }),
    ).toBeInTheDocument();
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Carroça Teste');
    expect(rows[0]).toHaveTextContent('Sexta e domingo');
    expect(rows[1]).toHaveTextContent('Lembrete Teste');
  });

  it('should render nothing when no reminder applies today', () => {
    const { container } = renderReminders(MONDAY);
    expect(container).toBeEmptyDOMElement();
  });

  it('should show a loading notice while reminders load', () => {
    renderReminders(FRIDAY, 'pending');
    expectLoading(screen.getByText('Carregando lembretes...'));
  });

  it('should show an error notice when reminders fail to load', () => {
    renderReminders(FRIDAY, 'error');
    expect(
      screen.getByText('Não foi possível carregar os lembretes.'),
    ).toBeInTheDocument();
  });

  it('should show the reminder sprite when the reminder has one', () => {
    renderReminders();
    const row = screen.getByText('Carroça Teste').closest('li');
    expect(row?.querySelector('img')).toHaveAttribute(
      'src',
      iconUrl('traveling-cart'),
    );
  });

  it('should keep the bell when the reminder has no sprite', () => {
    renderReminders();
    const row = screen.getByText('Lembrete Teste').closest('li');
    expect(row?.querySelector('img')).toBeNull();
    expect(row?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('TodayReminders in English', () => {
  it('should show the heading and the notices in English', () => {
    const { rerender } = renderWithIntl(
      <TodayReminders
        reminders={REMINDERS}
        events={[]}
        today={FRIDAY}
        status="success"
      />,
      { locale: 'en' },
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Reminders' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Carroça Teste')).toBeInTheDocument();
    rerender(
      <TodayReminders
        reminders={REMINDERS}
        events={[]}
        today={FRIDAY}
        status="error"
      />,
    );
    expect(
      screen.getByText('Could not load the reminders.'),
    ).toBeInTheDocument();
  });
});
