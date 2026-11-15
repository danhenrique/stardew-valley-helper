import React, { PropsWithChildren, useEffect } from 'react';
import { AuthProvider, useAuth } from 'react-oidc-context';
import { useRuntimeConfig } from '../../hooks/useRuntimeConfig';
import { Alert } from '../alert';
import { Spinner } from '../spinner';
import { buildCognitoAuthConfig } from './config';

/**
 * Sets up the Cognito auth.
 *
 * This assumes a runtime-config.json file is present at '/'. In order for Auth to be set up automatically,
 * the runtime-config.json must have the cognitoProps set.
 */
const CognitoAuth: React.FC<PropsWithChildren> = ({ children }) => {
  const { cognitoProps } = useRuntimeConfig();

  if (!cognitoProps) {
    if (import.meta.env.MODE === 'local-dev') {
      // In local-dev mode with no cognitoProps available, we skip login
      return <AuthProvider>{children}</AuthProvider>;
    }
    return (
      <Alert type="error" header="Runtime config configuration error">
        <p>
          The cognitoProps have not been configured in the runtime-config.json.
        </p>
      </Alert>
    );
  }

  const cognitoAuthConfig = buildCognitoAuthConfig(
    cognitoProps,
    window.location.origin,
  );

  return (
    <AuthProvider {...cognitoAuthConfig}>
      <CognitoAuthInternal>{children}</CognitoAuthInternal>
    </AuthProvider>
  );
};

const CognitoAuthInternal: React.FC<PropsWithChildren> = ({ children }) => {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isAuthenticated && !auth.isLoading) {
      auth.signinRedirect();
    }
  }, [auth]);

  if (auth.isAuthenticated) {
    return children;
  }

  if (auth.error) {
    return (
      <Alert type="error" header="Configuration error">
        <p>
          Error contacting Cognito. Please check your runtime-config.json is
          configured with the correct endpoints.
        </p>
      </Alert>
    );
  }

  return <Spinner />;
};

export default CognitoAuth;
