import { buildCognitoAuthConfig } from './config';

const cognitoProps = {
  region: 'sa-east-1',
  userPoolId: 'sa-east-1_TEST',
  userPoolWebClientId: 'test-client-id',
  identityPoolId: 'sa-east-1:00000000-0000-0000-0000-000000000000',
};
const origin = 'https://stardew.example.com';

describe('buildCognitoAuthConfig', () => {
  it('keeps the user pool as the OIDC authority and redirects back to the site', () => {
    const config = buildCognitoAuthConfig(cognitoProps, origin);

    expect(config.authority).toBe(
      'https://cognito-idp.sa-east-1.amazonaws.com/sa-east-1_TEST',
    );
    expect(config.client_id).toBe('test-client-id');
    expect(config.redirect_uri).toBe(origin);
  });

  it('relies on discovery when no managed login domain is configured', () => {
    const config = buildCognitoAuthConfig(cognitoProps, origin);

    expect(config.metadataSeed).toBeUndefined();
  });

  it('sends login, token, logout and revocation to the managed login domain when configured', () => {
    const config = buildCognitoAuthConfig(
      { ...cognitoProps, domain: 'auth.stardew.example.com' },
      origin,
    );

    expect(config.metadataSeed).toEqual({
      authorization_endpoint:
        'https://auth.stardew.example.com/oauth2/authorize',
      token_endpoint: 'https://auth.stardew.example.com/oauth2/token',
      revocation_endpoint: 'https://auth.stardew.example.com/oauth2/revoke',
      userinfo_endpoint: 'https://auth.stardew.example.com/oauth2/userInfo',
      end_session_endpoint: 'https://auth.stardew.example.com/logout',
    });
  });
});
