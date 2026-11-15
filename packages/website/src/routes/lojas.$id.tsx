import { createFileRoute } from '@tanstack/react-router';
import { ShopCatalogPage } from '../components/ShopCatalogPage';

export const Route = createFileRoute('/lojas/$id')({
  component: ShopPage,
});

function ShopPage() {
  const { id } = Route.useParams();
  return <ShopCatalogPage shopId={id} />;
}
