import { createContext, FC, PropsWithChildren, useMemo } from 'react';
import { StardewValleyApi } from '../generated/stardew-valley-api/client.gen';
import { StardewValleyApiOptionsProxy } from '../generated/stardew-valley-api/options-proxy.gen';
import { useRuntimeConfig } from '../hooks/useRuntimeConfig';
import { useSigV4 } from '../hooks/useSigV4';

export const StardewValleyApiContext = createContext<
  StardewValleyApiOptionsProxy | undefined
>(undefined);

export const StardewValleyApiClientContext = createContext<
  StardewValleyApi | undefined
>(undefined);

const useCreateStardewValleyApiClient = (): StardewValleyApi => {
  const runtimeConfig = useRuntimeConfig();
  const apiUrl = runtimeConfig.apis.StardewValleyApi;
  const sigv4Client = useSigV4();
  return useMemo(
    () =>
      new StardewValleyApi({
        url: apiUrl,
        fetch: sigv4Client.fetch,
      }),
    [apiUrl, sigv4Client],
  );
};

export const StardewValleyApiProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const client = useCreateStardewValleyApiClient();
  const optionsProxy = useMemo(
    () => new StardewValleyApiOptionsProxy({ client }),
    [client],
  );

  return (
    <StardewValleyApiClientContext.Provider value={client}>
      <StardewValleyApiContext.Provider value={optionsProxy}>
        {children}
      </StardewValleyApiContext.Provider>
    </StardewValleyApiClientContext.Provider>
  );
};

export default StardewValleyApiProvider;
