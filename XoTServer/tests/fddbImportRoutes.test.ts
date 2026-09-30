import express from 'express';
import type { AddressInfo } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  diary: vi.fn(),
  extras: vi.fn(),
  clearCache: vi.fn(),
}));

vi.mock('../middleware/authMiddleware.js', () => ({
  authenticate: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    req.userId = 'owner-1';
    req.authenticatedUserId = req.get('x-actor') ?? 'owner-1';
    next();
  },
}));
vi.mock('../services/fddbImportService.js', () => ({
  importFddbDiary: service.diary,
  importFddbExtras: service.extras,
}));
vi.mock('../services/AdaptiveTdeeService.js', () => ({
  clearUserTdeeCache: service.clearCache,
}));

import fddbImportRoutes from '../routes/fddbImportRoutes.js';

const app = express();
app.use('/api/imports/fddb', fddbImportRoutes);

async function post(body: unknown, actor?: string) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(
      `http://127.0.0.1:${port}/api/imports/fddb/diary`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(actor ? { 'x-actor': actor } : {}),
        },
        body: JSON.stringify(body),
      }
    );
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const validRow = {
  sourceKey: 'source-1',
  date: '2026-09-26',
  time: '08:30',
  foodName: 'Synthetic food',
  quantity: 100,
  unit: 'g',
  calories: 100,
  protein: 3,
  carbs: 20,
  fat: 1,
};

describe('owner-only FDDB import API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.diary.mockResolvedValue({ imported: 1, alreadyPresent: 0 });
  });

  it('refuses family/delegated actors even when a valid owner ID is present', async () => {
    const response = await post({ rows: [validRow] }, 'delegate-2');
    expect(response.status).toBe(403);
    expect(service.diary).not.toHaveBeenCalled();
  });

  it('validates structured rows and accepts an owner batch', async () => {
    const malformed = await post({ rows: [{ ...validRow, quantity: -1 }] });
    expect(malformed.status).toBe(400);
    expect(service.diary).not.toHaveBeenCalled();

    const result = await post({ rows: [validRow] });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ imported: 1, alreadyPresent: 0 });
    expect(service.diary).toHaveBeenCalledWith('owner-1', 'owner-1', [
      validRow,
    ]);
    expect(service.clearCache).toHaveBeenCalledWith('owner-1');
  });
});
