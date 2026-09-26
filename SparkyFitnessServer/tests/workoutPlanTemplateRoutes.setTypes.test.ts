import express from 'express';
// @ts-expect-error TS(7016): supertest has no installed declaration in this package.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import workoutPlanTemplateRoutes from '../routes/workoutPlanTemplateRoutes.js';
import workoutPlanTemplateService from '../services/workoutPlanTemplateService.js';

vi.mock('../middleware/authMiddleware.js', () => ({
  authenticate: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = 'test-user';
    next();
  },
}));

vi.mock('../services/workoutPlanTemplateService.js', () => ({
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
    { day_of_week: 1, sets: [{ set_number: 1, set_type: setType }] },
  ],
});

describe('workout plan template set-type validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
