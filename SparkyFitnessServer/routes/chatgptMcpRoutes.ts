import express from 'express';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { requireMcpAuth } from '@better-auth/mcp';
import type { ToolExecutionOptions } from 'ai';
import { z } from 'zod';
import { auth, mcpOAuthResource } from '../auth.js';
import { buildChatbotTools } from '../ai/tools/index.js';
import { READ_ONLY_MCP_TOOL_NAMES } from '../ai/mcp/mcpAdapter.js';
import { checkReadOnlyScope } from '../ai/mcp/readOnlyScope.js';
import { isToolErrorText } from '../ai/tools/errors.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import {
  getEngagementSettings,
  patchEngagementSettings,
  applyEngagementAction,
} from '../services/engagementService.js';
import {
  engagementSettingsPatchSchema,
  engagementActionSchema,
} from '@workspace/shared';
import versionService from '../services/versionService.js';
import { hasActiveMcpConsent } from '../services/mcpConnectionService.js';

const router = express.Router();
const WRITE_TOOLS = new Set([
  'sparky_manage_food',
  'sparky_manage_exercise',
  'sparky_manage_water_containers',
]);
const EXEC_STUB: ToolExecutionOptions<Record<string, unknown>> = {
  toolCallId: 'chatgpt-mcp',
  messages: [],
  context: {},
};
type RegistryTool = {
  description?: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  execute?: (
    args: unknown,
    options: ToolExecutionOptions<Record<string, unknown>>
  ) => Promise<unknown> | unknown;
};

function hasScope(claim: unknown, scope: string): boolean {
  if (typeof claim === 'string') return claim.split(/\s+/).includes(scope);
  return Array.isArray(claim) && claim.includes(scope);
}

function registerTools(
  server: McpServer,
  userId: string,
  tz: string,
  canWrite: boolean
): void {
  const tools = buildChatbotTools(
    userId,
    tz,
    'full',
    false
  ) as unknown as Record<string, RegistryTool>;
  for (const [name, tool] of Object.entries(tools)) {
    const write = WRITE_TOOLS.has(name);
    if (!READ_ONLY_MCP_TOOL_NAMES.has(name) && !write) continue;
    if (write && !canWrite) continue;
    server.registerTool(
      name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: write ? { readOnlyHint: false } : { readOnlyHint: true },
      },
      async (args: unknown) => {
        if (!tool.execute)
          return {
            isError: true,
            content: [{ type: 'text', text: 'Tool unavailable.' }],
          };
        const effectiveArgs =
          !write &&
          name === 'sparky_get_exercise_diary' &&
          args !== null &&
          typeof args === 'object' &&
          !Array.isArray(args)
            ? { ...args, limit: (args as Record<string, unknown>).limit ?? 20 }
            : args;
        const scopeError = write
          ? null
          : checkReadOnlyScope(name, effectiveArgs, tz);
        const output =
          scopeError ?? (await tool.execute(effectiveArgs, EXEC_STUB));
        const content =
          typeof output === 'string' ? output : JSON.stringify(output);
        return {
          isError: isToolErrorText(content),
          content: [{ type: 'text', text: content }],
        };
      }
    );
  }
  server.registerTool(
    'xot_get_notification_settings',
    {
      description: 'Read account notification settings.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(await getEngagementSettings(userId)),
        },
      ],
    })
  );
  if (!canWrite) return;
  server.registerTool(
    'xot_update_notification_settings',
    {
      description:
        'Update account notification settings using the revision from xot_get_notification_settings.',
      inputSchema: engagementSettingsPatchSchema,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async (patch) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(await patchEngagementSettings(userId, patch)),
        },
      ],
    })
  );
  server.registerTool(
    'xot_act_on_reminder',
    {
      description:
        'Snooze or skip a reminder. Supply a unique operation_id for retry-safe execution.',
      inputSchema: engagementActionSchema,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async (action) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(await applyEngagementAction(userId, action)),
        },
      ],
    })
  );
}

if (mcpOAuthResource) {
  const protectedHandler = requireMcpAuth(
    auth,
    async (request, claims) => {
      if (typeof claims.sub !== 'string' || !claims.sub) {
        return new Response('Missing account identity', { status: 403 });
      }
      // Better Auth verifies signed JWT access tokens offline. The consent
      // lookup makes a user-initiated disconnect effective immediately.
      const clientId =
        typeof claims.azp === 'string'
          ? claims.azp
          : typeof claims.client_id === 'string'
            ? claims.client_id
            : null;
      if (!clientId || !(await hasActiveMcpConsent(claims.sub, clientId))) {
        return new Response('Assistant connection was revoked', {
          status: 403,
        });
      }
      const userId = claims.sub;
      const timezone = await loadUserTimezone(userId);
      const canWrite = hasScope(claims.scope, 'mcp:write');
      const handler = createMcpHandler(
        () => {
          const server = new McpServer({
            name: 'x-on-track-chatgpt',
            version: versionService.getAppVersion(),
          });
          registerTools(server, userId, timezone, canWrite);
          return server;
        },
        {
          legacy: 'reject',
          responseMode: 'json',
          maxRequestBodySize: 1_048_576,
        }
      );
      return handler.fetch(request);
    },
    {
      resource: mcpOAuthResource,
      requiredScopes: ['mcp:read'],
      challengeScopes: ['mcp:read', 'mcp:write'],
    }
  );
  const nodeHandler = toNodeHandler({ fetch: protectedHandler });
  router.post('/', (req, res) => {
    void nodeHandler(req, res, req.body);
  });
} else {
  router.post('/', (_req, res) =>
    res.status(503).json({ error: 'mcp_oauth_not_configured' })
  );
}
router.get('/', (_req, res) => res.set('Allow', 'POST').status(405).end());
router.delete('/', (_req, res) => res.set('Allow', 'POST').status(405).end());

export default router;
