import { describe, expect, test } from 'vitest';
import announcementService, {
  parseFrontmatter,
} from '../services/announcementService.js';

describe('announcementService', () => {
  test('should parse YAML frontmatter and markdown body correctly', () => {
    const md = `---
id: notice-test-123
active: true
title: Maintenance Alert
---

### System Update

We will be upgrading servers on **August 1st**.
`;

    const parsed = parseFrontmatter(md);
    expect(parsed.frontmatter.id).toBe('notice-test-123');
    expect(parsed.frontmatter.active).toBe(true);
    expect(parsed.frontmatter.title).toBe('Maintenance Alert');
    expect(parsed.body).toContain('### System Update');
    expect(parsed.body).toContain('August 1st');
  });

  test('should handle frontmatter with extra leading --- lines', () => {
    const md = `---

---
id: notice-test-456
active: true
title: Extra Line Test
---

### Content Here
`;

    const parsed = parseFrontmatter(md);
    expect(parsed.frontmatter.id).toBe('notice-test-456');
    expect(parsed.frontmatter.active).toBe(true);
    expect(parsed.frontmatter.title).toBe('Extra Line Test');
    expect(parsed.body).toContain('### Content Here');
  });

  test('loads only the project-owned announcement and keeps stale notices inactive', async () => {
    const result = await announcementService.getLatestAnnouncement();
    expect(result.id).toBe('x-on-track-no-announcement');
    expect(result.active).toBe(false);
    expect(result.title).toBe('X on Track');
    expect(result.message).not.toContain('SparkyFitness');
  });
});
