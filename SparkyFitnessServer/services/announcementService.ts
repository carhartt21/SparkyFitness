import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import NodeCache from 'node-cache';
import { log } from '../config/logging.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const announcementCache = new NodeCache({ stdTTL: 900 }); // 15 minutes cache
const CACHE_KEY = 'latest_announcement';

export interface AnnouncementResponse {
  id: string;
  active: boolean;
  title: string;
  message: string;
  publishedAt?: string;
  htmlUrl?: string;
}

export function parseFrontmatter(markdownContent: string): {
  frontmatter: Record<string, any>;
  body: string;
} {
  const matches = [
    ...markdownContent.matchAll(/---[\r\n]+([\s\S]*?)[\r\n]+---/g),
  ];
  let yamlText = '';
  let body = markdownContent.trim();

  for (const match of matches) {
    const text = match[1] || '';
    if (
      text.includes('active:') ||
      text.includes('id:') ||
      text.includes('title:')
    ) {
      yamlText = text;
      body = markdownContent.slice((match.index || 0) + match[0].length).trim();
      break;
    }
  }

  if (!yamlText) {
    const singleMatch = markdownContent
      .trimStart()
      .match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (singleMatch) {
      yamlText = singleMatch[1]!;
      body = singleMatch[2]!.trim();
    }
  }

  const frontmatter: Record<string, any> = {};
  if (yamlText) {
    for (const line of yamlText.split(/\r?\n/)) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value: any = line.slice(colonIndex + 1).trim();
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (value.startsWith('"') && value.endsWith('"'))
          value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'"))
          value = value.slice(1, -1);
        frontmatter[key] = value;
      }
    }
  }

  return { frontmatter, body };
}

function getLocalFallbackAnnouncement(): AnnouncementResponse {
  try {
    // The server runs from both TypeScript sources and dist/. Use the first
    // project-owned announcement, never an upstream project's announcement.
    const localPath = [
      path.resolve(__dirname, '../../announcement.md'),
      path.resolve(__dirname, '../../../announcement.md'),
    ].find((candidate) => fs.existsSync(candidate));
    if (localPath) {
      const content = fs.readFileSync(localPath, 'utf8');
      const stat = fs.statSync(localPath);
      const { frontmatter, body } = parseFrontmatter(content);
      const result: AnnouncementResponse = {
        id: String(frontmatter.id || 'notice-local'),
        active: Boolean(frontmatter.active ?? false),
        title: String(frontmatter.title || 'Announcement'),
        message: body,
        publishedAt: stat.mtime.toISOString(),
      };
      log('info', '[ANNOUNCEMENT] Loaded local announcement.md:', {
        id: result.id,
        active: result.active,
        title: result.title,
      });
      return result;
    }
  } catch (err) {
    log(
      'warn',
      '[ANNOUNCEMENT] Failed reading local announcement.md fallback:',
      err
    );
  }
  return {
    id: 'none',
    active: false,
    title: '',
    message: '',
  };
}

async function getLatestAnnouncement(
  bypassCache = false
): Promise<AnnouncementResponse> {
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

  if (!bypassCache && !isDev) {
    const cached = announcementCache.get<AnnouncementResponse>(CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const result = getLocalFallbackAnnouncement();
  announcementCache.set(CACHE_KEY, result);
  return result;
}

export default {
  getLatestAnnouncement,
  parseFrontmatter,
};
