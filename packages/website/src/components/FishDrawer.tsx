import type { FishOut } from '../generated/stardew-valley-api/types.gen';
import { formatWindow } from '../lib/fish';
import { SEASON_LABELS } from '../lib/i18n';
import { FishHours, fishName } from './FishCard';
import { ItemDrawer } from './ItemDrawer';

// Adapted from Tailwind Plus overlays/drawers/05-with-sticky-footer.jsx (via ItemDrawer);
// details list from data-display/description-lists/01-left-aligned.jsx.

const CATEGORY_LABELS: Record<FishOut['category'], string> = {
  regular: 'Comum',
  'night-market': 'Mercado Noturno',
  legendary: 'Lendário',
  'legendary-ii': 'Lendário II',
};
const TOOL_LABELS: Record<FishOut['tool'], string> = {
  rod: 'Vara',
  'crab-pot': 'Covo',
};
const WEATHER_LABELS: Record<FishOut['weather'], string> = {
  any: 'Qualquer clima',
  sun: 'Só com sol',
  rain: 'Só com chuva',
};

export const FishDrawer = ({
  fish,
  onClose,
}: {
  fish: FishOut | null;
  onClose: () => void;
}) => (
  <ItemDrawer
    open={fish !== null}
    title={fish ? fishName(fish) : ''}
    onClose={onClose}
    footer={
      <button
        type="button"
        onClick={onClose}
        className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
      >
        Fechar
      </button>
    }
  >
    {fish && (
      <dl className="divide-y divide-gray-100 text-sm dark:divide-white/10">
        {[
          [
            'Tipo',
            `${CATEGORY_LABELS[fish.category]} · ${TOOL_LABELS[fish.tool]}`,
          ],
          ['Local', fish.location.ptBr ?? fish.location.en ?? '—'],
          ['Estações', fish.seasons.map((s) => SEASON_LABELS[s]).join(', ')],
          ['Clima', WEATHER_LABELS[fish.weather]],
          ['Horário', fish.windows.map(formatWindow).join(' · ')],
        ].map(([term, detail]) => (
          <div key={term} className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="font-medium text-gray-900 dark:text-white">
              {term}
            </dt>
            <dd className="mt-1 text-gray-700 sm:col-span-2 sm:mt-0 dark:text-gray-400">
              {detail}
            </dd>
          </div>
        ))}
        <div className="py-3">
          <FishHours fish={fish} />
        </div>
      </dl>
    )}
  </ItemDrawer>
);
