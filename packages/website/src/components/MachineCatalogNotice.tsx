import { SkeletonList } from './Skeleton';

/** Loading state of the machine catalog (`useMachines`), which names and acts on player machines. */
export type MachineCatalogStatus = 'pending' | 'error' | 'success';

export const machineCatalogStatus = (query: {
  isPending?: boolean;
  isError?: boolean;
}): MachineCatalogStatus =>
  query.isError ? 'error' : query.isPending ? 'pending' : 'success';

/** Shown instead of machine rows/markers until the catalog is loaded. */
export const MachineCatalogNotice = ({
  status,
}: {
  status: Exclude<MachineCatalogStatus, 'success'>;
}) =>
  status === 'pending' ? (
    <SkeletonList label="Carregando máquinas..." rows={1} />
  ) : (
    <p className="text-sm text-red-700 dark:text-red-400">
      Não foi possível carregar as máquinas. Recarregue a página.
    </p>
  );
