import { useContext } from 'react';
import { StardewValleyApiContext } from '../components/StardewValleyApiProvider';
import { StardewValleyApiOptionsProxy } from '../generated/stardew-valley-api/options-proxy.gen';

export const useStardewValleyApi = (): StardewValleyApiOptionsProxy => {
  const optionsProxy = useContext(StardewValleyApiContext);

  if (!optionsProxy) {
    throw new Error(
      'useStardewValleyApi must be used within a StardewValleyApiProvider',
    );
  }

  return optionsProxy;
};
