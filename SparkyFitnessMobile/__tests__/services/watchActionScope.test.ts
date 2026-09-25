jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));

import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { isCurrentWatchActionScope } from '../../src/services/watchActionScope';

const identity = getActiveNutritionIdentity as jest.Mock;

describe('isCurrentWatchActionScope', () => {
  beforeEach(() => {
    identity.mockReset();
    identity.mockResolvedValue({
      serverConfigId: 'server-a',
      userId: 'user-a',
    });
  });

  it('accepts only the same server and user', async () => {
    await expect(
      isCurrentWatchActionScope('["server-a","user-a"]')
    ).resolves.toBe(true);
    await expect(
      isCurrentWatchActionScope('["server-a","user-b"]')
    ).resolves.toBe(false);
    await expect(
      isCurrentWatchActionScope('["server-b","user-a"]')
    ).resolves.toBe(false);
  });

  it('rejects missing, malformed, and unreadable scopes before a write', async () => {
    for (const scope of ['', 'null', '{}', '["server-a"]', '["","user-a"]']) {
      await expect(isCurrentWatchActionScope(scope)).resolves.toBe(false);
    }
    expect(identity).not.toHaveBeenCalled();
    identity.mockRejectedValueOnce(new Error('identity unreadable'));
    await expect(
      isCurrentWatchActionScope('["server-a","user-a"]')
    ).resolves.toBe(false);
  });
});
