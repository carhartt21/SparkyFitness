import { describe, expect, it } from 'vitest';
import {
  defaultCoachingSettings,
  dueCoachingSlot,
  evaluateCoachingOutcome,
  coachingActionSchema,
  coachingRunnerOutputSchema,
  engagementReminderKindSchema,
  engagementReminderKindV2Schema,
  engagementReminderKindV3Schema,
  type CoachingEvidenceRow,
  type CoachingCommitment,
} from '@workspace/shared';
import {
  coachingChildEnvironment,
  coachingCodexArgs,
  COACHING_READ_TOOLS,
} from '../tools/coachingRunner.js';
import {
  coachingStructuredOutputSchema,
  parseCoachingRunnerOutput,
} from '../tools/coachingRunnerSchema.js';

const row = (
  kind: string,
  day: string,
  value: CoachingEvidenceRow['value'],
  confirmation: CoachingEvidenceRow['confirmation'] = 'confirmed'
): CoachingEvidenceRow => ({
  id: `${kind}:${day}:${JSON.stringify(value)}`,
  domain: 'nutrition',
  kind,
  day,
  value,
  confirmation,
  observedAt: null,
  source: 'synthetic',
});
const success: CoachingCommitment['success'] = {
  metric: 'protein',
  subjectId: null,
  unit: 'g',
  baseline: null,
  target: 80,
  direction: 'minimum',
  minimumCoverage: 0.7,
  reviewDay: '2026-10-01',
};
const evaluate = (
  rows: CoachingEvidenceRow[],
  patch: Partial<typeof success> = {},
  from = '2026-09-28'
) =>
  evaluateCoachingOutcome({
    rows,
    success: { ...success, ...patch },
    from,
    to: '2026-10-01',
    today: '2026-10-01',
    now: new Date('2026-10-01T12:00:00Z'),
  });
describe('coaching scheduling and confirmed outcomes', () => {
  it('uses account-local editable slots, prioritizes the weekly review and coalesces missed runs', () => {
    const slot = dueCoachingSlot({
      now: new Date('2026-09-27T07:05:00Z'),
      timezone: 'Europe/Berlin',
      settings: { ...defaultCoachingSettings, enabled: true },
      lastCompletedAt: null,
      lastWeeklyCompletedAt: null,
    });
    expect(slot?.kind).toBe('weekly');
    expect(slot?.scheduledAt.toISOString()).toBe('2026-09-27T07:00:00.000Z');
    expect(slot?.from).toBe('2026-08-31');
    expect(
      dueCoachingSlot({
        now: new Date(),
        timezone: 'Europe/Berlin',
        settings: defaultCoachingSettings,
        lastCompletedAt: null,
        lastWeeklyCompletedAt: null,
      })
    ).toBeNull();
  });
  it('keeps missing days unknown and never evaluates unconfirmed intake as success', () => {
    const nutrition = {
      nutrients: { protein: { value: 90, knownEntries: 1, totalEntries: 1 } },
      completeDay: false,
    };
    expect(
      evaluate([row('nutrition_day', '2026-10-01', nutrition)]).interpretation
    ).toBe('insufficient_data');
    expect(
      evaluate(
        [row('nutrition_day', '2026-10-01', nutrition, 'unconfirmed')],
        {},
        '2026-10-01'
      ).value
    ).toBeNull();
    expect(
      evaluate(
        [row('nutrition_day', '2026-10-01', nutrition)],
        {},
        '2026-10-01'
      ).interpretation
    ).toBe('met');
  });
  it('requires complete diary coverage for maximum nutrient targets and rejects missing nutrient values', () => {
    const data = {
      nutrients: { protein: { value: 50, knownEntries: 1, totalEntries: 1 } },
      completeDay: false,
    };
    expect(
      evaluate(
        [row('nutrition_day', '2026-10-01', data)],
        { direction: 'maximum' },
        '2026-10-01'
      ).value
    ).toBeNull();
    expect(
      evaluate(
        [row('nutrition_day', '2026-10-01', { ...data, completeDay: true })],
        { direction: 'maximum' },
        '2026-10-01'
      ).interpretation
    ).toBe('met');
    expect(
      evaluate(
        [
          row('nutrition_day', '2026-10-01', {
            nutrients: {
              protein: { value: 90, knownEntries: 1, totalEntries: 2 },
            },
          }),
        ],
        {},
        '2026-10-01'
      ).value
    ).toBeNull();
  });
  it('does not add two providers’ daily activity summaries', () => {
    expect(
      evaluate(
        [
          row('daily_activity', '2026-10-01', { total_steps: 4000 }),
          row('daily_activity', '2026-10-01', { total_steps: 4500 }),
        ],
        { metric: 'steps', unit: 'steps' },
        '2026-10-01'
      ).value
    ).toBe(4500);
  });
  it('weights workout and meal adherence by scheduled occurrences, preserving skipped outcomes', () => {
    const result = evaluate(
      [
        row('workout_adherence', '2026-09-28', {
          templateId: 1,
          eligible: 2,
          completed: 1,
          completionBasis: 'saved_prescription',
          ratio: 0.5,
        }),
        row('workout_adherence', '2026-09-30', {
          templateId: 1,
          eligible: 1,
          completed: 1,
          completionBasis: 'saved_prescription',
          ratio: 1,
        }),
      ],
      {
        metric: 'workout_completion',
        unit: 'ratio',
        subjectId: '1',
        target: 0.8,
      }
    );
    expect(result.value).toBeCloseTo(2 / 3);
    expect(result.interpretation).toBe('below_target');
    expect(
      evaluate(
        [
          row('meal_occurrence', '2026-09-28', {
            template_id: 'plan',
            state: 'confirmed',
          }),
          row('meal_occurrence', '2026-09-28', {
            template_id: 'plan',
            state: 'skipped',
          }),
          row('meal_occurrence', '2026-09-28', {
            template_id: 'other',
            state: 'confirmed',
          }),
        ],
        {
          metric: 'meal_confirmation',
          unit: 'ratio',
          subjectId: 'plan',
          target: 0.8,
        }
      ).value
    ).toBe(0.5);
  });
  it('keeps v1 and v2 strict while v3 advertises coaching kinds', () => {
    for (const kind of ['coaching_digest', 'coaching_action']) {
      expect(engagementReminderKindSchema.safeParse(kind).success).toBe(false);
      expect(engagementReminderKindV2Schema.safeParse(kind).success).toBe(
        false
      );
      expect(engagementReminderKindV3Schema.safeParse(kind).success).toBe(true);
    }
    expect(
      coachingRunnerOutputSchema.parse({
        proposals: [],
        summary: 'No evidence available',
      })
    ).toEqual({
      proposals: [],
      summary: 'No evidence available',
    });
    expect(
      coachingActionSchema.safeParse({ kind: 'medication', dose: 2 }).success
    ).toBe(false);
  });
  it('counts only eligible habit days and explicit complete mobility step outcomes', () => {
    expect(
      evaluate(
        [
          row('habit_definition', '', { id: 'habit', days: [1, 3], target: 1 }),
          row('habit_log', '2026-09-28', {
            category_id: 'habit',
            value: 1,
            target: 1,
          }),
          row('habit_log', '2026-09-30', {
            category_id: 'habit',
            value: 0,
            target: 1,
          }),
        ],
        {
          metric: 'habit_completion',
          unit: 'ratio',
          subjectId: 'habit',
          target: 0.8,
        }
      ).coverage
    ).toBe(1);
    const session = {
      routine: { id: 'routine', steps: [{ id: 'a' }, { id: 'b' }] },
      state: 'finished',
      outcomes: [],
    };
    const measure = {
      metric: 'mobility_completion' as const,
      unit: 'ratio',
      subjectId: 'routine',
      target: 1,
    };
    expect(
      evaluate(
        [row('mobility_session', '2026-10-01', session)],
        measure,
        '2026-10-01'
      ).value
    ).toBeNull();
    expect(
      evaluate(
        [
          row('mobility_session', '2026-10-01', {
            ...session,
            outcomes: [
              { stepId: 'a', result: 'completed' },
              { stepId: 'b', result: 'skipped' },
            ],
          }),
        ],
        measure,
        '2026-10-01'
      ).value
    ).toBe(0.5);
  });
});
describe('subscription runner boundary', () => {
  it('narrows generated actions and metrics to selected domains without empty provider unions', () => {
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) return value.forEach(visit);
      const current = value as Record<string, unknown>;
      if (Array.isArray(current.anyOf))
        expect(current.anyOf.length).toBeGreaterThan(0);
      Object.values(current).forEach(visit);
    };
    for (const domain of [
      'nutrition',
      'activity',
      'recovery',
      'habits',
      'measurements',
    ] as const)
      visit(coachingStructuredOutputSchema([domain]));
    const nutrition = JSON.stringify(
      coachingStructuredOutputSchema(['nutrition'])
    );
    expect(nutrition).not.toContain(
      '"metric":{"type":"string","const":"habit_completion"}'
    );
    expect(nutrition).toContain('"metric":{"type":"string","const":"protein"}');
  });
  it('omits provider null placeholders while preserving explicit nullable clears and rejecting unknown fields', () => {
    const proposal = {
      topic: 'synthetic-notification-review',
      domain: 'recovery',
      title: 'Review quiet hours',
      rationale: 'Synthetic evidence.',
      impact: 1,
      benefit: 'Choose useful reminder settings.',
      effort: 'low',
      confidence: 0.3,
      evidence: [
        {
          rowIds: ['coverage:recovery'],
          from: '2026-09-25',
          to: '2026-10-01',
          coverage: 0,
          freshness: 'unknown',
          unit: null,
          limitation: 'Synthetic sample.',
        },
      ],
      success: {
        metric: 'sleep_minutes',
        subjectId: null,
        unit: 'min',
        baseline: null,
        target: 420,
        direction: 'minimum',
        minimumCoverage: 0.7,
        reviewDay: '2026-10-08',
      },
      action: {
        kind: 'notification_settings',
        changes: { daily_limit: null, hydration_enabled: null },
      },
      expiresDay: '2026-10-15',
    };
    const result = parseCoachingRunnerOutput({
      proposals: [proposal],
      summary: 'Synthetic check',
    });
    expect(result.proposals[0].action).toEqual({
      kind: 'notification_settings',
      changes: { daily_limit: null },
    });
    expect(() =>
      parseCoachingRunnerOutput({
        proposals: [
          {
            ...proposal,
            action: {
              ...proposal.action,
              changes: { ...proposal.action.changes, invented_field: null },
            },
          },
        ],
        summary: 'Synthetic check',
      })
    ).toThrow();
  });
  it('converts discriminated unions and optional fields to the provider subset while retaining validation', () => {
    const schema = coachingStructuredOutputSchema();
    expect(JSON.stringify(schema)).not.toContain('"oneOf"');
    expect(JSON.stringify(schema)).toContain(
      '"metric":{"type":"string","const":"habit_completion"}'
    );
    expect(JSON.stringify(schema)).toContain(
      '"unit":{"type":"string","const":"ratio"}'
    );
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) return value.forEach(visit);
      const current = value as Record<string, unknown>;
      if (current.properties) {
        expect(current.required).toEqual(Object.keys(current.properties));
        expect(current.additionalProperties).toBe(false);
      }
      Object.values(current).forEach(visit);
    };
    visit(schema);
    expect(
      parseCoachingRunnerOutput({ proposals: [], summary: 'Synthetic' })
    ).toEqual({ proposals: [], summary: 'Synthetic' });
    expect(() =>
      parseCoachingRunnerOutput({
        proposals: [{ action: { kind: 'medication' } }],
        summary: '',
      })
    ).toThrow();
  });
  it('forces ChatGPT login, ignores user integrations, and supplies only three read tools', () => {
    const args = coachingCodexArgs(
      { url: 'http://localhost:3010/mcp', model: 'synthetic-model' },
      '/tmp/isolated'
    );
    expect(args).toContain('--ignore-user-config');
    expect(args).toContain('--ignore-rules');
    expect(args).toContain('--ephemeral');
    expect(args).toContain('read-only');
    expect(args).toContain('code_mode_host');
    expect(args[args.indexOf('code_mode_host') - 1]).toBe('--enable');
    for (const feature of [
      'goals',
      'skill_search',
      'sleep_tool',
      'auth_elicitation',
    ])
      expect(args[args.indexOf(feature) - 1]).toBe('--disable');
    expect(args).toContain('forced_login_method="chatgpt"');
    expect(args).toContain('mcp_servers.xot.required=true');
    expect(args).toContain(
      `mcp_servers.xot.enabled_tools=${JSON.stringify(COACHING_READ_TOOLS)}`
    );
    expect(COACHING_READ_TOOLS).not.toContain('xot_submit_coaching_proposals');
    const env = coachingChildEnvironment(
      { key: 'synthetic-agent-key' },
      {
        HOME: '/test',
        CODEX_HOME: '/saved-auth',
        OPENAI_API_KEY: 'never-forward',
        GEMINI_API_KEY: 'never-forward',
      }
    );
    expect(env).toEqual({
      HOME: '/test',
      CODEX_HOME: '/saved-auth',
      XOT_AGENT_KEY: 'synthetic-agent-key',
    });
  });
});
