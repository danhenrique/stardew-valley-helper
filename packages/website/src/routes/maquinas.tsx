import { createFileRoute, redirect } from '@tanstack/react-router';

/** The machines moved to a tab of the production page. */
export const Route = createFileRoute('/maquinas')({
  beforeLoad: () => {
    throw redirect({ to: '/producao', search: { aba: 'maquinas' } });
  },
});
