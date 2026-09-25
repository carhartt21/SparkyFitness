import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolExecutionOptions } from 'ai';
import { buildChatbotTools } from '../tools/index.js';
import { buildDevTools } from '../tools/devTools.js';
import { isToolErrorText } from '../tools/errors.js';
import { readOnlyEvidenceContext } from './readOnlyEvidenceContext.js';
import { checkReadOnlyScope } from './readOnlyScope.js';

// Registry handlers read only rawArgs (no abortSignal/messages/context), so a
// stub satisfies the execute() signature.
const EXEC_STUB: ToolExecutionOptions<Record<string, unknown>> = {
  toolCallId: 'mcp',
  messages: [],
  context: {},
};

// The slice of an AI-SDK tool() this adapter uses; inputSchema is the bare
// zod-4 object and execute returns a plain string by the registry contract.
interface RegistryTool {
  description?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute?: (
    args: unknown,
    options: ToolExecutionOptions<Record<string, unknown>>
  ) => Promise<any> | any;
}

// Reviewed tools whose entire execution surface is a query. Mixed-action
// manage_* tools are deliberately absent even when they offer read actions.
export const READ_ONLY_MCP_TOOL_NAMES = new Set([
  'sparky_list_exercises',
  'sparky_get_exercise_details',
  'sparky_search_exercises',
  'sparky_get_exercise_diary',
  'sparky_get_daily_exercise_totals',
  'sparky_get_recent_exercise_entries',
  'sparky_get_exercise_usage',
  'sparky_get_exercise_progress',
  'sparky_get_exercise_stats',
  'sparky_list_foods',
  'sparky_get_food_details',
  'sparky_search_foods',
  'sparky_get_food_diary',
  'sparky_get_nutrition_summary',
  'sparky_get_recent_food_entries',
  'sparky_get_food_usage',
  'sparky_get_goal_snapshot',
  'sparky_get_synced_data',
  'sparky_get_integrations',
]);

function readOnlyArgs(toolName: string, rawArgs: unknown): unknown {
  if (
    toolName !== 'sparky_get_exercise_diary' ||
    rawArgs === null ||
    typeof rawArgs !== 'object' ||
    Array.isArray(rawArgs)
  ) {
    return rawArgs;
  }
  const args = rawArgs as Record<string, unknown>;
  // The full chatbot keeps its historical unpaged diary shape. A delegated
  // key always requests entry pages, even when the client omits a limit.
  return { ...args, limit: args.limit ?? 20 };
}

// Registers a name->tool map onto an McpServer, reusing each tool's zod-4 schema
// and execute(). Shared by the registry and dev-tool registration so both wrap
// the plain-string return into MCP { content: [...] } identically.
function registerToolMap(
  mcpServer: McpServer,
  tools: Record<string, RegistryTool>,
  readOnlyTz?: string
): void {
  for (const [name, t] of Object.entries(tools)) {
    const readOnlyDescription =
      readOnlyTz === undefined
        ? t.description
        : `${t.description ?? ''}\n\nRead-only MCP key: at most 50 top-level records per page and offset 1,000; exercise-diary sets are nested under their entries. Diary ranges are at most 7 days and other ranges at most 31 days. Exercise progress and stats require explicit dates (start_date and end_date); progress does not accept date. Stats support only stats_summary or query_activities (pages 1–20).`;
    mcpServer.registerTool(
      name,
      // registerTool validates args against this flat schema, then execute()
      // re-parses with its strict per-action union — double-validation is fine.
      { description: readOnlyDescription, inputSchema: t.inputSchema },
      async (args: unknown) => {
        const effectiveArgs =
          readOnlyTz === undefined ? args : readOnlyArgs(name, args);
        const scopeError =
          readOnlyTz === undefined
            ? null
            : checkReadOnlyScope(name, effectiveArgs, readOnlyTz);
        const out = scopeError ?? (await t.execute!(effectiveArgs, EXEC_STUB));
        // Registry handlers return plain strings; guard anyway.
        const text = typeof out === 'string' ? out : JSON.stringify(out);
        const failed = isToolErrorText(text);
        // Registry failures come back as ERRORS.* strings by contract; flag
        // them so MCP clients can distinguish failures from results instead
        // of parsing prose.
        return {
          content: [
            { type: 'text' as const, text },
            ...(readOnlyTz !== undefined && !failed
              ? [
                  {
                    type: 'text' as const,
                    text: readOnlyEvidenceContext(
                      name,
                      effectiveArgs,
                      readOnlyTz,
                      text
                    ),
                  },
                ]
              : []),
          ],
          ...(failed ? { isError: true } : {}),
        };
      }
    );
  }
}

// Re-publishes the in-process chatbot tool registry as MCP tools, reusing each
// tool's zod-4 schema and execute() so MCP clients and the chatbot share one
// surface with identical output text.
export function registerRegistryTools(
  mcpServer: McpServer,
  userId: string,
  tz: string,
  profile: 'full' | 'core' = 'full',
  readOnly = false
): void {
  // providerTuning=false: MCP publishes schemas over JSON-RPC, so the
  // chat-only provider settings (strict flag, Anthropic cache breakpoint)
  // are skipped for a clean provider-independent surface.
  const tools = buildChatbotTools(
    userId,
    tz,
    profile,
    false
  ) as unknown as Record<string, RegistryTool>;
  registerToolMap(
    mcpServer,
    readOnly
      ? Object.fromEntries(
          Object.entries(tools).filter(([name]) =>
            READ_ONLY_MCP_TOOL_NAMES.has(name)
          )
        )
      : tools,
    readOnly ? tz : undefined
  );
}

// Registers the admin-only dev tools (kept out of buildChatbotTools so the
// chatbot never sees them). The route gates this on DEV_TOOLS_ENABLED + an admin
// caller, so non-admins never get these in tools/list.
export function registerDevTools(mcpServer: McpServer, userId: string): void {
  const tools = buildDevTools(userId) as unknown as Record<
    string,
    RegistryTool
  >;
  registerToolMap(mcpServer, tools);
}
