import { useContext } from 'react';
import { StardewValleyApiClientContext } from '../components/StardewValleyApiProvider';
import { StardewValleyApi } from '../generated/stardew-valley-api/client.gen';

export const useStardewValleyApiClient = (): StardewValleyApi => {
  const client = useContext(StardewValleyApiClientContext);

  if (!client) {
    throw new Error(
      'useStardewValleyApiClient must be used within a StardewValleyApiProvider',
    );
  }

  return client;
};
