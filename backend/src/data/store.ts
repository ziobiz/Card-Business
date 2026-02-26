/**
 * 앱 사용자 저장소
 * JSON 파일로 영구 저장 - 백엔드 재시작 후에도 로그인 가능
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export interface AppUser {
  id: string;
  email: string;
  passwordHash: string;
  wirexUserId?: string;
  createdAt: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const pathByDirname = join(__dirname, 'users.json');
const pathByCwd = join(process.cwd(), 'src', 'data', 'users.json');
const DATA_FILE = existsSync(pathByDirname) ? pathByDirname : pathByCwd;

export function getDataFilePath(): string {
  return DATA_FILE;
}

function loadFromFile(): { users: AppUser[] } {
  if (!existsSync(DATA_FILE)) return { users: [] };
  try {
    const data = readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { users: [] };
  }
}

function saveToFile(users: AppUser[]): void {
  try {
    writeFileSync(DATA_FILE, JSON.stringify({ users }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save users:', e);
  }
}

const users = new Map<string, AppUser>();
const emailIndex = new Map<string, string>();

function loadUsers(): void {
  users.clear();
  emailIndex.clear();
  const initial = loadFromFile();
  for (const u of initial.users) {
    users.set(u.id, u);
    emailIndex.set(u.email.toLowerCase(), u.id);
  }
  console.log('[STORE] Loaded from', DATA_FILE, 'users:', initial.users.length);
}

loadUsers();

export const store = {
  users,
  emailIndex,
  loadUsers,

  addUser(user: AppUser): void {
    users.set(user.id, user);
    emailIndex.set(user.email.toLowerCase(), user.id);
    saveToFile(Array.from(users.values()));
  },

  getUserById(id: string): AppUser | undefined {
    return users.get(id);
  },

  getUserByEmail(email: string): AppUser | undefined {
    const id = emailIndex.get(email.toLowerCase());
    return id ? users.get(id) : undefined;
  },

  updateWirexUserId(userId: string, wirexUserId: string): void {
    const user = users.get(userId);
    if (user) {
      user.wirexUserId = wirexUserId;
      saveToFile(Array.from(users.values()));
    }
  },
};
