import crypto from 'node:crypto';
import fs from 'node:fs';
import { GoogleGenAI, Type } from '@google/genai';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { Express, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { db } from '../db/index.ts';
import {
  activityLogs,
  AttachmentItem,
  comments,
  DEFAULT_USER_PREFERENCES,
  demoRequests,
  notifications,
  passwordResetTokens,
  projects,
  SubtaskItem,
  tasks,
  taskTemplates,
  users,
} from '../db/schema.ts';
import {
  AuthRequest,
  hashPassword,
  requireAuth,
  requireRole,
  sanitizePreferences,
  sanitizeUser,
  signAuthToken,
  UserRole,
  verifyPassword,
} from './auth.ts';
import { ensureSeedData } from './seed.ts';
import { resolveSafeUploadPath, uploadMiddleware } from './uploads.ts';

const VALID_STATUSES = ['todo', 'in_progress', 'on_hold', 'completed'] as const;
const VALID_PRIORITIES = ['high', 'medium', 'low'] as const;
const VALID_CATEGORIES = [
  'feature',
  'bug',
  'migration',
  'design',
  'ops',
  'content',
  'security',
  'research',
] as const;
const VALID_PROJECT_STATUSES = ['planning', 'active', 'at_risk', 'completed'] as const;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160;
}

function isSafeHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function parsePositiveInt(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const clean = item.trim().toLowerCase().replace(/[^a-z0-9-_ ]/g, '').slice(0, 32);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
    if (out.length >= 10) break;
  }
  return out;
}

function sanitizeSubtasks(raw: unknown): SubtaskItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .slice(0, 20)
    .map((item, idx) => ({
      id:
        typeof item.id === 'string' && item.id.trim()
          ? item.id.trim().slice(0, 64)
          : `sub-${Date.now()}-${idx}`,
      title: typeof item.title === 'string' ? item.title.trim().slice(0, 140) : '',
      done: item.done === true,
    }))
    .filter((s) => s.title.length > 0);
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function archiveStaleCompletedTasks(): Promise<void> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.status, 'completed'), eq(tasks.archived, false)));

  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const staleIds = rows
    .filter((t) => {
      const refTime = t.completedAt?.getTime() ?? t.updatedAt.getTime();
      return refTime < cutoff;
    })
    .map((t) => t.id);

  if (staleIds.length > 0) {
    await db.update(tasks).set({ archived: true }).where(inArray(tasks.id, staleIds));
  }
}

export function registerRoutes(app: Express, io: SocketIOServer): void {
  const emitWorkspace = (event: string, payload: unknown) => {
    io.to('workspace').emit(event, payload);
  };

  const emitToUser = (userId: number, event: string, payload: unknown) => {
    io.to(`user:${userId}`).emit(event, payload);
  };

  // ==================== PUBLIC / AUTH BOOTSTRAP ====================

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/auth/bootstrap-status', async (_req: Request, res: Response) => {
    try {
      await ensureSeedData();
      const admins = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
      res.json({
        needsAdminClaim: admins.length === 0,
      });
    } catch (err) {
      console.error('Bootstrap status error:', err);
      res.status(500).json({ error: 'Unable to check workspace initialization status.' });
    }
  });

  app.post('/api/auth/claim-admin', async (req: Request, res: Response) => {
    try {
      await ensureSeedData();
      const body = req.body as {
        name?: unknown;
        email?: unknown;
        password?: unknown;
        department?: unknown;
      };

      const existingAdmins = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
      if (existingAdmins.length > 0) {
        res.status(409).json({
          error: 'Workspace administrator has already been claimed. Please sign in with your account.',
        });
        return;
      }

      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const department =
        typeof body.department === 'string' && body.department.trim()
          ? body.department.trim().slice(0, 60)
          : 'Operations';

      if (!name || !isValidEmail(email) || password.length < 8) {
        res.status(400).json({
          error: 'Provide a valid name, email address, and password (minimum 8 characters).',
        });
        return;
      }

      const existingEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingEmail.length > 0) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      const passwordHash = await hashPassword(password);
      const [created] = await db
        .insert(users)
        .values({
          name,
          email,
          passwordHash,
          role: 'admin',
          department,
          jobTitle: 'Workspace Administrator',
          avatar: '',
        })
        .returning();

      const safeUser = sanitizeUser(created);
      const token = signAuthToken(safeUser);
      emitWorkspace('team:updated', { user: safeUser });
      res.status(201).json({ token, user: safeUser });
    } catch (err) {
      console.error('Claim admin error:', err);
      res.status(500).json({ error: 'Failed to claim workspace administrator.' });
    }
  });

  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
      await ensureSeedData();
      const body = req.body as {
        name?: unknown;
        email?: unknown;
        password?: unknown;
        role?: unknown;
        department?: unknown;
        jobTitle?: unknown;
      };

      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      // Public signup allows employee or manager; admin is reserved for first claim or admin promotion
      const role: UserRole = body.role === 'manager' ? 'manager' : 'employee';
      const department =
        typeof body.department === 'string' && body.department.trim()
          ? body.department.trim().slice(0, 60)
          : 'Engineering';
      const jobTitle =
        typeof body.jobTitle === 'string' && body.jobTitle.trim()
          ? body.jobTitle.trim().slice(0, 80)
          : role === 'manager'
            ? 'Project Manager'
            : 'Team Member';

      if (!name || !isValidEmail(email) || password.length < 8) {
        res.status(400).json({
          error: 'Valid name, email address, and password (minimum 8 characters) are required.',
        });
        return;
      }

      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      const passwordHash = await hashPassword(password);
      const [created] = await db
        .insert(users)
        .values({
          name,
          email,
          passwordHash,
          role,
          department,
          jobTitle,
          avatar: '',
        })
        .returning();

      const safeUser = sanitizeUser(created);
      const token = signAuthToken(safeUser);
      emitWorkspace('team:updated', { user: safeUser });
      res.status(201).json({ token, user: safeUser });
    } catch (err) {
      console.error('Signup error:', err);
      res.status(500).json({ error: 'Unable to create account right now.' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      await ensureSeedData();
      const body = req.body as { email?: unknown; password?: unknown };
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';

      if (!isValidEmail(email) || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const found = rows[0];
      if (!found || !(await verifyPassword(password, found.passwordHash))) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
      if (!found.isActive) {
        res.status(403).json({ error: 'This account has been deactivated by an administrator.' });
        return;
      }

      const safeUser = sanitizeUser(found);
      const token = signAuthToken(safeUser);
      res.json({ token, user: safeUser });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Unable to sign in right now.' });
    }
  });

  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const body = req.body as { email?: unknown };
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Enter a valid email address.' });
        return;
      }

      const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (rows[0]) {
        const rawToken = crypto.randomBytes(24).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await db.insert(passwordResetTokens).values({
          userId: rows[0].id,
          tokenHash,
          expiresAt,
        });
      }

      res.json({
        ok: true,
        message:
          'If an account matches that email address, a password reset request has been recorded. Contact your workspace administrator or use Google Sign-In if mail delivery is not configured in this environment.',
      });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ error: 'Unable to process password reset request.' });
    }
  });

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const body = req.body as { token?: unknown; newPassword?: unknown };
      const rawToken = typeof body.token === 'string' ? body.token.trim() : '';
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

      if (!rawToken || newPassword.length < 8) {
        res.status(400).json({ error: 'Valid reset token and password (8+ characters) required.' });
        return;
      }

      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const rows = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .limit(1);

      const record = rows[0];
      if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
        res.status(400).json({ error: 'Reset token is invalid or expired.' });
        return;
      }

      const passwordHash = await hashPassword(newPassword);
      await db.update(users).set({ passwordHash }).where(eq(users.id, record.userId));
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, record.id));

      res.json({ ok: true, message: 'Password updated. You may now sign in.' });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Unable to reset password.' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
    await ensureSeedData();
    res.json({ user: req.authUser });
  });

  app.patch('/api/auth/profile', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const body = req.body as {
        name?: unknown;
        department?: unknown;
        jobTitle?: unknown;
        currentPassword?: unknown;
        newPassword?: unknown;
      };

      const name =
        typeof body.name === 'string' && body.name.trim()
          ? body.name.trim().slice(0, 80)
          : user.name;
      const department =
        typeof body.department === 'string' && body.department.trim()
          ? body.department.trim().slice(0, 60)
          : user.department;
      const jobTitle =
        typeof body.jobTitle === 'string' && body.jobTitle.trim()
          ? body.jobTitle.trim().slice(0, 80)
          : user.jobTitle;

      const updateValues: Partial<typeof users.$inferInsert> = {
        name,
        department,
        jobTitle,
      };

      if (typeof body.newPassword === 'string' && body.newPassword.length > 0) {
        if (body.newPassword.length < 8) {
          res.status(400).json({ error: 'New password must be at least 8 characters.' });
          return;
        }
        const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
        const dbRow = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
        if (!dbRow[0] || !(await verifyPassword(current, dbRow[0].passwordHash))) {
          res.status(400).json({ error: 'Current password verification failed.' });
          return;
        }
        updateValues.passwordHash = await hashPassword(body.newPassword);
      }

      const [updated] = await db
        .update(users)
        .set(updateValues)
        .where(eq(users.id, user.id))
        .returning();

      const safeUser = sanitizeUser(updated);
      emitWorkspace('team:updated', { user: safeUser });
      res.json({ user: safeUser });
    } catch (err) {
      console.error('Update profile error:', err);
      res.status(500).json({ error: 'Failed to update profile.' });
    }
  });

  app.put('/api/auth/preferences', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const merged = sanitizePreferences(req.body, user.preferences);

      const [updated] = await db
        .update(users)
        .set({ preferences: merged })
        .where(eq(users.id, user.id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: 'User account not found.' });
        return;
      }

      res.json({ user: sanitizeUser(updated) });
    } catch (err) {
      console.error('Update preferences error:', err);
      res.status(500).json({ error: 'Failed to save workspace customization preferences.' });
    }
  });

  app.post('/api/auth/preferences/reset', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const [updated] = await db
        .update(users)
        .set({ preferences: { ...DEFAULT_USER_PREFERENCES } })
        .where(eq(users.id, user.id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: 'User account not found.' });
        return;
      }

      res.json({ user: sanitizeUser(updated) });
    } catch (err) {
      console.error('Reset preferences error:', err);
      res.status(500).json({ error: 'Failed to reset workspace customization preferences.' });
    }
  });

  // ==================== PUBLIC DEMO / CONTACT REQUESTS ====================

  app.post('/api/demo-requests', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        name?: unknown;
        email?: unknown;
        company?: unknown;
        teamSize?: unknown;
        message?: unknown;
      };

      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const company = typeof body.company === 'string' ? body.company.trim().slice(0, 100) : '';
      const teamSize = typeof body.teamSize === 'string' ? body.teamSize.trim().slice(0, 40) : '10-50';
      const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1200) : '';

      if (!name || !isValidEmail(email)) {
        res.status(400).json({ error: 'Please provide your name and a valid work email.' });
        return;
      }

      const [created] = await db
        .insert(demoRequests)
        .values({ name, email, company, teamSize, message })
        .returning();

      res.status(201).json({
        id: created.id,
        message: 'Demo request confirmed. Our team will follow up within one business day.',
      });
    } catch (err) {
      console.error('Demo request error:', err);
      res.status(500).json({ error: 'Failed to submit request.' });
    }
  });

  // ==================== TEAM & USERS ====================

  app.get('/api/users', requireAuth, async (_req: AuthRequest, res: Response) => {
    try {
      await ensureSeedData();
      const rows = await db.select().from(users).orderBy(users.name);
      res.json(rows.map(sanitizeUser));
    } catch (err) {
      console.error('List users error:', err);
      res.status(500).json({ error: 'Failed to load team members.' });
    }
  });

  app.post(
    '/api/users',
    requireAuth,
    requireRole('admin', 'manager'),
    async (req: AuthRequest, res: Response) => {
      try {
        const body = req.body as {
          name?: unknown;
          email?: unknown;
          password?: unknown;
          role?: unknown;
          department?: unknown;
          jobTitle?: unknown;
        };

        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const requestedRole: UserRole =
          body.role === 'admin' && req.authUser!.role === 'admin'
            ? 'admin'
            : body.role === 'manager'
              ? 'manager'
              : 'employee';
        const department =
          typeof body.department === 'string' && body.department.trim()
            ? body.department.trim().slice(0, 60)
            : 'Engineering';
        const jobTitle =
          typeof body.jobTitle === 'string' && body.jobTitle.trim()
            ? body.jobTitle.trim().slice(0, 80)
            : 'Team Member';

        if (!name || !isValidEmail(email) || password.length < 8) {
          res.status(400).json({
            error: 'Valid name, email, and initial password (8+ characters) are required.',
          });
          return;
        }

        const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existing.length > 0) {
          res.status(409).json({ error: 'A team member with this email already exists.' });
          return;
        }

        const passwordHash = await hashPassword(password);
        const [created] = await db
          .insert(users)
          .values({
            name,
            email,
            passwordHash,
            role: requestedRole,
            department,
            jobTitle,
          })
          .returning();

        const safeUser = sanitizeUser(created);
        await db.insert(activityLogs).values({
          userId: req.authUser!.id,
          action: 'team_member_added',
          newValue: `${safeUser.name} (${safeUser.role})`,
          summary: `Added ${safeUser.name} as ${safeUser.role} in ${safeUser.department}`,
        });

        emitWorkspace('team:updated', { user: safeUser });
        res.status(201).json(safeUser);
      } catch (err) {
        console.error('Create user error:', err);
        res.status(500).json({ error: 'Failed to invite team member.' });
      }
    }
  );

  app.patch(
    '/api/users/:id',
    requireAuth,
    requireRole('admin', 'manager'),
    async (req: AuthRequest, res: Response) => {
      try {
        const targetId = parsePositiveInt(req.params.id);
        if (!targetId) {
          res.status(400).json({ error: 'Invalid user ID.' });
          return;
        }

        const existingRows = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
        const target = existingRows[0];
        if (!target) {
          res.status(404).json({ error: 'Team member not found.' });
          return;
        }

        const body = req.body as {
          role?: unknown;
          department?: unknown;
          jobTitle?: unknown;
          isActive?: unknown;
        };

        const patch: Partial<typeof users.$inferInsert> = {};
        if (typeof body.role === 'string') {
          if (body.role === 'admin' && req.authUser!.role !== 'admin') {
            res.status(403).json({ error: 'Only an administrator can grant admin role.' });
            return;
          }
          if (body.role === 'admin' || body.role === 'manager' || body.role === 'employee') {
            patch.role = body.role;
          }
        }
        if (typeof body.department === 'string' && body.department.trim()) {
          patch.department = body.department.trim().slice(0, 60);
        }
        if (typeof body.jobTitle === 'string' && body.jobTitle.trim()) {
          patch.jobTitle = body.jobTitle.trim().slice(0, 80);
        }
        if (typeof body.isActive === 'boolean') {
          if (targetId === req.authUser!.id && body.isActive === false) {
            res.status(400).json({ error: 'You cannot deactivate your own active session.' });
            return;
          }
          patch.isActive = body.isActive;
        }

        const [updated] = await db
          .update(users)
          .set(patch)
          .where(eq(users.id, targetId))
          .returning();

        const safeUser = sanitizeUser(updated);
        emitWorkspace('team:updated', { user: safeUser });
        res.json(safeUser);
      } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Failed to update team member.' });
      }
    }
  );

  // ==================== PROJECTS ====================

  app.get('/api/projects', requireAuth, async (_req: AuthRequest, res: Response) => {
    try {
      await ensureSeedData();
      const allProjects = await db.select().from(projects).orderBy(projects.createdAt);
      const allTasks = await db.select().from(tasks);
      const todayIso = new Date().toISOString().slice(0, 10);

      const enriched = allProjects.map((p) => {
        const pTasks = allTasks.filter((t) => t.projectId === p.id && !t.archived);
        const completedCount = pTasks.filter((t) => t.status === 'completed').length;
        const overdueCount = pTasks.filter(
          (t) => t.status !== 'completed' && t.dueDate && t.dueDate < todayIso
        ).length;
        const progress = pTasks.length > 0 ? Math.round((completedCount / pTasks.length) * 100) : 0;
        return {
          ...p,
          taskCount: pTasks.length,
          completedCount,
          overdueCount,
          progress,
        };
      });

      res.json(enriched);
    } catch (err) {
      console.error('List projects error:', err);
      res.status(500).json({ error: 'Failed to load projects.' });
    }
  });

  app.post(
    '/api/projects',
    requireAuth,
    requireRole('admin', 'manager'),
    async (req: AuthRequest, res: Response) => {
      try {
        const body = req.body as {
          name?: unknown;
          description?: unknown;
          color?: unknown;
          startDate?: unknown;
          deadline?: unknown;
          status?: unknown;
        };

        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
        const description =
          typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
        const color =
          typeof body.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(body.color)
            ? body.color
            : '#2563EB';
        const todayIso = new Date().toISOString().slice(0, 10);
        const startDate =
          typeof body.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)
            ? body.startDate
            : todayIso;
        const deadline =
          typeof body.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.deadline)
            ? body.deadline
            : todayIso;
        const status =
          typeof body.status === 'string' &&
          (VALID_PROJECT_STATUSES as readonly string[]).includes(body.status)
            ? body.status
            : 'active';

        if (!name) {
          res.status(400).json({ error: 'Project name is required.' });
          return;
        }

        const [created] = await db
          .insert(projects)
          .values({
            name,
            description,
            color,
            ownerId: req.authUser!.id,
            startDate,
            deadline,
            status,
          })
          .returning();

        await db.insert(activityLogs).values({
          projectId: created.id,
          userId: req.authUser!.id,
          action: 'project_created',
          newValue: created.name,
          summary: `Created project "${created.name}"`,
        });

        const payload = { ...created, taskCount: 0, completedCount: 0, overdueCount: 0, progress: 0 };
        emitWorkspace('project:created', payload);
        res.status(201).json(payload);
      } catch (err) {
        console.error('Create project error:', err);
        res.status(500).json({ error: 'Failed to create project.' });
      }
    }
  );

  app.patch(
    '/api/projects/:id',
    requireAuth,
    requireRole('admin', 'manager'),
    async (req: AuthRequest, res: Response) => {
      try {
        const projectId = parsePositiveInt(req.params.id);
        if (!projectId) {
          res.status(400).json({ error: 'Invalid project ID.' });
          return;
        }
        const body = req.body as {
          name?: unknown;
          description?: unknown;
          color?: unknown;
          startDate?: unknown;
          deadline?: unknown;
          status?: unknown;
        };

        const patch: Partial<typeof projects.$inferInsert> = {};
        if (typeof body.name === 'string' && body.name.trim()) {
          patch.name = body.name.trim().slice(0, 80);
        }
        if (typeof body.description === 'string') {
          patch.description = body.description.trim().slice(0, 500);
        }
        if (typeof body.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(body.color)) {
          patch.color = body.color;
        }
        if (typeof body.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) {
          patch.startDate = body.startDate;
        }
        if (typeof body.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.deadline)) {
          patch.deadline = body.deadline;
        }
        if (
          typeof body.status === 'string' &&
          (VALID_PROJECT_STATUSES as readonly string[]).includes(body.status)
        ) {
          patch.status = body.status;
        }

        const [updated] = await db
          .update(projects)
          .set(patch)
          .where(eq(projects.id, projectId))
          .returning();

        if (!updated) {
          res.status(404).json({ error: 'Project not found.' });
          return;
        }

        emitWorkspace('project:updated', updated);
        res.json(updated);
      } catch (err) {
        console.error('Update project error:', err);
        res.status(500).json({ error: 'Failed to update project.' });
      }
    }
  );

  app.delete(
    '/api/projects/:id',
    requireAuth,
    requireRole('admin', 'manager'),
    async (req: AuthRequest, res: Response) => {
      try {
        const projectId = parsePositiveInt(req.params.id);
        if (!projectId) {
          res.status(400).json({ error: 'Invalid project ID.' });
          return;
        }

        const [deleted] = await db
          .delete(projects)
          .where(eq(projects.id, projectId))
          .returning();

        if (!deleted) {
          res.status(404).json({ error: 'Project not found.' });
          return;
        }

        emitWorkspace('project:deleted', { id: projectId });
        res.json({ ok: true, id: projectId });
      } catch (err) {
        console.error('Delete project error:', err);
        res.status(500).json({ error: 'Failed to delete project.' });
      }
    }
  );

  // ==================== TASKS ====================

  app.get('/api/tasks', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureSeedData();
      await archiveStaleCompletedTasks();

      const allTasks = await db.select().from(tasks).orderBy(desc(tasks.updatedAt));
      const includeArchived = req.query.showArchived === 'true';
      const filtered = includeArchived ? allTasks : allTasks.filter((t) => !t.archived);
      res.json(filtered);
    } catch (err) {
      console.error('List tasks error:', err);
      res.status(500).json({ error: 'Failed to fetch tasks.' });
    }
  });

  app.post('/api/tasks', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.authUser!;
      const body = req.body as {
        projectId?: unknown;
        title?: unknown;
        description?: unknown;
        assigneeId?: unknown;
        assigneeIds?: unknown;
        dueDate?: unknown;
        priority?: unknown;
        category?: unknown;
        status?: unknown;
        tags?: unknown;
        subtasks?: unknown;
      };

      const projectId = parsePositiveInt(body.projectId);
      const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : '';
      if (!projectId || !title) {
        res.status(400).json({ error: 'Project and task title are required.' });
        return;
      }

      const projRows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!projRows[0]) {
        res.status(404).json({ error: 'Selected project does not exist.' });
        return;
      }

      const description =
        typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : '';
      const dueDate =
        typeof body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)
          ? body.dueDate
          : '';
      const priority =
        typeof body.priority === 'string' &&
        (VALID_PRIORITIES as readonly string[]).includes(body.priority)
          ? body.priority
          : 'medium';
      const category =
        typeof body.category === 'string' &&
        (VALID_CATEGORIES as readonly string[]).includes(body.category)
          ? body.category
          : 'feature';
      const status =
        typeof body.status === 'string' &&
        (VALID_STATUSES as readonly string[]).includes(body.status)
          ? body.status
          : 'todo';

      let assigneeIds: number[] = [];
      if (actor.role === 'admin' || actor.role === 'manager') {
        const rawList = Array.isArray(body.assigneeIds)
          ? body.assigneeIds
          : body.assigneeId
            ? [body.assigneeId]
            : [];
        assigneeIds = Array.from(
          new Set(rawList.map(parsePositiveInt).filter((id): id is number => id !== null))
        );
      } else {
        assigneeIds = [actor.id];
      }
      const primaryAssigneeId = assigneeIds[0] ?? null;

      const [created] = await db
        .insert(tasks)
        .values({
          projectId,
          title,
          description,
          assigneeId: primaryAssigneeId,
          assigneeIds,
          createdById: actor.id,
          dueDate,
          priority,
          category,
          status,
          tags: sanitizeTags(body.tags),
          subtasks: sanitizeSubtasks(body.subtasks),
          attachments: [],
          completedAt: status === 'completed' ? new Date() : null,
        })
        .returning();

      await db.insert(activityLogs).values({
        taskId: created.id,
        projectId: created.projectId,
        userId: actor.id,
        action: 'task_created',
        newValue: created.status,
        summary: `Created task "${created.title}"`,
      });

      for (const uid of assigneeIds) {
        if (uid !== actor.id) {
          const [notif] = await db
            .insert(notifications)
            .values({
              userId: uid,
              taskId: created.id,
              senderId: actor.id,
              message: `${actor.name} assigned you "${created.title}"`,
              type: 'assignment',
            })
            .returning();
          emitToUser(uid, 'notification:created', notif);
        }
      }

      emitWorkspace('task:created', created);
      res.status(201).json(created);
    } catch (err) {
      console.error('Create task error:', err);
      res.status(500).json({ error: 'Failed to create task.' });
    }
  });

  app.patch('/api/tasks/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.authUser!;
      const taskId = parsePositiveInt(req.params.id);
      if (!taskId) {
        res.status(400).json({ error: 'Invalid task ID.' });
        return;
      }

      const existingRows = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      const existing = existingRows[0];
      if (!existing) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }

      const isManagerOrAdmin = actor.role === 'admin' || actor.role === 'manager';
      const isAssigned =
        existing.assigneeId === actor.id ||
        existing.assigneeIds.includes(actor.id) ||
        existing.createdById === actor.id;

      if (!isManagerOrAdmin && !isAssigned) {
        res.status(403).json({ error: 'You can only update tasks assigned to you.' });
        return;
      }

      const body = req.body as {
        projectId?: unknown;
        title?: unknown;
        description?: unknown;
        assigneeId?: unknown;
        assigneeIds?: unknown;
        dueDate?: unknown;
        priority?: unknown;
        category?: unknown;
        status?: unknown;
        tags?: unknown;
        subtasks?: unknown;
        archived?: unknown;
      };

      const patch: Partial<typeof tasks.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (typeof body.status === 'string' && (VALID_STATUSES as readonly string[]).includes(body.status)) {
        patch.status = body.status;
        if (body.status === 'completed' && existing.status !== 'completed') {
          patch.completedAt = new Date();
        } else if (body.status !== 'completed' && existing.status === 'completed') {
          patch.completedAt = null;
        }
      }

      if (body.subtasks !== undefined) {
        patch.subtasks = sanitizeSubtasks(body.subtasks);
      }

      if (typeof body.description === 'string') {
        patch.description = body.description.trim().slice(0, 2000);
      }

      if (body.tags !== undefined) {
        patch.tags = sanitizeTags(body.tags);
      }

      if (typeof body.archived === 'boolean') {
        patch.archived = body.archived;
      }

      if (isManagerOrAdmin) {
        if (typeof body.title === 'string' && body.title.trim()) {
          patch.title = body.title.trim().slice(0, 160);
        }
        const nextProjectId = parsePositiveInt(body.projectId);
        if (nextProjectId) {
          patch.projectId = nextProjectId;
        }
        if (typeof body.dueDate === 'string' && (/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) || body.dueDate === '')) {
          patch.dueDate = body.dueDate;
        }
        if (
          typeof body.priority === 'string' &&
          (VALID_PRIORITIES as readonly string[]).includes(body.priority)
        ) {
          patch.priority = body.priority;
        }
        if (
          typeof body.category === 'string' &&
          (VALID_CATEGORIES as readonly string[]).includes(body.category)
        ) {
          patch.category = body.category;
        }
        if (body.assigneeIds !== undefined || body.assigneeId !== undefined) {
          const rawList = Array.isArray(body.assigneeIds)
            ? body.assigneeIds
            : body.assigneeId
              ? [body.assigneeId]
              : [];
          const nextAssignees = Array.from(
            new Set(rawList.map(parsePositiveInt).filter((id): id is number => id !== null))
          );
          patch.assigneeIds = nextAssignees;
          patch.assigneeId = nextAssignees[0] ?? null;
        }
      }

      const [updated] = await db
        .update(tasks)
        .set(patch)
        .where(eq(tasks.id, taskId))
        .returning();

      const statusChanged = patch.status && patch.status !== existing.status;
      await db.insert(activityLogs).values({
        taskId: updated.id,
        projectId: updated.projectId,
        userId: actor.id,
        action: statusChanged ? 'task_status_changed' : 'task_updated',
        oldValue: statusChanged ? existing.status : '',
        newValue: statusChanged ? updated.status : '',
        summary: statusChanged
          ? `Changed "${updated.title}" status from ${existing.status.replace('_', ' ')} to ${updated.status.replace('_', ' ')}`
          : `Updated task "${updated.title}"`,
      });

      // Notify newly added assignees
      if (patch.assigneeIds) {
        const prevSet = new Set(existing.assigneeIds);
        for (const uid of patch.assigneeIds) {
          if (!prevSet.has(uid) && uid !== actor.id) {
            const [notif] = await db
              .insert(notifications)
              .values({
                userId: uid,
                taskId: updated.id,
                senderId: actor.id,
                message: `${actor.name} assigned you "${updated.title}"`,
                type: 'assignment',
              })
              .returning();
            emitToUser(uid, 'notification:created', notif);
          }
        }
      }

      // Notify creator when employee updates status
      if (statusChanged && existing.createdById !== actor.id) {
        const [notif] = await db
          .insert(notifications)
          .values({
            userId: existing.createdById,
            taskId: updated.id,
            senderId: actor.id,
            message: `${actor.name} updated "${updated.title}" to ${updated.status.replace('_', ' ')}`,
            type: 'status_update',
          })
          .returning();
        emitToUser(existing.createdById, 'notification:created', notif);
      }

      emitWorkspace('task:updated', updated);
      res.json(updated);
    } catch (err) {
      console.error('Update task error:', err);
      res.status(500).json({ error: 'Failed to update task.' });
    }
  });

  app.delete('/api/tasks/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.authUser!;
      const taskId = parsePositiveInt(req.params.id);
      if (!taskId) {
        res.status(400).json({ error: 'Invalid task ID.' });
        return;
      }

      const existingRows = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      const existing = existingRows[0];
      if (!existing) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }

      const canDelete =
        actor.role === 'admin' || actor.role === 'manager' || existing.createdById === actor.id;
      if (!canDelete) {
        res.status(403).json({ error: 'Only managers, admins, or the task creator can delete tasks.' });
        return;
      }

      await db.insert(activityLogs).values({
        projectId: existing.projectId,
        userId: actor.id,
        action: 'task_deleted',
        oldValue: existing.title,
        summary: `Deleted task "${existing.title}"`,
      });

      await db.delete(tasks).where(eq(tasks.id, taskId));
      emitWorkspace('task:deleted', { id: taskId });
      res.json({ ok: true, id: taskId });
    } catch (err) {
      console.error('Delete task error:', err);
      res.status(500).json({ error: 'Failed to delete task.' });
    }
  });

  app.post('/api/tasks/bulk-update', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.authUser!;
      const body = req.body as {
        taskIds?: unknown;
        status?: unknown;
        projectId?: unknown;
      };

      const rawIds = Array.isArray(body.taskIds) ? body.taskIds : [];
      const taskIds = Array.from(
        new Set(rawIds.map(parsePositiveInt).filter((id): id is number => id !== null))
      ).slice(0, 100);

      if (taskIds.length === 0) {
        res.status(400).json({ error: 'Select at least one valid task.' });
        return;
      }

      const nextStatus =
        typeof body.status === 'string' && (VALID_STATUSES as readonly string[]).includes(body.status)
          ? body.status
          : undefined;
      const nextProjectId = body.projectId !== undefined ? parsePositiveInt(body.projectId) : null;

      if (!nextStatus && !nextProjectId) {
        res.status(400).json({ error: 'Provide a status or target project to apply.' });
        return;
      }

      const isManagerOrAdmin = actor.role === 'admin' || actor.role === 'manager';
      if (nextProjectId && !isManagerOrAdmin) {
        res.status(403).json({ error: 'Only managers or administrators can move tasks between projects.' });
        return;
      }

      if (nextProjectId) {
        const projRows = await db
          .select()
          .from(projects)
          .where(eq(projects.id, nextProjectId))
          .limit(1);
        if (!projRows[0]) {
          res.status(404).json({ error: 'Target project does not exist.' });
          return;
        }
      }

      const existingTasks = await db.select().from(tasks).where(inArray(tasks.id, taskIds));
      if (existingTasks.length === 0) {
        res.status(404).json({ error: 'Selected tasks were not found.' });
        return;
      }

      if (!isManagerOrAdmin) {
        const unauthorized = existingTasks.some(
          (t) =>
            t.assigneeId !== actor.id &&
            !t.assigneeIds.includes(actor.id) &&
            t.createdById !== actor.id
        );
        if (unauthorized) {
          res.status(403).json({ error: 'You can only update tasks assigned to you.' });
          return;
        }
      }

      const updatedTasks: Array<typeof tasks.$inferSelect> = [];
      for (const existing of existingTasks) {
        const patch: Partial<typeof tasks.$inferInsert> = {
          updatedAt: new Date(),
        };
        if (nextStatus) {
          patch.status = nextStatus;
          if (nextStatus === 'completed' && existing.status !== 'completed') {
            patch.completedAt = new Date();
          } else if (nextStatus !== 'completed' && existing.status === 'completed') {
            patch.completedAt = null;
          }
        }
        if (nextProjectId) {
          patch.projectId = nextProjectId;
        }

        const [updated] = await db
          .update(tasks)
          .set(patch)
          .where(eq(tasks.id, existing.id))
          .returning();
        if (updated) {
          updatedTasks.push(updated);
          emitWorkspace('task:updated', updated);
        }
      }

      const summaryParts: string[] = [];
      if (nextStatus) summaryParts.push(`status → ${nextStatus.replace('_', ' ')}`);
      if (nextProjectId) summaryParts.push(`moved to project #${nextProjectId}`);

      await db.insert(activityLogs).values({
        projectId: nextProjectId ?? updatedTasks[0]?.projectId ?? null,
        userId: actor.id,
        action: 'tasks_bulk_updated',
        newValue: summaryParts.join(', '),
        summary: `Bulk updated ${updatedTasks.length} tasks (${summaryParts.join(', ')})`,
      });

      res.json({ tasks: updatedTasks });
    } catch (err) {
      console.error('Bulk update tasks error:', err);
      res.status(500).json({ error: 'Failed to bulk update selected tasks.' });
    }
  });

  app.post('/api/tasks/bulk-delete', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.authUser!;
      const body = req.body as { taskIds?: unknown };

      const rawIds = Array.isArray(body.taskIds) ? body.taskIds : [];
      const taskIds = Array.from(
        new Set(rawIds.map(parsePositiveInt).filter((id): id is number => id !== null))
      ).slice(0, 100);

      if (taskIds.length === 0) {
        res.status(400).json({ error: 'Select at least one valid task to delete.' });
        return;
      }

      const existingTasks = await db.select().from(tasks).where(inArray(tasks.id, taskIds));
      if (existingTasks.length === 0) {
        res.status(404).json({ error: 'Selected tasks were not found.' });
        return;
      }

      const isManagerOrAdmin = actor.role === 'admin' || actor.role === 'manager';
      if (!isManagerOrAdmin) {
        const unauthorized = existingTasks.some((t) => t.createdById !== actor.id);
        if (unauthorized) {
          res.status(403).json({
            error: 'Only managers, administrators, or the task creator can delete tasks.',
          });
          return;
        }
      }

      const deletedIds = existingTasks.map((t) => t.id);
      await db.insert(activityLogs).values({
        userId: actor.id,
        action: 'tasks_bulk_deleted',
        oldValue: `${deletedIds.length} tasks`,
        summary: `Bulk deleted ${deletedIds.length} tasks`,
      });

      await db.delete(tasks).where(inArray(tasks.id, deletedIds));
      for (const id of deletedIds) {
        emitWorkspace('task:deleted', { id });
      }

      res.json({ ok: true, deletedIds });
    } catch (err) {
      console.error('Bulk delete tasks error:', err);
      res.status(500).json({ error: 'Failed to delete selected tasks.' });
    }
  });

  app.post(
    '/api/tasks/:id/remind',
    requireAuth,
    requireRole('admin', 'manager'),
    async (req: AuthRequest, res: Response) => {
      try {
        const actor = req.authUser!;
        const taskId = parsePositiveInt(req.params.id);
        if (!taskId) {
          res.status(400).json({ error: 'Invalid task ID.' });
          return;
        }

        const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
        const task = taskRows[0];
        if (!task) {
          res.status(404).json({ error: 'Task not found.' });
          return;
        }

        const recipients = Array.from(
          new Set([...task.assigneeIds, ...(task.assigneeId ? [task.assigneeId] : [])])
        );
        if (recipients.length === 0) {
          res.status(400).json({ error: 'Assign at least one team member before sending a reminder.' });
          return;
        }

        const customNote =
          typeof req.body?.note === 'string' && req.body.note.trim()
            ? `: ${req.body.note.trim().slice(0, 140)}`
            : '';

        const createdNotifs = [];
        for (const uid of recipients) {
          const [notif] = await db
            .insert(notifications)
            .values({
              userId: uid,
              taskId: task.id,
              senderId: actor.id,
              message: `Reminder from ${actor.name} on "${task.title}"${customNote}`,
              type: 'reminder',
            })
            .returning();
          createdNotifs.push(notif);
          emitToUser(uid, 'notification:created', notif);
        }

        await db.insert(activityLogs).values({
          taskId: task.id,
          projectId: task.projectId,
          userId: actor.id,
          action: 'reminder_sent',
          summary: `Sent deadline reminder for "${task.title}"`,
        });

        res.json({ ok: true, count: createdNotifs.length });
      } catch (err) {
        console.error('Send reminder error:', err);
        res.status(500).json({ error: 'Failed to send task reminder.' });
      }
    }
  );

  // ==================== TASK TEMPLATES ====================

  app.get('/api/task-templates', requireAuth, async (_req: AuthRequest, res: Response) => {
    try {
      await ensureSeedData();
      const rows = await db
        .select()
        .from(taskTemplates)
        .orderBy(desc(taskTemplates.updatedAt));
      res.json(rows);
    } catch (err) {
      console.error('List task templates error:', err);
      res.status(500).json({ error: 'Failed to load task templates.' });
    }
  });

  app.post('/api/task-templates', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.authUser!;
      const body = req.body as {
        name?: unknown;
        title?: unknown;
        description?: unknown;
        projectId?: unknown;
        assigneeIds?: unknown;
        priority?: unknown;
        category?: unknown;
        status?: unknown;
        tags?: unknown;
        subtasks?: unknown;
        dueOffsetDays?: unknown;
      };

      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
      const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : '';
      if (!name || !title) {
        res.status(400).json({ error: 'Template name and default task title are required.' });
        return;
      }

      let projectId: number | null = null;
      if (body.projectId !== null && body.projectId !== undefined && body.projectId !== '') {
        const parsedPid = parsePositiveInt(body.projectId);
        if (!parsedPid) {
          res.status(400).json({ error: 'Invalid project ID.' });
          return;
        }
        const projRows = await db.select().from(projects).where(eq(projects.id, parsedPid)).limit(1);
        if (!projRows[0]) {
          res.status(404).json({ error: 'Selected project does not exist.' });
          return;
        }
        projectId = parsedPid;
      }

      const description =
        typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : '';
      const priority =
        typeof body.priority === 'string' &&
        (VALID_PRIORITIES as readonly string[]).includes(body.priority)
          ? body.priority
          : 'medium';
      const category =
        typeof body.category === 'string' &&
        (VALID_CATEGORIES as readonly string[]).includes(body.category)
          ? body.category
          : 'feature';
      const status =
        typeof body.status === 'string' &&
        (VALID_STATUSES as readonly string[]).includes(body.status)
          ? body.status
          : 'todo';

      let dueOffsetDays: number | null = null;
      if (
        body.dueOffsetDays !== null &&
        body.dueOffsetDays !== undefined &&
        body.dueOffsetDays !== ''
      ) {
        const n = Number(body.dueOffsetDays);
        if (!Number.isInteger(n) || n < 0 || n > 365) {
          res.status(400).json({ error: 'Due offset days must be an integer between 0 and 365.' });
          return;
        }
        dueOffsetDays = n;
      }

      const rawAssigneeIds = Array.isArray(body.assigneeIds)
        ? Array.from(
            new Set(
              body.assigneeIds.map(parsePositiveInt).filter((id): id is number => id !== null)
            )
          )
        : [];
      let validAssigneeIds: number[] = [];
      if (rawAssigneeIds.length > 0) {
        const existingUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, rawAssigneeIds));
        const validSet = new Set(existingUsers.map((u) => u.id));
        validAssigneeIds = rawAssigneeIds.filter((id) => validSet.has(id));
      }

      const cleanSubtasks = sanitizeSubtasks(body.subtasks).map((item) => ({
        ...item,
        done: false,
      }));

      const [created] = await db
        .insert(taskTemplates)
        .values({
          name,
          title,
          description,
          projectId,
          assigneeIds: validAssigneeIds,
          priority,
          category,
          status,
          tags: sanitizeTags(body.tags),
          subtasks: cleanSubtasks,
          dueOffsetDays,
          createdById: actor.id,
        })
        .returning();

      await db.insert(activityLogs).values({
        taskId: null,
        projectId,
        userId: actor.id,
        action: 'template_created',
        newValue: created.name,
        summary: `Saved task template "${created.name}"`,
      });

      emitWorkspace('template:created', created);
      res.status(201).json(created);
    } catch (err) {
      console.error('Create task template error:', err);
      res.status(500).json({ error: 'Failed to save task template.' });
    }
  });

  app.patch('/api/task-templates/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.authUser!;
      const templateId = parsePositiveInt(req.params.id);
      if (!templateId) {
        res.status(400).json({ error: 'Invalid template ID.' });
        return;
      }

      const existingRows = await db
        .select()
        .from(taskTemplates)
        .where(eq(taskTemplates.id, templateId))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) {
        res.status(404).json({ error: 'Task template not found.' });
        return;
      }

      const isManagerOrAdmin = actor.role === 'admin' || actor.role === 'manager';
      if (!isManagerOrAdmin && existing.createdById !== actor.id) {
        res.status(403).json({ error: 'You can only edit task templates you created.' });
        return;
      }

      const body = req.body as {
        name?: unknown;
        title?: unknown;
        description?: unknown;
        projectId?: unknown;
        assigneeIds?: unknown;
        priority?: unknown;
        category?: unknown;
        status?: unknown;
        tags?: unknown;
        subtasks?: unknown;
        dueOffsetDays?: unknown;
      };

      const nextName =
        typeof body.name === 'string' ? body.name.trim().slice(0, 120) : existing.name;
      const nextTitle =
        typeof body.title === 'string' ? body.title.trim().slice(0, 160) : existing.title;
      if (!nextName || !nextTitle) {
        res.status(400).json({ error: 'Template name and default task title cannot be empty.' });
        return;
      }

      let nextProjectId = existing.projectId;
      if (body.projectId !== undefined) {
        if (body.projectId === null || body.projectId === '') {
          nextProjectId = null;
        } else {
          const parsedPid = parsePositiveInt(body.projectId);
          if (!parsedPid) {
            res.status(400).json({ error: 'Invalid project ID.' });
            return;
          }
          const projRows = await db
            .select()
            .from(projects)
            .where(eq(projects.id, parsedPid))
            .limit(1);
          if (!projRows[0]) {
            res.status(404).json({ error: 'Selected project does not exist.' });
            return;
          }
          nextProjectId = parsedPid;
        }
      }

      let nextDueOffsetDays = existing.dueOffsetDays;
      if (body.dueOffsetDays !== undefined) {
        if (body.dueOffsetDays === null || body.dueOffsetDays === '') {
          nextDueOffsetDays = null;
        } else {
          const n = Number(body.dueOffsetDays);
          if (!Number.isInteger(n) || n < 0 || n > 365) {
            res
              .status(400)
              .json({ error: 'Due offset days must be an integer between 0 and 365.' });
            return;
          }
          nextDueOffsetDays = n;
        }
      }

      let nextAssigneeIds = existing.assigneeIds;
      if (Array.isArray(body.assigneeIds)) {
        const rawIds = Array.from(
          new Set(body.assigneeIds.map(parsePositiveInt).filter((id): id is number => id !== null))
        );
        if (rawIds.length === 0) {
          nextAssigneeIds = [];
        } else {
          const existingUsers = await db
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, rawIds));
          const validSet = new Set(existingUsers.map((u) => u.id));
          nextAssigneeIds = rawIds.filter((id) => validSet.has(id));
        }
      }

      const nextPriority =
        typeof body.priority === 'string' &&
        (VALID_PRIORITIES as readonly string[]).includes(body.priority)
          ? body.priority
          : existing.priority;
      const nextCategory =
        typeof body.category === 'string' &&
        (VALID_CATEGORIES as readonly string[]).includes(body.category)
          ? body.category
          : existing.category;
      const nextStatus =
        typeof body.status === 'string' &&
        (VALID_STATUSES as readonly string[]).includes(body.status)
          ? body.status
          : existing.status;

      const [updated] = await db
        .update(taskTemplates)
        .set({
          name: nextName,
          title: nextTitle,
          description:
            typeof body.description === 'string'
              ? body.description.trim().slice(0, 2000)
              : existing.description,
          projectId: nextProjectId,
          assigneeIds: nextAssigneeIds,
          priority: nextPriority,
          category: nextCategory,
          status: nextStatus,
          tags: body.tags !== undefined ? sanitizeTags(body.tags) : existing.tags,
          subtasks:
            body.subtasks !== undefined
              ? sanitizeSubtasks(body.subtasks).map((item) => ({ ...item, done: false }))
              : existing.subtasks,
          dueOffsetDays: nextDueOffsetDays,
          updatedAt: new Date(),
        })
        .where(eq(taskTemplates.id, templateId))
        .returning();

      await db.insert(activityLogs).values({
        taskId: null,
        projectId: updated.projectId,
        userId: actor.id,
        action: 'template_updated',
        newValue: updated.name,
        summary: `Updated task template "${updated.name}"`,
      });

      emitWorkspace('template:updated', updated);
      res.json(updated);
    } catch (err) {
      console.error('Update task template error:', err);
      res.status(500).json({ error: 'Failed to update task template.' });
    }
  });

  app.delete('/api/task-templates/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.authUser!;
      const templateId = parsePositiveInt(req.params.id);
      if (!templateId) {
        res.status(400).json({ error: 'Invalid template ID.' });
        return;
      }

      const existingRows = await db
        .select()
        .from(taskTemplates)
        .where(eq(taskTemplates.id, templateId))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) {
        res.status(404).json({ error: 'Task template not found.' });
        return;
      }

      const isManagerOrAdmin = actor.role === 'admin' || actor.role === 'manager';
      if (!isManagerOrAdmin && existing.createdById !== actor.id) {
        res.status(403).json({ error: 'You can only delete task templates you created.' });
        return;
      }

      await db.delete(taskTemplates).where(eq(taskTemplates.id, templateId));

      await db.insert(activityLogs).values({
        taskId: null,
        projectId: existing.projectId,
        userId: actor.id,
        action: 'template_deleted',
        oldValue: existing.name,
        summary: `Deleted task template "${existing.name}"`,
      });

      emitWorkspace('template:deleted', { id: templateId });
      res.json({ ok: true, id: templateId });
    } catch (err) {
      console.error('Delete task template error:', err);
      res.status(500).json({ error: 'Failed to delete task template.' });
    }
  });

  app.post(
    '/api/task-templates/:id/instantiate',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const actor = req.authUser!;
        const templateId = parsePositiveInt(req.params.id);
        if (!templateId) {
          res.status(400).json({ error: 'Invalid template ID.' });
          return;
        }

        const tplRows = await db
          .select()
          .from(taskTemplates)
          .where(eq(taskTemplates.id, templateId))
          .limit(1);
        const tpl = tplRows[0];
        if (!tpl) {
          res.status(404).json({ error: 'Task template not found.' });
          return;
        }

        const body = (req.body || {}) as {
          projectId?: unknown;
          dueDate?: unknown;
        };

        let targetProjectId = parsePositiveInt(body.projectId) ?? tpl.projectId;
        if (targetProjectId) {
          const projRows = await db
            .select()
            .from(projects)
            .where(eq(projects.id, targetProjectId))
            .limit(1);
          if (!projRows[0]) {
            targetProjectId = null;
          }
        }
        if (!targetProjectId) {
          const fallbackProjects = await db.select().from(projects).limit(1);
          if (!fallbackProjects[0]) {
            res.status(400).json({ error: 'Create a project before instantiating a task template.' });
            return;
          }
          targetProjectId = fallbackProjects[0].id;
        }

        let dueDate = '';
        if (typeof body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
          dueDate = body.dueDate;
        } else if (tpl.dueOffsetDays !== null && tpl.dueOffsetDays >= 0) {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() + tpl.dueOffsetDays);
          dueDate = d.toISOString().slice(0, 10);
        }

        const isManagerOrAdmin = actor.role === 'admin' || actor.role === 'manager';
        let assigneeIds: number[] = [];
        if (isManagerOrAdmin) {
          if (tpl.assigneeIds.length > 0) {
            const validUsers = await db
              .select({ id: users.id })
              .from(users)
              .where(inArray(users.id, tpl.assigneeIds));
            const validSet = new Set(validUsers.map((u) => u.id));
            assigneeIds = tpl.assigneeIds.filter((id) => validSet.has(id));
          }
        } else {
          assigneeIds = [actor.id];
        }

        const freshSubtasks: SubtaskItem[] = tpl.subtasks.map((s, idx) => ({
          id: `sub-${Date.now()}-${idx}-${crypto.randomBytes(2).toString('hex')}`,
          title: s.title,
          done: false,
        }));

        const [created] = await db
          .insert(tasks)
          .values({
            projectId: targetProjectId,
            title: tpl.title,
            description: tpl.description,
            assigneeId: assigneeIds[0] ?? null,
            assigneeIds,
            createdById: actor.id,
            dueDate,
            priority: tpl.priority,
            category: tpl.category,
            status: tpl.status,
            tags: tpl.tags,
            subtasks: freshSubtasks,
            attachments: [],
            completedAt: tpl.status === 'completed' ? new Date() : null,
          })
          .returning();

        await db.insert(activityLogs).values({
          taskId: created.id,
          projectId: created.projectId,
          userId: actor.id,
          action: 'task_created',
          newValue: created.status,
          summary: `Created task "${created.title}" from template "${tpl.name}"`,
        });

        for (const uid of assigneeIds) {
          if (uid !== actor.id) {
            const [notif] = await db
              .insert(notifications)
              .values({
                userId: uid,
                taskId: created.id,
                senderId: actor.id,
                message: `${actor.name} assigned you "${created.title}"`,
                type: 'assignment',
              })
              .returning();
            emitToUser(uid, 'notification:created', notif);
          }
        }

        emitWorkspace('task:created', created);
        res.status(201).json(created);
      } catch (err) {
        console.error('Instantiate task template error:', err);
        res.status(500).json({ error: 'Failed to create task from template.' });
      }
    }
  );

  // ==================== ATTACHMENTS & SECURE DOWNLOADS ====================

  app.post(
    '/api/tasks/:id/attachments',
    requireAuth,
    (req: AuthRequest, res: Response, next) => {
      uploadMiddleware.array('files', 3)(req, res, (err) => {
        if (err) {
          res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed.' });
          return;
        }
        next();
      });
    },
    async (req: AuthRequest, res: Response) => {
      try {
        const actor = req.authUser!;
        const taskId = parsePositiveInt(req.params.id);
        if (!taskId) {
          res.status(400).json({ error: 'Invalid task ID.' });
          return;
        }

        const existingRows = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
        const existing = existingRows[0];
        if (!existing) {
          res.status(404).json({ error: 'Task not found.' });
          return;
        }

        const isAllowed =
          actor.role === 'admin' ||
          actor.role === 'manager' ||
          existing.assigneeId === actor.id ||
          existing.assigneeIds.includes(actor.id) ||
          existing.createdById === actor.id;

        if (!isAllowed) {
          res.status(403).json({ error: 'You cannot upload attachments to this task.' });
          return;
        }

        const files = (req.files as Express.Multer.File[]) || [];
        if (files.length === 0) {
          res.status(400).json({ error: 'No valid files received.' });
          return;
        }

        const added: AttachmentItem[] = files.map((file) => ({
          id: crypto.randomUUID(),
          name: file.originalname.slice(0, 120),
          url: `/api/uploads/${file.filename}`,
          size: file.size,
          mimeType: file.mimetype,
          uploadedById: actor.id,
          uploadedByName: actor.name,
          uploadedAt: new Date().toISOString(),
        }));

        const nextAttachments = [...existing.attachments, ...added].slice(0, 15);
        const [updated] = await db
          .update(tasks)
          .set({ attachments: nextAttachments, updatedAt: new Date() })
          .where(eq(tasks.id, taskId))
          .returning();

        await db.insert(activityLogs).values({
          taskId: updated.id,
          projectId: updated.projectId,
          userId: actor.id,
          action: 'attachment_added',
          newValue: added.map((a) => a.name).join(', '),
          summary: `Uploaded ${added.length} attachment(s) to "${updated.title}"`,
        });

        emitWorkspace('task:updated', updated);
        res.status(201).json(updated);
      } catch (err) {
        console.error('Upload attachment error:', err);
        res.status(500).json({ error: 'Failed to save uploaded attachments.' });
      }
    }
  );

  app.get('/api/uploads/:filename', requireAuth, (req: AuthRequest, res: Response) => {
    const filenameParam = typeof req.params.filename === 'string' ? req.params.filename : '';
    const safePath = resolveSafeUploadPath(filenameParam);
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ error: 'Attachment file not found.' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(safePath);
  });

  // ==================== COMMENTS ====================

  app.get('/api/tasks/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const taskId = parsePositiveInt(req.params.id);
      if (!taskId) {
        res.status(400).json({ error: 'Invalid task ID.' });
        return;
      }

      const rows = await db
        .select({
          id: comments.id,
          taskId: comments.taskId,
          userId: comments.userId,
          message: comments.message,
          attachments: comments.attachments,
          createdAt: comments.createdAt,
          authorName: users.name,
          authorRole: users.role,
        })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.taskId, taskId))
        .orderBy(comments.createdAt);

      res.json(rows);
    } catch (err) {
      console.error('List comments error:', err);
      res.status(500).json({ error: 'Failed to fetch comments.' });
    }
  });

  app.post('/api/tasks/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.authUser!;
      const taskId = parsePositiveInt(req.params.id);
      const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 1500) : '';

      if (!taskId || !message) {
        res.status(400).json({ error: 'Task ID and comment message are required.' });
        return;
      }

      const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      const task = taskRows[0];
      if (!task) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }

      const [created] = await db
        .insert(comments)
        .values({
          taskId,
          userId: actor.id,
          message,
          attachments: [],
        })
        .returning();

      const payload = {
        ...created,
        authorName: actor.name,
        authorRole: actor.role,
      };

      const notifyIds = Array.from(
        new Set([...task.assigneeIds, task.createdById].filter((id) => id !== actor.id))
      );
      for (const uid of notifyIds) {
        const [notif] = await db
          .insert(notifications)
          .values({
            userId: uid,
            taskId: task.id,
            senderId: actor.id,
            message: `${actor.name} commented on "${task.title}"`,
            type: 'comment',
          })
          .returning();
        emitToUser(uid, 'notification:created', notif);
      }

      await db.insert(activityLogs).values({
        taskId: task.id,
        projectId: task.projectId,
        userId: actor.id,
        action: 'comment_added',
        summary: `Commented on "${task.title}"`,
      });

      emitWorkspace('comment:added', payload);
      res.status(201).json(payload);
    } catch (err) {
      console.error('Add comment error:', err);
      res.status(500).json({ error: 'Failed to post comment.' });
    }
  });

  // ==================== NOTIFICATIONS ====================

  app.get('/api/notifications', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const existingNotifs = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(50);

      // Sync approaching-deadline & overdue alerts for open tasks assigned to this user
      const openTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.archived, false)));
      const todayMs = new Date().setHours(0, 0, 0, 0);
      const existingTaskAlertKeys = new Set(
        existingNotifs
          .filter((n) => n.type === 'overdue' || n.type === 'deadline')
          .map((n) => `${n.taskId}:${n.type}`)
      );

      const newAlerts: (typeof notifications.$inferInsert)[] = [];
      for (const t of openTasks) {
        if (t.status === 'completed' || !t.dueDate) continue;
        const isMine = t.assigneeId === user.id || t.assigneeIds.includes(user.id);
        if (!isMine) continue;
        const dueMs = new Date(`${t.dueDate}T00:00:00`).getTime();
        const diffDays = Math.round((dueMs - todayMs) / 86400000);
        if (diffDays < 0 && !existingTaskAlertKeys.has(`${t.id}:overdue`)) {
          newAlerts.push({
            userId: user.id,
            taskId: t.id,
            message: `Overdue task: "${t.title}" was due ${t.dueDate}`,
            type: 'overdue',
          });
        } else if (diffDays >= 0 && diffDays <= 2 && !existingTaskAlertKeys.has(`${t.id}:deadline`)) {
          newAlerts.push({
            userId: user.id,
            taskId: t.id,
            message:
              diffDays === 0
                ? `Due today: "${t.title}"`
                : `Approaching deadline (${diffDays}d): "${t.title}"`,
            type: 'deadline',
          });
        }
      }

      if (newAlerts.length > 0) {
        await db.insert(notifications).values(newAlerts);
        const refreshed = await db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, user.id))
          .orderBy(desc(notifications.createdAt))
          .limit(50);
        res.json(refreshed);
        return;
      }

      res.json(existingNotifs);
    } catch (err) {
      console.error('Fetch notifications error:', err);
      res.status(500).json({ error: 'Failed to load notifications.' });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid notification ID.' });
        return;
      }
      const [updated] = await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, req.authUser!.id)))
        .returning();

      if (!updated) {
        res.status(404).json({ error: 'Notification not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      console.error('Mark notification read error:', err);
      res.status(500).json({ error: 'Failed to update notification.' });
    }
  });

  app.post('/api/notifications/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, req.authUser!.id));
      res.json({ ok: true });
    } catch (err) {
      console.error('Mark all notifications read error:', err);
      res.status(500).json({ error: 'Failed to clear unread notifications.' });
    }
  });

  // ==================== ANALYTICS & ACTIVITY LOG ====================

  app.get('/api/analytics', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureSeedData();
      const scope = req.query.scope === 'mine' ? 'mine' : 'all';
      const userId = req.authUser!.id;

      const allTasks = (await db.select().from(tasks)).filter((t) => !t.archived);
      const scopedTasks =
        scope === 'mine'
          ? allTasks.filter((t) => t.assigneeId === userId || t.assigneeIds.includes(userId))
          : allTasks;

      const allProjects = await db.select().from(projects);
      const allUsers = (await db.select().from(users)).map(sanitizeUser);
      const todayIso = new Date().toISOString().slice(0, 10);

      const totalTasks = scopedTasks.length;
      const completedTasks = scopedTasks.filter((t) => t.status === 'completed').length;
      const inProgressTasks = scopedTasks.filter((t) => t.status === 'in_progress').length;
      const onHoldTasks = scopedTasks.filter((t) => t.status === 'on_hold').length;
      const todoTasks = scopedTasks.filter((t) => t.status === 'todo').length;
      const overdueTasks = scopedTasks.filter(
        (t) => t.status !== 'completed' && t.dueDate && t.dueDate < todayIso
      ).length;

      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const completionDurationsHours = scopedTasks
        .filter((t) => t.status === 'completed' && t.completedAt)
        .map((t) => Math.max(1, (t.completedAt!.getTime() - t.createdAt.getTime()) / 3600000));

      const avgCompletionHours =
        completionDurationsHours.length > 0
          ? Math.round(
              completionDurationsHours.reduce((a, b) => a + b, 0) / completionDurationsHours.length
            )
          : 0;

      const workloadByEmployee = allUsers.map((member) => {
        const assigned = allTasks.filter(
          (t) => t.assigneeId === member.id || t.assigneeIds.includes(member.id)
        );
        const activeCount = assigned.filter((t) => t.status !== 'completed').length;
        const doneCount = assigned.filter((t) => t.status === 'completed').length;
        const memberOverdue = assigned.filter(
          (t) => t.status !== 'completed' && t.dueDate && t.dueDate < todayIso
        ).length;
        return {
          userId: member.id,
          name: member.name,
          department: member.department,
          role: member.role,
          total: assigned.length,
          active: activeCount,
          completed: doneCount,
          overdue: memberOverdue,
        };
      });

      const projectProgress = allProjects.map((p) => {
        const pTasks = allTasks.filter((t) => t.projectId === p.id);
        const done = pTasks.filter((t) => t.status === 'completed').length;
        return {
          projectId: p.id,
          name: p.name,
          color: p.color,
          status: p.status,
          total: pTasks.length,
          completed: done,
          progress: pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0,
        };
      });

      const statusBreakdown = [
        { name: 'To Do', value: todoTasks, color: '#64748B' },
        { name: 'In Progress', value: inProgressTasks, color: '#2563EB' },
        { name: 'On Hold', value: onHoldTasks, color: '#D97706' },
        { name: 'Completed', value: completedTasks, color: '#16A34A' },
      ];

      const priorityBreakdown = [
        {
          name: 'High',
          count: scopedTasks.filter((t) => t.priority === 'high' && t.status !== 'completed').length,
        },
        {
          name: 'Medium',
          count: scopedTasks.filter((t) => t.priority === 'medium' && t.status !== 'completed').length,
        },
        {
          name: 'Low',
          count: scopedTasks.filter((t) => t.priority === 'low' && t.status !== 'completed').length,
        },
      ];

      // 7-day rolling task creation & completion throughput
      const weeklyThroughput: { day: string; created: number; completed: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString(undefined, { weekday: 'short' });
        weeklyThroughput.push({
          day: label,
          created: scopedTasks.filter((t) => t.createdAt.toISOString().slice(0, 10) === iso).length,
          completed: scopedTasks.filter(
            (t) => t.completedAt && t.completedAt.toISOString().slice(0, 10) === iso
          ).length,
        });
      }

      res.json({
        totalTasks,
        completedTasks,
        inProgressTasks,
        onHoldTasks,
        todoTasks,
        overdueTasks,
        completionRate,
        avgCompletionHours,
        workloadByEmployee,
        projectProgress,
        statusBreakdown,
        priorityBreakdown,
        weeklyThroughput,
      });
    } catch (err) {
      console.error('Analytics error:', err);
      res.status(500).json({ error: 'Failed to calculate workspace analytics.' });
    }
  });

  app.get('/api/activity', requireAuth, async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await db
        .select({
          id: activityLogs.id,
          taskId: activityLogs.taskId,
          projectId: activityLogs.projectId,
          userId: activityLogs.userId,
          action: activityLogs.action,
          oldValue: activityLogs.oldValue,
          newValue: activityLogs.newValue,
          summary: activityLogs.summary,
          createdAt: activityLogs.createdAt,
          actorName: users.name,
          actorRole: users.role,
        })
        .from(activityLogs)
        .innerJoin(users, eq(activityLogs.userId, users.id))
        .orderBy(desc(activityLogs.createdAt))
        .limit(100);

      res.json(rows);
    } catch (err) {
      console.error('Activity log error:', err);
      res.status(500).json({ error: 'Failed to load activity log.' });
    }
  });

  // ==================== GEMINI AI ENDPOINTS ====================

  app.post('/api/gemini/priority-briefing', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const body = req.body as {
        tasks?: unknown;
        scopeLabel?: unknown;
      };

      const rawTasks = Array.isArray(body.tasks) ? body.tasks.slice(0, 30) : [];
      const scopeLabel =
        typeof body.scopeLabel === 'string' && body.scopeLabel.trim()
          ? body.scopeLabel.trim().slice(0, 120)
          : 'Current workspace view';

      const sanitizedTasks = rawTasks
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          id: String(item.id ?? '').slice(0, 64),
          title: typeof item.title === 'string' ? item.title.trim().slice(0, 160) : '',
          status: typeof item.status === 'string' ? item.status.slice(0, 32) : 'todo',
          project: typeof item.project === 'string' ? item.project.slice(0, 60) : '',
          due: typeof item.due === 'string' ? item.due.slice(0, 10) : '',
          assignee: typeof item.assignee === 'string' ? item.assignee.slice(0, 80) : 'Unassigned',
          subtasksDone: typeof item.subtasksDone === 'number' ? Math.max(0, Math.floor(item.subtasksDone)) : 0,
          subtasksTotal: typeof item.subtasksTotal === 'number' ? Math.max(0, Math.floor(item.subtasksTotal)) : 0,
        }))
        .filter((t) => t.title.length > 0);

      if (sanitizedTasks.length === 0) {
        res.status(400).json({ error: 'No high-priority tasks available to summarize.' });
        return;
      }

      const validIds = new Set(sanitizedTasks.map((t) => t.id).filter(Boolean));
      const today = new Date().toISOString().slice(0, 10);
      const taskLines = sanitizedTasks
        .map(
          (t) =>
            `- [id=${t.id}] "${t.title}" | status: ${t.status} | project: ${t.project} | due: ${t.due || 'none'} | assignee: ${t.assignee} | subtasks: ${t.subtasksDone}/${t.subtasksTotal}`
        )
        .join('\n');

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          `Today's date: ${today}`,
          `Scope: ${scopeLabel}`,
          `High-priority tasks (${sanitizedTasks.length}):`,
          taskLines,
          'Summarize the current state of these high-priority tasks and provide 3 to 5 concrete next-step suggestions.',
        ].join('\n\n'),
        config: {
          systemInstruction:
            'You are an engineering and operations sprint strategist inside Cadence. Return grounded JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              focusStatus: { type: Type.STRING, enum: ['on-track', 'at-risk', 'overloaded'] },
              nextSteps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.STRING },
                    taskTitle: { type: Type.STRING },
                    action: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['taskId', 'taskTitle', 'action', 'reason'],
                },
              },
            },
            required: ['summary', 'focusStatus', 'nextSteps'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        summary?: string;
        focusStatus?: string;
        nextSteps?: Array<Record<string, unknown>>;
      };

      const focusStatus =
        parsed.focusStatus === 'on-track' ||
        parsed.focusStatus === 'at-risk' ||
        parsed.focusStatus === 'overloaded'
          ? parsed.focusStatus
          : 'at-risk';

      const nextSteps = Array.isArray(parsed.nextSteps)
        ? parsed.nextSteps.slice(0, 5).map((item) => {
            const rawId = typeof item.taskId === 'string' ? item.taskId.trim() : '';
            return {
              taskId: validIds.has(rawId) ? rawId : '',
              taskTitle: typeof item.taskTitle === 'string' ? item.taskTitle.slice(0, 160) : 'Task',
              action: typeof item.action === 'string' ? item.action.slice(0, 320) : '',
              reason: typeof item.reason === 'string' ? item.reason.slice(0, 200) : '',
            };
          })
        : [];

      res.json({
        summary: (parsed.summary || 'High-priority summary ready.').slice(0, 800),
        focusStatus,
        nextSteps: nextSteps.filter((s) => s.action.length > 0),
        generatedAt: Date.now(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate priority briefing.';
      console.error('Gemini priority-briefing error:', msg);
      res.status(msg.includes('GEMINI_API_KEY') ? 503 : 500).json({ error: msg });
    }
  });

  app.post('/api/gemini/chat', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const body = req.body as {
        message?: unknown;
        history?: unknown;
        persona?: unknown;
        useSearch?: unknown;
        workspaceContext?: unknown;
      };
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message || message.length > 4000) {
        res.status(400).json({ error: 'Message must be 1 to 4000 characters.' });
        return;
      }

      const useSearch = body.useSearch === true || body.persona === 'researcher';
      const workspaceContext =
        typeof body.workspaceContext === 'string' ? body.workspaceContext.slice(0, 6000) : '';

      const rawHistory = Array.isArray(body.history) ? body.history.slice(-16) : [];
      const history = rawHistory
        .filter((h): h is { role: 'user' | 'model'; text: string } => {
          if (!h || typeof h !== 'object') return false;
          const r = h as Record<string, unknown>;
          return (
            (r.role === 'user' || r.role === 'model') &&
            typeof r.text === 'string' &&
            r.text.trim().length > 0
          );
        })
        .map((h) => ({ role: h.role, parts: [{ text: h.text.slice(0, 4000) }] }));

      const ai = getGeminiClient();
      const chat = ai.chats.create({
        model: 'gemini-4-hydrogen',
        history,
        config: {
          systemInstruction: [
            'You are the Cadence Workspace Strategist. Help teams plan work, track progress, resolve bottlenecks, and hit deadlines.',
            `Today's date is ${new Date().toISOString().slice(0, 10)}.`,
            workspaceContext ? `Workspace context:\n${workspaceContext}` : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
          ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
        },
      });

      const response = await chat.sendMessage({ message });
      const rawChunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) as Array<{
        web?: { uri?: string; title?: string };
      }>;
      const sources: { title: string; uri: string }[] = [];
      const seen = new Set<string>();
      for (const chunk of rawChunks) {
        const uri = chunk.web?.uri;
        if (uri && isSafeHttpUrl(uri) && !seen.has(uri)) {
          seen.add(uri);
          sources.push({ title: (chunk.web?.title || uri).slice(0, 200), uri: uri.slice(0, 1000) });
        }
      }

      res.json({
        text: (response.text ?? '').trim() || 'Unable to generate response.',
        sources,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate chat response.';
      res.status(msg.includes('GEMINI_API_KEY') ? 503 : 500).json({ error: msg });
    }
  });
}
