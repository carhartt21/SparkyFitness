import { describe, expect, it } from 'vitest';
import {
  ENGAGEMENT_NOTIFICATION_COPY,
  engagementReminderKindV2Schema,
} from '@workspace/shared';

describe('shared reminder presentation', () => {
  it('covers every remotely delivered reminder kind in both supported languages', () => {
    for (const kind of engagementReminderKindV2Schema.options) {
      for (const language of ['en', 'de'] as const) {
        const copy = ENGAGEMENT_NOTIFICATION_COPY[kind][language];
        expect(copy.title).toMatch(/\p{Extended_Pictographic}/u);
        expect(copy.title.length).toBeLessThan(70);
        expect(copy.body.length).toBeLessThan(180);
        expect(copy.body).not.toMatch(/\{\{/);
        if (language === 'de')
          expect(copy.body).not.toMatch(/\b(?:Sie|Ihr|Ihre|Ihnen)\b/);
      }
    }
  });
});
