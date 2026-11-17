import {
  createFileRoute,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import { MachinesTab } from '../components/MachinesTab';
import { PlantingsTab } from '../components/PlantingsTab';
import { type UnderlineTab, UnderlineTabs } from '../components/UnderlineTabs';

export type ProductionTabId = 'plantios' | 'maquinas';

const TABS: readonly UnderlineTab<ProductionTabId>[] = [
  { id: 'plantios', label: 'Plantios' },
  { id: 'maquinas', label: 'Máquinas' },
];

/** The `aba` search param; a missing or unknown tab opens the plantings. */
export const parseProductionSearch = (
  search: Record<string, unknown>,
): { aba: ProductionTabId } => ({
  aba: search['aba'] === 'maquinas' ? 'maquinas' : 'plantios',
});

export const Route = createFileRoute('/producao')({
  validateSearch: parseProductionSearch,
  component: ProductionPage,
});

function ProductionPage() {
  const { aba } = parseProductionSearch(useSearch({ strict: false }));
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Produção
      </h1>
      <UnderlineTabs
        tabs={TABS}
        value={aba}
        onChange={(tab) =>
          navigate({ to: '/producao', search: { aba: tab }, replace: true })
        }
        navLabel="Seções da produção"
        selectLabel="Escolha uma seção da produção"
      />
      {aba === 'maquinas' ? <MachinesTab /> : <PlantingsTab />}
    </div>
  );
}
