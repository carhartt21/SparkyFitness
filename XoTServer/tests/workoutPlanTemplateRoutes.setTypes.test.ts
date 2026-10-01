import express from 'express';
// @ts-expect-error TS(7016): supertest has no installed declaration in this package.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import workoutPlanTemplateRoutes from '../routes/workoutPlanTemplateRoutes.js';
import workoutPlanTemplateService, {
  preparePlannedActivityExercise,
} from '../services/workoutPlanTemplateService.js';

const actor = vi.hoisted(() => ({ delegated: false }));

vi.mock('../middleware/authMiddleware.js', () => ({
  authenticate: (
    req: { userId?: string; authenticatedUserId?: string },
    _res: unknown,
    next: () => void
  ) => {
    req.userId = 'test-user';
    req.authenticatedUserId = actor.delegated ? 'other-user' : 'test-user';
    next();
  },
}));

vi.mock('../services/workoutPlanTemplateService.js', () => ({
  preparePlannedActivityExercise: vi.fn(),
  default: {
    createWorkoutPlanTemplate: vi.fn(),
    updateWorkoutPlanTemplate: vi.fn(),
  },
}));

const app = express();
app.use(express.json());
app.use('/workout-plan-templates', workoutPlanTemplateRoutes);

const bodyWithSetType = (setType: string) => ({
  plan_name: 'Synthetic plan',
  assignments: [
    {
      day_of_week: 1,
      exercise_id: '00000000-0000-4000-8000-000000000001',
      sets: [{ set_number: 1, set_type: setType }],
    },
  ],
});

describe('workout plan template set-type validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actor.delegated = false;
    vi.mocked(
      workoutPlanTemplateService.createWorkoutPlanTemplate
    ).mockResolvedValue({
      id: 1,
    });
    vi.mocked(
      workoutPlanTemplateService.updateWorkoutPlanTemplate
    ).mockResolvedValue({
      id: 1,
    });
  });

  it('accepts a known label without renaming it', async () => {
    const response = await request(app)
      .post('/workout-plan-templates')
      .send(bodyWithSetType('Drop Set'));

    expect(response.status).toBe(201);
    expect(
      workoutPlanTemplateService.createWorkoutPlanTemplate
    ).toHaveBeenCalledWith('test-user', bodyWithSetType('Drop Set'));
  });

  it.each(['post', 'put'] as const)(
    'rejects unsupported labels on %s before the service writes',
    async (method) => {
      const path =
        method === 'post'
          ? '/workout-plan-templates'
          : '/workout-plan-templates/1';
      const call =
        method === 'post' ? request(app).post(path) : request(app).put(path);
      const response = await call.send(bodyWithSetType('mystery'));

      expect(response.status).toBe(400);
      expect(
        workoutPlanTemplateService.createWorkoutPlanTemplate
      ).not.toHaveBeenCalled();
      expect(
        workoutPlanTemplateService.updateWorkoutPlanTemplate
      ).not.toHaveBeenCalled();
    }
  );
});

describe('planned activity preparation is owner-only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actor.delegated = false;
    vi.mocked(preparePlannedActivityExercise).mockResolvedValue(
      '00000000-0000-4000-8000-000000000001'
    );
  });

  it('prepares the owned assignment without logging completion', async () => {
    const response = await request(app)
      .post('/workout-plan-templates/41/assignments/101/activity-exercise')
      .send({ name: 'Laufen' });
    expect(response.status).toBe(200);
    expect(response.body.exercise_id).toBe(
      '00000000-0000-4000-8000-000000000001'
    );
    expect(preparePlannedActivityExercise).toHaveBeenCalledWith(
      'test-user',
      '41',
      101,
      'Laufen'
    );
  });

  it.each(['0', '-1', '1.5', 'not-an-id'])(
    'rejects invalid assignment %s before writing',
    async (id) => {
      const response = await request(app)
        .post(`/workout-plan-templates/41/assignments/${id}/activity-exercise`)
        .send({ name: 'Laufen' });
      expect(response.status).toBe(400);
      expect(preparePlannedActivityExercise).not.toHaveBeenCalled();
    }
  );

  it('rejects a delegated actor before preparation', async () => {
    actor.delegated = true;
    const response = await request(app)
      .post('/workout-plan-templates/41/assignments/101/activity-exercise')
      .send({ name: 'Laufen' });
    expect(response.status).toBe(403);
    expect(preparePlannedActivityExercise).not.toHaveBeenCalled();
  });
});
