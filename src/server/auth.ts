import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  DEFAULT_USER_PREFERENCES,
  UserPreferences,
  users,
} from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

const BCRYPT_ROUNDS = 10;
const EPHEMERAL_JWT_SECRET = crypto.randomBytes(32).toString('hex');

function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : EPHEMERAL_JWT_SECRET;
}

export type UserRole = 'admin' | 'manager' | 'employee';

export interface SafeUser {
  id: number;
  uid: string | null;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  jobTitle: string;
  avatar: string;
  preferences: UserPreferences;
  isActive: boolean;
  createdAt: Date;
}

export interface AuthRequest extends Request {
  authUser?: SafeUser;
}

const VALID_THEME_MODES = new Set(['light', 'dark', 'system']);
const VALID_DENSITIES = new Set(['comfortable', 'compact']);
const VALID_FONT_SIZES = new Set(['small', 'medium', 'large']);
const VALID_SIDEBAR_BEHAVIORS = new Set(['expanded', 'collapsed']);
const VALID_CARD_STYLES = new Set(['rounded', 'minimal']);
const VALID_DATE_FORMATS = new Set(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']);
const VALID_DEFAULT_VIEWS = new Set(['overview', 'all_tasks', 'board', 'calendar']);
const VALID_DEFAULT_SORTS = new Set(['due_date', 'priority', 'updated', 'title']);
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function sanitizePreferences(
  raw: unknown,
  fallback: UserPreferences = DEFAULT_USER_PREFERENCES
): UserPreferences {
  const input =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    themeMode:
      typeof input.themeMode === 'string' && VALID_THEME_MODES.has(input.themeMode)
        ? (input.themeMode as UserPreferences['themeMode'])
        : fallback.themeMode,
    accentColor:
      typeof input.accentColor === 'string' && HEX_COLOR_RE.test(input.accentColor.trim())
        ? input.accentColor.trim().toUpperCase()
        : fallback.accentColor,
    density:
      typeof input.density === 'string' && VALID_DENSITIES.has(input.density)
        ? (input.density as UserPreferences['density'])
        : fallback.density,
    fontSize:
      typeof input.fontSize === 'string' && VALID_FONT_SIZES.has(input.fontSize)
        ? (input.fontSize as UserPreferences['fontSize'])
        : fallback.fontSize,
    sidebarBehavior:
      typeof input.sidebarBehavior === 'string' && VALID_SIDEBAR_BEHAVIORS.has(input.sidebarBehavior)
        ? (input.sidebarBehavior as UserPreferences['sidebarBehavior'])
        : fallback.sidebarBehavior,
    taskCardStyle:
      typeof input.taskCardStyle === 'string' && VALID_CARD_STYLES.has(input.taskCardStyle)
        ? (input.taskCardStyle as UserPreferences['taskCardStyle'])
        : fallback.taskCardStyle,
    dateFormat:
      typeof input.dateFormat === 'string' && VALID_DATE_FORMATS.has(input.dateFormat)
        ? (input.dateFormat as UserPreferences['dateFormat'])
        : fallback.dateFormat,
    defaultTaskView:
      typeof input.defaultTaskView === 'string' && VALID_DEFAULT_VIEWS.has(input.defaultTaskView)
        ? (input.defaultTaskView as UserPreferences['defaultTaskView'])
        : fallback.defaultTaskView,
    defaultTaskSort:
      typeof input.defaultTaskSort === 'string' && VALID_DEFAULT_SORTS.has(input.defaultTaskSort)
        ? (input.defaultTaskSort as UserPreferences['defaultTaskSort'])
        : fallback.defaultTaskSort,
    showCompletedByDefault:
      typeof input.showCompletedByDefault === 'boolean'
        ? input.showCompletedByDefault
        : fallback.showCompletedByDefault,
    reduceMotion:
      typeof input.reduceMotion === 'boolean' ? input.reduceMotion : fallback.reduceMotion,
  };
}

export function sanitizeUser(row: typeof users.$inferSelect): SafeUser {
  const role: UserRole =
    row.role === 'admin' || row.role === 'manager' ? row.role : 'employee';
  return {
    id: row.id,
    uid: row.uid ?? null,
    name: row.name,
    email: row.email,
    role,
    department: row.department,
    jobTitle: row.jobTitle,
    avatar: row.avatar,
    preferences: sanitizePreferences(row.preferences, DEFAULT_USER_PREFERENCES),
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash || !hash.startsWith('$2')) return false;
  return bcrypt.compare(plain, hash);
}

export function signAuthToken(user: SafeUser): string {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export function verifyJwtToken(token: string): { sub: string; email: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (typeof decoded === 'object' && decoded !== null && typeof decoded.sub === 'string') {
      return {
        sub: decoded.sub,
        email: typeof decoded.email === 'string' ? decoded.email : '',
        role: typeof decoded.role === 'string' ? decoded.role : 'employee',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveUserFromToken(token: string): Promise<SafeUser | null> {
  // 1. Check server-signed JWT first
  const jwtPayload = verifyJwtToken(token);
  if (jwtPayload) {
    const userId = Number(jwtPayload.sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user || !user.isActive) return null;
    return sanitizeUser(user);
  }

  // 2. Fallback to Firebase Auth ID Token verification
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').trim().toLowerCase();
    if (!email) return null;

    const existingByUid = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
    if (existingByUid[0]) {
      if (!existingByUid[0].isActive) return null;
      return sanitizeUser(existingByUid[0]);
    }

    const existingByEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingByEmail[0]) {
      const updated = await db
        .update(users)
        .set({
          uid: decoded.uid,
          avatar: existingByEmail[0].avatar || decoded.picture || '',
        })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      return sanitizeUser(updated[0]);
    }

    // Create a PostgreSQL record linked to Firebase UID
    const allAdmins = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
    const assignedRole: UserRole = allAdmins.length === 0 ? 'admin' : 'employee';
    const placeholderHash = await hashPassword(crypto.randomBytes(24).toString('hex'));

    const inserted = await db
      .insert(users)
      .values({
        uid: decoded.uid,
        name: (decoded.name || email.split('@')[0] || 'Workspace User').slice(0, 80),
        email,
        passwordHash: placeholderHash,
        role: assignedRole,
        department: assignedRole === 'admin' ? 'Operations' : 'Product',
        jobTitle: assignedRole === 'admin' ? 'Workspace Admin' : 'Team Member',
        avatar: decoded.picture || '',
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { uid: decoded.uid },
      })
      .returning();

    return sanitizeUser(inserted[0]);
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Missing bearer token.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Empty token.' });
    return;
  }

  try {
    const user = await resolveUserFromToken(token);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session token.' });
      return;
    }
    req.authUser = user;
    next();
  } catch (err) {
    console.error('Auth verification failed:', err);
    res.status(401).json({ error: 'Unable to verify authentication session.' });
  }
}

export function requireRole(...allowed: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowed.includes(req.authUser.role)) {
      res.status(403).json({ error: 'Insufficient permissions for this action.' });
      return;
    }
    next();
  };
}
