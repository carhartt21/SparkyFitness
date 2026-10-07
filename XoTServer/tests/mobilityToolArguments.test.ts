import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { mobilityOperationSchema } from '@workspace/shared';
import { normalizeMcpToolArguments } from '../utils/mcpArguments.js';
import { buildChatbotTools } from '../ai/tools/index.js';
import { buildMobilityTools } from '../ai/tools/mobilityTools.js';
import { isToolErrorText } from '../ai/tools/errors.js';
import {
  applyMobilityOperation,
  MobilityConflictError,
  MobilityNotFoundError,
  MobilityValidationError,
} from '../services/mobilityService.js';

vi.mock('../services/foodEntryService', () => ({ default: {} }));
vi.mock('../config/logging', () => ({ log: vi.fn() }));
vi.mock('../services/mobilityService.js', () => ({
  applyMobilityOperation: vi.fn(),
  getMobilitySnapshot: vi.fn(),
  MobilityConflictError: class extends Error {},
  MobilityNotFoundError: class extends Error {},
  MobilityValidationError: class extends Error {},
}));

const routine = {
  id: 'c0f24c4f-a66a-4a61-8d06-a1b0ee32ace0',
  name: 'Synthetic five-minute mobility',
  steps: [
    {
      id: '51822c03-d193-4c1b-a7bc-7b5ad7f9dbf9',
      name: 'Synthetic stretch',
      instructions: '',
      side: 'both',
      exerciseId: null,
      transitionSeconds: 0,
      kind: 'timed',
      durationSeconds: 300,
    },
  ],
  cue: 'both',
  reminderTime: null,
  createdAt: '2026-10-07T08:00:00Z',
  updatedAt: '2026-10-07T08:00:00Z',
};
const operations = [
  { kind: 'routine', data: routine },
  {
    kind: 'schedule',
    data: {
      id: '26e169c8-08b8-4695-8648-99c77e3636a1',
      routineId: routine.id,
      weekdays: [1],
      time: '08:00',
      startDay: '2026-10-07',
      endDay: null,
      enabled: true,
    },
  },
  {
    kind: 'plan',
    data: {
      id: '26e169c8-08b8-4695-8648-99c77e3636a1',
      routine,
      scheduleId: null,
      day: '2026-10-07',
      time: '08:00',
      state: 'planned',
      activeSessionId: null,
    },
  },
];

beforeEach(() => vi.clearAllMocks());

describe('mobility assistant argument boundary', () => {
  it.each(operations)(
    'preserves nullable $kind fields through MCP and in-app chat',
    (mutation) => {
      const input = {
        operationId: 'c9c70ddf-0b09-4a4d-b319-4b9fc0b1aa93',
        expectedRevision: 0,
        mutation,
      };
      const expected = mobilityOperationSchema.parse(input);
      expect(
        mobilityOperationSchema.parse(
          normalizeMcpToolArguments('xot_update_mobility', input)
        )
      ).toEqual(expected);
      const schema = buildChatbotTools('synthetic-mobility', 'UTC')
        .xot_update_mobility.inputSchema;
      expect(schema).toBeInstanceOf(z.ZodType);
      expect((schema as z.ZodType).parse(input)).toEqual(expected);
    }
  );

  const execute = () => {
    const operation = mobilityOperationSchema.parse({
      operationId: 'c9c70ddf-0b09-4a4d-b319-4b9fc0b1aa93',
      expectedRevision: 0,
      mutation: operations[0],
    });
    const tool = buildMobilityTools('synthetic-mobility').xot_update_mobility;
    return tool.execute!(operation, {
      toolCallId: 'synthetic',
      messages: [],
      context: {},
    });
  };

  it.each([
    [new MobilityConflictError('Mobility item changed elsewhere.'), 'CONFLICT'],
    [new MobilityNotFoundError('Routine not found.'), 'NOT_FOUND'],
    [new MobilityValidationError('Exercise is unavailable.'), 'VALIDATION'],
  ])('returns actionable domain errors (%s)', async (error, code) => {
    vi.mocked(applyMobilityOperation).mockRejectedValueOnce(error);
    const result = await execute();
    expect(typeof result).toBe('string');
    expect(isToolErrorText(String(result))).toBe(true);
    expect(result).toContain(`Error [${code}]:`);
    expect(result).toContain('Suggestion:');
    expect(applyMobilityOperation).toHaveBeenCalledTimes(1);
  });

  it('does not swallow unexpected failures or claim success', async () => {
    const error = new Error('synthetic database failure');
    vi.mocked(applyMobilityOperation).mockRejectedValueOnce(error);
    await expect(execute()).rejects.toBe(error);
    expect(applyMobilityOperation).toHaveBeenCalledTimes(1);
  });

  it('returns the server receipt for a valid five-minute routine', async () => {
    vi.mocked(applyMobilityOperation).mockResolvedValueOnce({ revision: 1 });
    expect(await execute()).toBe('{"revision":1}');
    expect(applyMobilityOperation).toHaveBeenCalledWith(
      'synthetic-mobility',
      expect.objectContaining({
        mutation: expect.objectContaining({
          data: expect.objectContaining({
            steps: [
              expect.objectContaining({
                durationSeconds: 300,
                exerciseId: null,
              }),
            ],
          }),
        }),
      }),
      'mcp'
    );
  });
});
