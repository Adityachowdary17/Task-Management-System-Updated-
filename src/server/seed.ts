import crypto from 'node:crypto';
import { count, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  activityLogs,
  comments,
  notifications,
  projects,
  tasks,
  taskTemplates,
  users,
} from '../db/schema.ts';
import { hashPassword } from './auth.ts';

let seedPromise: Promise<void> | null = null;

function offsetDateStr(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function ensureSeedData(): Promise<void> {
  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    try {
      const [{ value: userCount }] = await db.select({ value: count() }).from(users);
      if (Number(userCount) > 0) {
        await ensureStarterTemplates();
        return;
      }

      // Non-privileged team member accounts use random non-loginable hashes until claimed or invited;
      // the first workspace administrator claims their own password via the inline setup form or Google Sign-In.
      const unclaimableHash = await hashPassword(crypto.randomBytes(24).toString('hex'));

      const insertedUsers = await db
        .insert(users)
        .values([
          {
            name: 'Priya Raman',
            email: 'priya.raman@cadencework.io',
            passwordHash: unclaimableHash,
            role: 'manager',
            department: 'Engineering',
            jobTitle: 'Engineering Manager',
            avatar: '',
          },
          {
            name: 'Ravi Menon',
            email: 'ravi.menon@cadencework.io',
            passwordHash: unclaimableHash,
            role: 'employee',
            department: 'Mobile',
            jobTitle: 'Senior iOS Engineer',
            avatar: '',
          },
          {
            name: 'Dana Ortiz',
            email: 'dana.ortiz@cadencework.io',
            passwordHash: unclaimableHash,
            role: 'employee',
            department: 'Platform',
            jobTitle: 'Backend Engineer',
            avatar: '',
          },
          {
            name: 'Leah Cho',
            email: 'leah.cho@cadencework.io',
            passwordHash: unclaimableHash,
            role: 'employee',
            department: 'Design',
            jobTitle: 'Product Designer',
            avatar: '',
          },
          {
            name: 'Sam Whitfield',
            email: 'sam.whitfield@cadencework.io',
            passwordHash: unclaimableHash,
            role: 'employee',
            department: 'Product Marketing',
            jobTitle: 'Growth Strategist',
            avatar: '',
          },
        ])
        .returning();

      const [priya, ravi, dana, leah, sam] = insertedUsers;

      const insertedProjects = await db
        .insert(projects)
        .values([
          {
            name: 'Mobile App 2.0',
            description: 'Offline sync engine, session resilience, and v2 navigation rollout.',
            color: '#2563EB',
            ownerId: priya.id,
            startDate: offsetDateStr(-24),
            deadline: offsetDateStr(18),
            status: 'active',
          },
          {
            name: 'Enterprise Billing Migration',
            description: 'Dual-write invoice verification and seat-based pricing transition.',
            color: '#0F766E',
            ownerId: priya.id,
            startDate: offsetDateStr(-30),
            deadline: offsetDateStr(10),
            status: 'at_risk',
          },
          {
            name: 'Customer Onboarding Flow',
            description: 'Reduce workspace provisioning steps from 9 screens down to 4.',
            color: '#4F46E5',
            ownerId: priya.id,
            startDate: offsetDateStr(-14),
            deadline: offsetDateStr(25),
            status: 'active',
          },
          {
            name: 'Security & SOC2 Readiness',
            description: 'Quarterly key rotation, audit trails, and RBAC compliance.',
            color: '#D97706',
            ownerId: priya.id,
            startDate: offsetDateStr(-18),
            deadline: offsetDateStr(7),
            status: 'active',
          },
        ])
        .returning();

      const [pMobile, pBilling, pOnboard, pSecurity] = insertedProjects;

      const now = Date.now();
      const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000);
      const daysAgo = (d: number) => new Date(now - d * 24 * 3600 * 1000);

      const insertedTasks = await db
        .insert(tasks)
        .values([
          {
            projectId: pMobile.id,
            title: 'Fix cold-start token refresh race on iOS',
            description: 'Background wakeups drop active sessions after 30 minutes of inactivity.',
            assigneeId: ravi.id,
            assigneeIds: [ravi.id, dana.id],
            createdById: priya.id,
            dueDate: offsetDateStr(-2),
            priority: 'high',
            category: 'bug',
            status: 'in_progress',
            tags: ['ios', 'auth', 'urgent'],
            subtasks: [
              { id: 's1', title: 'Reproduce token lock contention in simulator', done: true },
              { id: 's2', title: 'Add single-flight refresh mutex', done: true },
              { id: 's3', title: 'Verify background fetch recovery', done: false },
            ],
            createdAt: daysAgo(7),
            updatedAt: hoursAgo(4),
          },
          {
            projectId: pMobile.id,
            title: 'Ship offline draft mutation queue',
            description: 'Persist local task edits when offline and reconcile cleanly on reconnect.',
            assigneeId: dana.id,
            assigneeIds: [dana.id, ravi.id],
            createdById: priya.id,
            dueDate: offsetDateStr(1),
            priority: 'high',
            category: 'feature',
            status: 'in_progress',
            tags: ['sync', 'mobile'],
            subtasks: [
              { id: 's4', title: 'Persist mutation log in IndexedDB', done: true },
              { id: 's5', title: 'Exponential backoff replay queue', done: true },
              { id: 's6', title: 'Conflict resolution banner', done: false },
            ],
            createdAt: daysAgo(9),
            updatedAt: hoursAgo(12),
          },
          {
            projectId: pBilling.id,
            title: 'Map legacy plan SKUs to multi-seat price book',
            description: 'Blocks dual-write shadow invoice verification for enterprise customers.',
            assigneeId: dana.id,
            assigneeIds: [dana.id],
            createdById: priya.id,
            dueDate: offsetDateStr(0),
            priority: 'high',
            category: 'migration',
            status: 'on_hold',
            tags: ['billing', 'finance'],
            subtasks: [
              { id: 's7', title: 'Export active annual contracts', done: true },
              { id: 's8', title: 'Validate proration rules', done: true },
              { id: 's9', title: 'Finance sign-off', done: false },
            ],
            createdAt: daysAgo(12),
            updatedAt: hoursAgo(18),
          },
          {
            projectId: pBilling.id,
            title: 'Dual-write shadow ledger verification',
            description: 'Run 14 days of parallel invoice calculation before billing cutover.',
            assigneeId: priya.id,
            assigneeIds: [priya.id, dana.id],
            createdById: priya.id,
            dueDate: offsetDateStr(4),
            priority: 'high',
            category: 'migration',
            status: 'todo',
            tags: ['billing', 'risk'],
            subtasks: [
              { id: 's10', title: 'Enable shadow webhook consumer', done: true },
              { id: 's11', title: 'Compare tax rounding across 500 invoices', done: false },
            ],
            createdAt: daysAgo(5),
            updatedAt: daysAgo(2),
          },
          {
            projectId: pOnboard.id,
            title: 'Consolidate workspace setup from 9 steps to 4',
            description: 'Combine team invites, role defaults, and project templates in one view.',
            assigneeId: leah.id,
            assigneeIds: [leah.id, sam.id],
            createdById: priya.id,
            dueDate: offsetDateStr(2),
            priority: 'medium',
            category: 'design',
            status: 'in_progress',
            tags: ['ux', 'onboarding'],
            subtasks: [
              { id: 's12', title: 'Design unified invite drawer', done: true },
              { id: 's13', title: 'Prototype progress indicator', done: true },
              { id: 's14', title: 'Run 5 usability walkthroughs', done: false },
            ],
            createdAt: daysAgo(6),
            updatedAt: hoursAgo(6),
          },
          {
            projectId: pSecurity.id,
            title: 'Rotate production API signing keys',
            description: 'Quarterly cryptographic credential rotation across staging and production.',
            assigneeId: dana.id,
            assigneeIds: [dana.id, priya.id],
            createdById: priya.id,
            dueDate: offsetDateStr(-1),
            priority: 'high',
            category: 'security',
            status: 'todo',
            tags: ['security', 'soc2'],
            subtasks: [
              { id: 's15', title: 'Provision dual-key verification window', done: false },
              { id: 's16', title: 'Revoke previous key version', done: false },
            ],
            createdAt: daysAgo(4),
            updatedAt: daysAgo(1),
          },
          {
            projectId: pOnboard.id,
            title: 'Draft enterprise customer migration guide',
            description: 'Step-by-step rollout checklist for department managers.',
            assigneeId: sam.id,
            assigneeIds: [sam.id],
            createdById: priya.id,
            dueDate: offsetDateStr(6),
            priority: 'low',
            category: 'content',
            status: 'todo',
            tags: ['docs', 'customer'],
            subtasks: [],
            createdAt: daysAgo(3),
            updatedAt: daysAgo(3),
          },
          {
            projectId: pBilling.id,
            title: 'Reconcile Q1 mid-cycle proration credits',
            description: 'Processed credit adjustments for 47 enterprise workspaces.',
            assigneeId: priya.id,
            assigneeIds: [priya.id],
            createdById: priya.id,
            dueDate: offsetDateStr(-5),
            priority: 'high',
            category: 'ops',
            status: 'completed',
            tags: ['finance', 'ops'],
            subtasks: [
              { id: 's17', title: 'Audit affected invoices', done: true },
              { id: 's18', title: 'Issue credit memos', done: true },
            ],
            completedAt: daysAgo(4),
            createdAt: daysAgo(8),
            updatedAt: daysAgo(4),
          },
          {
            projectId: pOnboard.id,
            title: 'Ship role-based permission matrix UI',
            description: 'Clear breakdown of Admin, Manager, and Employee workspace permissions.',
            assigneeId: leah.id,
            assigneeIds: [leah.id, ravi.id],
            createdById: priya.id,
            dueDate: offsetDateStr(-3),
            priority: 'medium',
            category: 'design',
            status: 'completed',
            tags: ['rbac', 'ui'],
            subtasks: [
              { id: 's19', title: 'Component spec & accessibility review', done: true },
              { id: 's20', title: 'QA keyboard navigation', done: true },
            ],
            completedAt: daysAgo(2),
            createdAt: daysAgo(6),
            updatedAt: daysAgo(2),
          },
          {
            projectId: pSecurity.id,
            title: 'Audit webhook signature verification',
            description: 'Enforce HMAC-SHA256 constant-time checks on all inbound integrations.',
            assigneeId: ravi.id,
            assigneeIds: [ravi.id],
            createdById: priya.id,
            dueDate: offsetDateStr(-7),
            priority: 'medium',
            category: 'security',
            status: 'completed',
            tags: ['security', 'webhooks'],
            subtasks: [],
            completedAt: daysAgo(6),
            createdAt: daysAgo(9),
            updatedAt: daysAgo(6),
          },
          {
            projectId: pMobile.id,
            title: 'Trim production app bundle under 38 MB',
            description: 'Removed unused legacy sprite sheets and localized date bundles.',
            assigneeId: ravi.id,
            assigneeIds: [ravi.id],
            createdById: priya.id,
            dueDate: offsetDateStr(-40),
            priority: 'low',
            category: 'ops',
            status: 'completed',
            tags: ['perf', 'mobile'],
            archived: true,
            subtasks: [],
            completedAt: daysAgo(35),
            createdAt: daysAgo(42),
            updatedAt: daysAgo(35),
          },
        ])
        .returning();

      const [tColdStart, tOffline, tBillingHold, tOnboard] = [
        insertedTasks[0],
        insertedTasks[1],
        insertedTasks[2],
        insertedTasks[4],
      ];

      await db.insert(comments).values([
        {
          taskId: tColdStart.id,
          userId: ravi.id,
          message: 'Isolated the deadlock to concurrent background token refreshes. Implementing single-flight mutex today.',
          createdAt: hoursAgo(6),
        },
        {
          taskId: tColdStart.id,
          userId: priya.id,
          message: 'Prioritize this ahead of the v2.0 TestFlight cut. Ping Dana if you need backend grace-window logs.',
          createdAt: hoursAgo(4),
        },
        {
          taskId: tBillingHold.id,
          userId: dana.id,
          message: 'Placed On Hold pending finance approval on grandfathered annual discount SKUs.',
          createdAt: hoursAgo(16),
        },
      ]);

      await db.insert(activityLogs).values([
        {
          taskId: tColdStart.id,
          projectId: pMobile.id,
          userId: priya.id,
          action: 'task_created',
          oldValue: '',
          newValue: 'in_progress',
          summary: 'Created and assigned "Fix cold-start token refresh race on iOS" to Ravi Menon & Dana Ortiz',
          createdAt: daysAgo(2),
        },
        {
          taskId: tBillingHold.id,
          projectId: pBilling.id,
          userId: dana.id,
          action: 'task_status_changed',
          oldValue: 'in_progress',
          newValue: 'on_hold',
          summary: 'Moved "Map legacy plan SKUs to multi-seat price book" to On Hold',
          createdAt: hoursAgo(16),
        },
        {
          taskId: tOnboard.id,
          projectId: pOnboard.id,
          userId: leah.id,
          action: 'task_updated',
          oldValue: '1/3 subtasks',
          newValue: '2/3 subtasks',
          summary: 'Completed prototype progress indicator on "Consolidate workspace setup from 9 steps to 4"',
          createdAt: hoursAgo(6),
        },
      ]);

      await db.insert(notifications).values([
        {
          userId: ravi.id,
          taskId: tColdStart.id,
          senderId: priya.id,
          message: 'Overdue high-priority task: Fix cold-start token refresh race on iOS',
          type: 'overdue',
          isRead: false,
          createdAt: hoursAgo(3),
        },
        {
          userId: dana.id,
          taskId: tOffline.id,
          senderId: priya.id,
          message: 'Approaching deadline tomorrow: Ship offline draft mutation queue',
          type: 'deadline',
          isRead: false,
          createdAt: hoursAgo(5),
        },
      ]);

      await ensureStarterTemplates();
    } catch (err) {
      seedPromise = null;
      console.error('Failed to seed initial workspace data:', err);
      throw err;
    }
  })();

  return seedPromise;
}

async function ensureStarterTemplates(): Promise<void> {
  const [{ value: templateCount }] = await db.select({ value: count() }).from(taskTemplates);
  if (Number(templateCount) > 0) return;

  const existingActions = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(inArray(activityLogs.action, ['template_created', 'template_deleted']))
    .limit(1);
  if (existingActions.length > 0) return;

  const allUsers = await db.select().from(users);
  if (allUsers.length === 0) return;
  const allProjects = await db.select().from(projects);

  const creator = allUsers.find((u) => u.role === 'admin' || u.role === 'manager') || allUsers[0];
  const eng1 = allUsers[1] || creator;
  const eng2 = allUsers[2] || creator;
  const designer = allUsers[3] || creator;

  const pMobile = allProjects[0] || null;
  const pSecurity = allProjects[3] || allProjects[0] || null;
  const pOnboard = allProjects[2] || allProjects[0] || null;

  await db.insert(taskTemplates).values([
    {
      name: 'Weekly Release Checklist',
      title: 'Weekly Production Release Verification',
      description:
        'Standard pre-release QA, changelog verification, smoke checks, and rollback readiness before production deploy.',
      projectId: pMobile ? pMobile.id : null,
      assigneeIds: Array.from(new Set([creator.id, eng1.id])),
      priority: 'high',
      category: 'ops',
      status: 'todo',
      tags: ['release', 'qa', 'weekly'],
      dueOffsetDays: 3,
      subtasks: [
        { id: 'tpl-rel-1', title: 'Freeze release branch and verify CI checks pass', done: false },
        { id: 'tpl-rel-2', title: 'Run end-to-end smoke suite on staging', done: false },
        { id: 'tpl-rel-3', title: 'Publish release notes & confirm rollback tag', done: false },
      ],
      createdById: creator.id,
    },
    {
      name: 'Security Incident Triage',
      title: 'Security Alert Triage & Containment',
      description:
        'Structured response workflow for investigating vulnerability reports, rotating affected credentials, and documenting post-incident findings.',
      projectId: pSecurity ? pSecurity.id : null,
      assigneeIds: Array.from(new Set([eng2.id, creator.id])),
      priority: 'high',
      category: 'security',
      status: 'todo',
      tags: ['security', 'incident', 'soc2'],
      dueOffsetDays: 1,
      subtasks: [
        { id: 'tpl-sec-1', title: 'Confirm blast radius and isolate affected tokens', done: false },
        { id: 'tpl-sec-2', title: 'Patch vulnerability and deploy verification build', done: false },
        { id: 'tpl-sec-3', title: 'Record root-cause summary in audit log', done: false },
      ],
      createdById: creator.id,
    },
    {
      name: 'Customer Onboarding Kickoff',
      title: 'Enterprise Workspace Onboarding Kickoff',
      description:
        'Recurring customer launch checklist covering SSO/RBAC setup, initial project import, and stakeholder training call.',
      projectId: pOnboard ? pOnboard.id : null,
      assigneeIds: Array.from(new Set([designer.id])),
      priority: 'medium',
      category: 'design',
      status: 'todo',
      tags: ['onboarding', 'customer'],
      dueOffsetDays: 5,
      subtasks: [
        { id: 'tpl-onb-1', title: 'Provision workspace roles and initial project boards', done: false },
        { id: 'tpl-onb-2', title: 'Host 30-minute team walkthrough session', done: false },
      ],
      createdById: creator.id,
    },
  ]);
}
