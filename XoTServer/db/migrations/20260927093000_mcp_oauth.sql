-- Better Auth 1.7.4 MCP OAuth/JWT schema, generated with its CLI and adapted to
-- this repository's UUID user/session IDs. These tables are auth-owner only;
-- the application role has RLS enabled with no grant policy.
CREATE TABLE public.jwks (
  id UUID PRIMARY KEY, "publicKey" TEXT NOT NULL, "privateKey" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL, "expiresAt" TIMESTAMPTZ,
  alg TEXT, crv TEXT
);

CREATE TABLE public."oauthClient" (
  id UUID PRIMARY KEY, "clientId" TEXT NOT NULL UNIQUE,
  "clientSecret" TEXT, "clientDiscoveryId" TEXT,
  disabled BOOLEAN, "skipConsent" BOOLEAN, "enableEndSession" BOOLEAN,
  "subjectType" TEXT, scopes JSONB, "clientCredentialsScopes" JSONB,
  "userId" UUID REFERENCES public."user"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ, "updatedAt" TIMESTAMPTZ,
  name TEXT, uri TEXT, icon TEXT, contacts JSONB, tos TEXT, policy TEXT,
  "softwareId" TEXT, "softwareVersion" TEXT, "softwareStatement" TEXT,
  "redirectUris" JSONB NOT NULL, "postLogoutRedirectUris" JSONB,
  "backchannelLogoutUri" TEXT, "backchannelLogoutSessionRequired" BOOLEAN,
  "tokenEndpointAuthMethod" TEXT, "applicationType" TEXT,
  jwks TEXT, "jwksUri" TEXT, "grantTypes" JSONB, "responseTypes" JSONB,
  "requirePKCE" BOOLEAN, "dpopBoundAccessTokens" BOOLEAN,
  "referenceId" TEXT, metadata JSONB
);

CREATE TABLE public."oauthResource" (
  id UUID PRIMARY KEY, identifier TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  "accessTokenTtl" INTEGER, "refreshTokenTtl" INTEGER,
  "signingAlgorithm" TEXT, "signingKeyId" TEXT,
  "allowedScopes" JSONB, "customClaims" JSONB,
  "dpopBoundAccessTokensRequired" BOOLEAN, disabled BOOLEAN,
  "createdAt" TIMESTAMPTZ, "updatedAt" TIMESTAMPTZ,
  "policyVersion" INTEGER, metadata JSONB
);

CREATE TABLE public."oauthClientResource" (
  id UUID PRIMARY KEY,
  "clientId" TEXT NOT NULL REFERENCES public."oauthClient"("clientId") ON DELETE CASCADE,
  "resourceId" TEXT NOT NULL REFERENCES public."oauthResource"(identifier) ON DELETE CASCADE,
  metadata JSONB, "createdAt" TIMESTAMPTZ,
  UNIQUE ("clientId", "resourceId")
);

CREATE TABLE public."oauthRefreshToken" (
  id UUID PRIMARY KEY, token TEXT NOT NULL UNIQUE,
  "clientId" TEXT NOT NULL REFERENCES public."oauthClient"("clientId") ON DELETE CASCADE,
  "sessionId" UUID REFERENCES public."session"(id) ON DELETE SET NULL,
  "userId" UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  "referenceId" TEXT, "authorizationCodeId" TEXT, resources JSONB,
  "requestedUserInfoClaims" JSONB, "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL, revoked TIMESTAMPTZ,
  "rotatedAt" TIMESTAMPTZ, "rotationReplayResponse" TEXT,
  "rotationReplayExpiresAt" TIMESTAMPTZ, "authTime" TIMESTAMPTZ,
  confirmation JSONB, scopes JSONB NOT NULL
);

CREATE TABLE public."oauthAccessToken" (
  id UUID PRIMARY KEY, token TEXT NOT NULL UNIQUE,
  "clientId" TEXT NOT NULL REFERENCES public."oauthClient"("clientId") ON DELETE CASCADE,
  "sessionId" UUID REFERENCES public."session"(id) ON DELETE SET NULL,
  "userId" UUID REFERENCES public."user"(id) ON DELETE CASCADE,
  "referenceId" TEXT, "authorizationCodeId" TEXT, resources JSONB,
  "requestedUserInfoClaims" JSONB,
  "refreshId" UUID REFERENCES public."oauthRefreshToken"(id) ON DELETE CASCADE,
  "expiresAt" TIMESTAMPTZ NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL,
  revoked TIMESTAMPTZ, confirmation JSONB, scopes JSONB NOT NULL
);

CREATE TABLE public."oauthConsent" (
  id UUID PRIMARY KEY,
  "clientId" TEXT NOT NULL REFERENCES public."oauthClient"("clientId") ON DELETE CASCADE,
  "userId" UUID REFERENCES public."user"(id) ON DELETE CASCADE,
  "referenceId" TEXT, resources JSONB, "requestedUserInfoClaims" JSONB,
  scopes JSONB NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

-- A private-key JWT jti is hashed into this opaque text key, not a UUID.
CREATE TABLE public."oauthClientAssertion" (
  id TEXT PRIMARY KEY, "expiresAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX oauth_client_user_idx ON public."oauthClient"("userId");
CREATE INDEX oauth_client_resource_client_idx ON public."oauthClientResource"("clientId");
CREATE INDEX oauth_client_resource_resource_idx ON public."oauthClientResource"("resourceId");
CREATE INDEX oauth_refresh_client_idx ON public."oauthRefreshToken"("clientId");
CREATE INDEX oauth_refresh_session_idx ON public."oauthRefreshToken"("sessionId");
CREATE INDEX oauth_refresh_user_idx ON public."oauthRefreshToken"("userId");
CREATE INDEX oauth_refresh_code_idx ON public."oauthRefreshToken"("authorizationCodeId");
CREATE INDEX oauth_access_client_idx ON public."oauthAccessToken"("clientId");
CREATE INDEX oauth_access_session_idx ON public."oauthAccessToken"("sessionId");
CREATE INDEX oauth_access_user_idx ON public."oauthAccessToken"("userId");
CREATE INDEX oauth_access_code_idx ON public."oauthAccessToken"("authorizationCodeId");
CREATE INDEX oauth_access_refresh_idx ON public."oauthAccessToken"("refreshId");
CREATE INDEX oauth_consent_client_idx ON public."oauthConsent"("clientId");
CREATE INDEX oauth_consent_user_idx ON public."oauthConsent"("userId");
