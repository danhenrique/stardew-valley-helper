import type { UserManagerSettings } from 'oidc-client-ts';

export interface CognitoProps {
  region: string;
  userPoolId: string;
  userPoolWebClientId: string;
  identityPoolId: string;
  /** Custom managed login domain (e.g. auth.example.com); the prefix domain is used when absent. */
  domain?: string;
}

/**
 * Builds the OIDC settings for the Cognito user pool.
 *
 * The user pool stays the authority (issuer and signing keys), but when a custom
 * managed login domain is configured the browser-facing endpoints point at it, so
 * sign-in never goes through the *.amazoncognito.com host.
 */
export const buildCognitoAuthConfig = (
  cognitoProps: CognitoProps,
  origin: string,
): UserManagerSettings => {
  const managedLogin = cognitoProps.domain
    ? `https://${cognitoProps.domain}`
    : undefined;

  return {
    authority: `https://cognito-idp.${cognitoProps.region}.amazonaws.com/${cognitoProps.userPoolId}`,
    client_id: cognitoProps.userPoolWebClientId,
    redirect_uri: origin,
    response_type: 'code',
    scope: 'email openid profile',
    ...(managedLogin && {
      metadataSeed: {
        authorization_endpoint: `${managedLogin}/oauth2/authorize`,
        token_endpoint: `${managedLogin}/oauth2/token`,
        revocation_endpoint: `${managedLogin}/oauth2/revoke`,
        userinfo_endpoint: `${managedLogin}/oauth2/userInfo`,
        end_session_endpoint: `${managedLogin}/logout`,
      },
    }),
  };
};
