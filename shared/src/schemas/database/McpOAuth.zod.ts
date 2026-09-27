import { z } from "zod";

// Better Auth owns these rows and their camel-case column names. Application
// routes never expose raw tokens, key material, or authorization codes.
const id = z.uuid();
const clientId = z.string().min(1);
const userId = z.uuid();
const date = z.date();

export const oauthClientDatabaseSchema = z.object({
  id,
  clientId,
  clientSecret: z.string().nullable(),
  userId: userId.nullable(),
  name: z.string().nullable(),
  redirectUris: z.array(z.string()),
  scopes: z.array(z.string()).nullable(),
  createdAt: date.nullable(),
  updatedAt: date.nullable(),
});
export const oauthResourceDatabaseSchema = z.object({
  id,
  identifier: z.string().url(),
  name: z.string(),
  allowedScopes: z.array(z.string()).nullable(),
  disabled: z.boolean().nullable(),
});
export const oauthClientResourceDatabaseSchema = z.object({
  id,
  clientId,
  resourceId: z.string().url(),
});
export const oauthAccessTokenDatabaseSchema = z.object({
  id,
  token: z.string(),
  clientId,
  userId,
  sessionId: id.nullable(),
  refreshId: id.nullable(),
  scopes: z.array(z.string()),
  expiresAt: date,
  createdAt: date,
  revoked: date.nullable(),
});
export const oauthRefreshTokenDatabaseSchema = z.object({
  id,
  token: z.string(),
  clientId,
  userId,
  sessionId: id.nullable(),
  scopes: z.array(z.string()),
  expiresAt: date,
  createdAt: date,
  revoked: date.nullable(),
});
export const oauthConsentDatabaseSchema = z.object({
  id,
  clientId,
  userId: userId.nullable(),
  scopes: z.array(z.string()),
  createdAt: date,
  updatedAt: date,
});
export const oauthJwksDatabaseSchema = z.object({
  id,
  publicKey: z.string(),
  privateKey: z.string(),
  createdAt: date,
  expiresAt: date.nullable(),
});
export const oauthClientAssertionDatabaseSchema = z.object({
  id: z.string(),
  expiresAt: date,
});
