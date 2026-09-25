import { vi, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'supe... Remove this comment to see the full error message
import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import measurementService from '../services/measurementService.js';
import errorHandler from '../middleware/errorHandler.js';
import waterIntakeRoutes from '../routes/v2/waterIntakeRoutes.js';
import { WaterActionConflictError } from '../models/measurementRepository.js';
import {
  ContainerWaterActionError,
  createContainerWaterAction,
} from '../services/containerWaterActionService.js';
vi.mock('../services/containerWaterActionService.js', () => ({
  createContainerWaterAction: vi.fn(),
  ContainerWaterActionError: class ContainerWaterActionError extends Error {
    constructor(
      readonly statusCode: 404 | 409,
      message: string
    ) {
      super(message);
    }
  },
}));
vi.mock('../services/measurementService.js', () => ({
  default: {
    getWaterIntakeEntryById: vi.fn(),
    getWaterIntake: vi.fn(),
    upsertWaterIntake: vi.fn(),
    logManualWaterAction: vi.fn(),
    updateWaterIntake: vi.fn(),
    deleteWaterIntake: vi.fn(),
    getWaterIntakeLog: vi.fn(),
    deleteWaterIntakeLogEntry: vi.fn(),
    updateWaterIntakeLogTime: vi.fn(),
  },
}));

vi.mock('../middleware/checkPermissionMiddleware.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: vi.fn(() => (req: any, res: any, next: any) => next()),
}));

vi.mock('../middleware/onBehalfOfMiddleware.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (req: any, res: any, next: any) => next(),
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const injectUser = (req: any, res: any, next: any) => {
  req.userId = 'test-user-id';
  next();
};
const app = express();
app.use(express.json());
app.use(injectUser);
app.use('/api/v2/measurements', waterIntakeRoutes);
app.use(errorHandler);
const VALID_UUID = uuidv4();
const manualAction = {
  client_operation_id: VALID_UUID,
  entry_date: '2026-09-24',
  water_ml: 250,
  logged_at: '2026-09-24T12:00:00.000Z',
};
const containerAction = {
  client_operation_id: VALID_UUID,
  entry_date: '2026-09-24',
  container_id: 7,
  logged_at: '2026-09-24T08:30:00.000Z',
};
describe('Water Intake Routes (v2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe('POST /api/v2/measurements/water-intake/container-actions', () => {
    it('passes a valid operation through and returns its result', async () => {
      vi.mocked(createContainerWaterAction).mockResolvedValue({
        waterLogId: VALID_UUID,
        foodEntryId: null,
        waterMl: 250,
        alreadyApplied: false,
        totals: { water_ml: 250, manual_ml: 250, ledger_ml: 250, food_ml: 0 },
      });
      const response = await request(app)
        .post('/api/v2/measurements/water-intake/container-actions')
        .send(containerAction);
      expect(response.statusCode).toBe(200);
      expect(createContainerWaterAction).toHaveBeenCalledWith(
        'test-user-id',
        'test-user-id',
        containerAction
      );
    });

    it('rejects malformed actions before writing and maps conflicts', async () => {
      const invalid = await request(app)
        .post('/api/v2/measurements/water-intake/container-actions')
        .send({ ...containerAction, container_id: -1 });
      expect(invalid.statusCode).toBe(400);
      expect(createContainerWaterAction).not.toHaveBeenCalled();

      vi.mocked(createContainerWaterAction).mockRejectedValue(
        new ContainerWaterActionError(409, 'Operation ID conflict')
      );
      const conflict = await request(app)
        .post('/api/v2/measurements/water-intake/container-actions')
        .send(containerAction);
      expect(conflict.statusCode).toBe(409);
    });
  });
  describe('POST /api/v2/measurements/water-intake/manual-actions', () => {
    it('passes a valid action to the service and returns its replay status', async () => {
      const result = {
        id: VALID_UUID,
        alreadyApplied: true,
        totals: { water_ml: 250, manual_ml: 250, ledger_ml: 250, food_ml: 0 },
      };
      vi.mocked(measurementService.logManualWaterAction).mockResolvedValue(
        result
      );
      const response = await request(app)
        .post('/api/v2/measurements/water-intake/manual-actions')
        .send(manualAction);
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(result);
      expect(measurementService.logManualWaterAction).toHaveBeenCalledWith(
        'test-user-id',
        'test-user-id',
        manualAction
      );
    });

    it('rejects invalid volumes before writing', async () => {
      const response = await request(app)
        .post('/api/v2/measurements/water-intake/manual-actions')
        .send({ ...manualAction, water_ml: -10 });
      expect(response.statusCode).toBe(400);
      expect(measurementService.logManualWaterAction).not.toHaveBeenCalled();
    });

    it('accepts three decimal places despite binary floating-point rounding', async () => {
      vi.mocked(measurementService.logManualWaterAction).mockResolvedValue({
        id: VALID_UUID,
        alreadyApplied: false,
        totals: {
          water_ml: 1.001,
          manual_ml: 1.001,
          ledger_ml: 1.001,
          food_ml: 0,
        },
      });
      const response = await request(app)
        .post('/api/v2/measurements/water-intake/manual-actions')
        .send({ ...manualAction, water_ml: 1.001 });
      expect(response.statusCode).toBe(200);
    });

    it('returns a conflict for a reused operation ID with changed data', async () => {
      vi.mocked(measurementService.logManualWaterAction).mockRejectedValue(
        new WaterActionConflictError()
      );
      const response = await request(app)
        .post('/api/v2/measurements/water-intake/manual-actions')
        .send(manualAction);
      expect(response.statusCode).toBe(409);
    });
  });
  // ---------------------------------------------------------------------------
  // GET /entry/:id
  // ---------------------------------------------------------------------------
  describe('GET /api/v2/measurements/water-intake/entry/:id', () => {
    it('returns a water intake entry by ID', async () => {
      const entry = { id: VALID_UUID, water_ml: 250, entry_date: '2023-01-01' };
      // @ts-expect-error TS(2339): Property 'mockResolvedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.getWaterIntakeEntryById.mockResolvedValue(entry);
      const res = await request(app).get(
        `/api/v2/measurements/water-intake/entry/${VALID_UUID}`
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(entry);
      expect(measurementService.getWaterIntakeEntryById).toHaveBeenCalledWith(
        'test-user-id',
        VALID_UUID
      );
    });
    it('returns 404 when entry does not exist', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.getWaterIntakeEntryById.mockRejectedValue(
        new Error('Water intake entry not found.')
      );
      const res = await request(app).get(
        `/api/v2/measurements/water-intake/entry/${VALID_UUID}`
      );
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'Water intake entry not found.');
    });
    it('returns 403 when access is forbidden', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.getWaterIntakeEntryById.mockRejectedValue(
        new Error('Forbidden: you do not have access to this entry.')
      );
      const res = await request(app).get(
        `/api/v2/measurements/water-intake/entry/${VALID_UUID}`
      );
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/^Forbidden/);
    });
  });
  // ---------------------------------------------------------------------------
  // GET /:date
  // ---------------------------------------------------------------------------
  describe('GET /api/v2/measurements/water-intake/:date', () => {
    it('returns water intake data for a date', async () => {
      const data = {
        date: '2023-01-01',
        total_water_ml: 500,
        entries: [{ id: VALID_UUID, water_ml: 250 }],
      };
      // @ts-expect-error TS(2339): Property 'mockResolvedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.getWaterIntake.mockResolvedValue(data);
      const res = await request(app).get(
        '/api/v2/measurements/water-intake/2023-01-01'
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(data);
      expect(measurementService.getWaterIntake).toHaveBeenCalledWith(
        'test-user-id',
        'test-user-id',
        '2023-01-01'
      );
    });
    it('returns 403 when access is forbidden', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.getWaterIntake.mockRejectedValue(
        new Error('Forbidden: access denied.')
      );
      const res = await request(app).get(
        '/api/v2/measurements/water-intake/2023-01-01'
      );
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/^Forbidden/);
    });
    it('passes the food-derived water breakdown through unchanged (#1557, #1629)', async () => {
      const data = {
        water_ml: 750,
        manual_ml: 250,
        ledger_ml: 250,
        food_ml: 500,
      };
      // @ts-expect-error TS(2339): Property 'mockResolvedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.getWaterIntake.mockResolvedValue(data);
      const res = await request(app).get(
        '/api/v2/measurements/water-intake/2023-01-01'
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(data);
    });
    it('delegates unexpected service errors to the error handler', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.getWaterIntake.mockRejectedValue(
        new Error('DB connection failed')
      );
      const res = await request(app).get(
        '/api/v2/measurements/water-intake/2023-01-01'
      );
      expect(res.statusCode).toBe(500);
    });
  });
  // ---------------------------------------------------------------------------
  // POST /
  // ---------------------------------------------------------------------------
  describe('POST /api/v2/measurements/water-intake', () => {
    it('upserts a water intake entry and returns 200', async () => {
      const result = {
        id: VALID_UUID,
        water_ml: 250,
        entry_date: '2023-01-01',
      };
      // @ts-expect-error TS(2339): Property 'mockResolvedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.upsertWaterIntake.mockResolvedValue(result);
      const res = await request(app)
        .post('/api/v2/measurements/water-intake')
        .send({ entry_date: '2023-01-01', change_drinks: 1, container_id: 2 });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(result);
      expect(measurementService.upsertWaterIntake).toHaveBeenCalledWith(
        'test-user-id',
        'test-user-id',
        '2023-01-01',
        1,
        2
      );
    });
    it('returns 400 when entry_date is missing', async () => {
      const res = await request(app)
        .post('/api/v2/measurements/water-intake')
        .send({ change_drinks: 1 });
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid request body');
      expect(measurementService.upsertWaterIntake).not.toHaveBeenCalled();
    });
    it('returns 400 when change_drinks is missing', async () => {
      const res = await request(app)
        .post('/api/v2/measurements/water-intake')
        .send({ entry_date: '2023-01-01' });
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid request body');
      expect(measurementService.upsertWaterIntake).not.toHaveBeenCalled();
    });
    it('returns 403 when access is forbidden', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.upsertWaterIntake.mockRejectedValue(
        new Error('Forbidden: access denied.')
      );
      const res = await request(app)
        .post('/api/v2/measurements/water-intake')
        .send({
          entry_date: '2023-01-01',
          change_drinks: 1,
          container_id: null,
        });
      // The route should catch the Forbidden error and return 403
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/^Forbidden/);
    });
  });
  // ---------------------------------------------------------------------------
  // PUT /:id
  // ---------------------------------------------------------------------------
  describe('PUT /api/v2/measurements/water-intake/:id', () => {
    it('updates a water intake entry and returns 200', async () => {
      const updated = { id: VALID_UUID, water_ml: 300 };
      // @ts-expect-error TS(2339): Property 'mockResolvedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.updateWaterIntake.mockResolvedValue(updated);
      const res = await request(app)
        .put(`/api/v2/measurements/water-intake/${VALID_UUID}`)
        .send({ water_ml: 300 });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(updated);
      expect(measurementService.updateWaterIntake).toHaveBeenCalledWith(
        'test-user-id',
        'test-user-id',
        VALID_UUID,
        expect.objectContaining({ water_ml: 300 })
      );
    });
    it('returns 404 when entry does not exist', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.updateWaterIntake.mockRejectedValue(
        new Error('Water intake entry not found.')
      );
      const res = await request(app)
        .put(`/api/v2/measurements/water-intake/${VALID_UUID}`)
        .send({ water_ml: 300 });
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'Water intake entry not found.');
    });
    it('returns 404 with not authorized message', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.updateWaterIntake.mockRejectedValue(
        new Error('Water intake entry not found or not authorized to update.')
      );
      const res = await request(app)
        .put(`/api/v2/measurements/water-intake/${VALID_UUID}`)
        .send({ water_ml: 300 });
      expect(res.statusCode).toBe(404);
    });
    it('returns 403 when access is forbidden', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.updateWaterIntake.mockRejectedValue(
        new Error('Forbidden: access denied.')
      );
      const res = await request(app)
        .put(`/api/v2/measurements/water-intake/${VALID_UUID}`)
        .send({ water_ml: 300 });
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/^Forbidden/);
    });
  });
  // ---------------------------------------------------------------------------
  // DELETE /:id
  // ---------------------------------------------------------------------------
  describe('DELETE /api/v2/measurements/water-intake/:id', () => {
    it('deletes a water intake entry and returns 200', async () => {
      const result = { success: true, id: VALID_UUID };
      // @ts-expect-error TS(2339): Property 'mockResolvedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.deleteWaterIntake.mockResolvedValue(result);
      const res = await request(app).delete(
        `/api/v2/measurements/water-intake/${VALID_UUID}`
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(result);
      expect(measurementService.deleteWaterIntake).toHaveBeenCalledWith(
        'test-user-id',
        'test-user-id',
        VALID_UUID
      );
    });
    it('returns 404 when entry does not exist', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.deleteWaterIntake.mockRejectedValue(
        new Error('Water intake entry not found.')
      );
      const res = await request(app).delete(
        `/api/v2/measurements/water-intake/${VALID_UUID}`
      );
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'Water intake entry not found.');
    });
    it('returns 404 with not authorized message', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.deleteWaterIntake.mockRejectedValue(
        new Error('Water intake entry not found or not authorized to delete.')
      );
      const res = await request(app).delete(
        `/api/v2/measurements/water-intake/${VALID_UUID}`
      );
      expect(res.statusCode).toBe(404);
    });
    it('returns 403 when access is forbidden', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.deleteWaterIntake.mockRejectedValue(
        new Error('Forbidden: access denied.')
      );
      const res = await request(app).delete(
        `/api/v2/measurements/water-intake/${VALID_UUID}`
      );
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/^Forbidden/);
    });
  });
  // ---------------------------------------------------------------------------
  // GET /log/:date — list drink-by-drink log entries
  // ---------------------------------------------------------------------------
  describe('GET /api/v2/measurements/water-intake/log/:date', () => {
    it('returns log entries for a date', async () => {
      const entries = [
        {
          id: VALID_UUID,
          water_ml: 250,
          entry_date: '2023-01-01',
          logged_at: '2023-01-01T08:00:00Z',
        },
      ];
      // @ts-expect-error TS(2339): Property 'mockResolvedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.getWaterIntakeLog.mockResolvedValue(entries);
      const res = await request(app).get(
        '/api/v2/measurements/water-intake/2023-01-01/log'
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(entries);
      expect(measurementService.getWaterIntakeLog).toHaveBeenCalledWith(
        'test-user-id',
        'test-user-id',
        '2023-01-01'
      );
    });

    it('delegates unexpected errors to error handler', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.getWaterIntakeLog.mockRejectedValue(
        new Error('DB error')
      );
      const res = await request(app).get(
        '/api/v2/measurements/water-intake/2023-01-01/log'
      );
      expect(res.statusCode).toBe(500);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /log/:id — delete a drink-by-drink log entry
  // ---------------------------------------------------------------------------
  describe('DELETE /api/v2/measurements/water-intake/log/:id', () => {
    it('deletes a log entry and returns 200', async () => {
      const result = {
        message: 'Water intake log entry deleted successfully.',
      };
      // @ts-expect-error TS(2339): Property 'mockResolvedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.deleteWaterIntakeLogEntry.mockResolvedValue(result);
      const res = await request(app).delete(
        `/api/v2/measurements/water-intake/log/${VALID_UUID}`
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(result);
      expect(measurementService.deleteWaterIntakeLogEntry).toHaveBeenCalledWith(
        'test-user-id',
        'test-user-id',
        VALID_UUID
      );
    });

    it('returns 404 when log entry does not exist', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.deleteWaterIntakeLogEntry.mockRejectedValue(
        new Error('Water intake log entry not found.')
      );
      const res = await request(app).delete(
        `/api/v2/measurements/water-intake/log/${VALID_UUID}`
      );
      expect(res.statusCode).toBe(404);
    });

    it('returns 403 when access is forbidden', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.deleteWaterIntakeLogEntry.mockRejectedValue(
        new Error(
          'Forbidden: You do not have permission to delete this water intake log entry.'
        )
      );
      const res = await request(app).delete(
        `/api/v2/measurements/water-intake/log/${VALID_UUID}`
      );
      expect(res.statusCode).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /log/:id — update logged_at time
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v2/measurements/water-intake/log/:id', () => {
    it('updates logged_at and returns 200', async () => {
      const updated = { id: VALID_UUID, logged_at: '2023-01-01T09:30:00.000Z' };
      // @ts-expect-error TS(2339): Property 'mockResolvedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.updateWaterIntakeLogTime.mockResolvedValue(updated);
      const res = await request(app)
        .patch(`/api/v2/measurements/water-intake/log/${VALID_UUID}`)
        .send({ loggedAt: '2023-01-01T09:30:00.000Z' });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(updated);
      expect(measurementService.updateWaterIntakeLogTime).toHaveBeenCalledWith(
        VALID_UUID,
        '2023-01-01T09:30:00.000Z',
        'test-user-id'
      );
    });

    it('returns 400 when loggedAt is missing', async () => {
      const res = await request(app)
        .patch(`/api/v2/measurements/water-intake/log/${VALID_UUID}`)
        .send({});
      expect(res.statusCode).toBe(400);
      expect(
        measurementService.updateWaterIntakeLogTime
      ).not.toHaveBeenCalled();
    });

    it('returns 400 when loggedAt is not a valid ISO datetime', async () => {
      const res = await request(app)
        .patch(`/api/v2/measurements/water-intake/log/${VALID_UUID}`)
        .send({ loggedAt: 'not-a-date' });
      expect(res.statusCode).toBe(400);
      expect(
        measurementService.updateWaterIntakeLogTime
      ).not.toHaveBeenCalled();
    });

    it('returns 404 when log entry does not exist', async () => {
      // @ts-expect-error TS(2339): Property 'mockResolvedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.updateWaterIntakeLogTime.mockResolvedValue(null);
      const res = await request(app)
        .patch(`/api/v2/measurements/water-intake/log/${VALID_UUID}`)
        .send({ loggedAt: '2023-01-01T09:30:00.000Z' });
      expect(res.statusCode).toBe(404);
    });

    it('returns 403 when access is denied', async () => {
      // @ts-expect-error TS(2339): Property 'mockRejectedValue' does not exist on typ... Remove this comment to see the full error message
      measurementService.updateWaterIntakeLogTime.mockRejectedValue(
        new Error('Water intake log entry not found or access denied')
      );
      const res = await request(app)
        .patch(`/api/v2/measurements/water-intake/log/${VALID_UUID}`)
        .send({ loggedAt: '2023-01-01T09:30:00.000Z' });
      expect(res.statusCode).toBe(403);
    });
  });
});
