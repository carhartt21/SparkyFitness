import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClient } from '../db/poolManager.js';
import workoutPlanTemplateRepository from '../models/workoutPlanTemplateRepository.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));

const USER_ID = '00000000-0000-4000-8000-000000000001';

function createClient(snapshotRowCount = 1) {
  const statements: string[] = [];
  const query = vi.fn(async (sql: string) => {
    statements.push(sql.trim());
    if (sql.includes('INSERT INTO workout_plan_templates')) {
      return { rows: [{ id: 17, is_active: false }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO public.workout_plan_template_versions')) {
      return { rows: [], rowCount: snapshotRowCount };
    }
    if (sql.includes('DELETE FROM workout_plan_templates')) {
      return { rows: [{ id: 17 }], rowCount: 1 };
    }
    if (sql.includes('FROM workout_plan_templates t')) {
      return { rows: [{ id: 17, is_active: false }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  const release = vi.fn();
  vi.mocked(getClient).mockResolvedValue({ query, release } as never);
  return { statements, query, release };
}

describe('workout plan version transactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('captures a new plan before its creation commits', async () => {
    const client = createClient();
    await workoutPlanTemplateRepository.createWorkoutPlanTemplate(
      { user_id: USER_ID, plan_name: 'Monday plan', assignments: [] },
      '2026-09-25'
    );
    const snapshot = client.statements.findIndex((sql) =>
      sql.includes('INSERT INTO public.workout_plan_template_versions')
    );
    expect(snapshot).toBeGreaterThan(0);
    expect(client.statements[snapshot + 1]).toBe('COMMIT');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('effective_from'),
      [17, USER_ID, '2026-09-25', null]
    );
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('captures the edited assignment schedule before its update commits', async () => {
    const client = createClient();
    await workoutPlanTemplateRepository.updateWorkoutPlanTemplate(
      17,
      USER_ID,
      { plan_name: 'Revised', assignments: [] },
      '2026-09-25'
    );
    const snapshot = client.statements.findIndex((sql) =>
      sql.includes('INSERT INTO public.workout_plan_template_versions')
    );
    expect(snapshot).toBeGreaterThan(0);
    expect(client.statements[snapshot + 1]).toBe('COMMIT');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('effective_from'),
      [17, USER_ID, '2026-09-25', null]
    );
  });

  it('records plan deactivation before deletion, and rolls back if history cannot be written', async () => {
    const client = createClient();
    await workoutPlanTemplateRepository.deleteWorkoutPlanTemplate(
      17,
      USER_ID,
      '2026-09-25'
    );
    expect(client.statements.map((sql) => sql.split(' ')[0])).toEqual([
      'BEGIN',
      'INSERT',
      'DELETE',
      'COMMIT',
    ]);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('effective_from'),
      [17, USER_ID, '2026-09-25', false]
    );

    const failed = createClient(0);
    await expect(
      workoutPlanTemplateRepository.deleteWorkoutPlanTemplate(
        17,
        USER_ID,
        '2026-09-25'
      )
    ).rejects.toThrow('Workout plan template not found.');
    expect(failed.statements.map((sql) => sql.split(' ')[0])).toEqual([
      'BEGIN',
      'INSERT',
      'ROLLBACK',
    ]);
  });
});
