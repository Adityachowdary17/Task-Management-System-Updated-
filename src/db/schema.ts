import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface SubtaskItem {
  id: string;
  title: string;
  done: boolean;
}

export interface AttachmentItem {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedById: number;
  uploadedByName: string;
  uploadedAt: string;
}

export type ThemeModePref = 'light' | 'dark' | 'system';
export type UiDensityPref = 'comfortable' | 'compact';
export type FontSizePref = 'small' | 'medium' | 'large';
export type SidebarBehaviorPref = 'expanded' | 'collapsed';
export type TaskCardStylePref = 'rounded' | 'minimal';
export type DateFormatPref = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type DefaultTaskViewPref = 'overview' | 'all_tasks' | 'board' | 'calendar';
export type DefaultTaskSortPref = 'due_date' | 'priority' | 'updated' | 'title';

export interface UserPreferences {
  themeMode: ThemeModePref;
  accentColor: string;
  density: UiDensityPref;
  fontSize: FontSizePref;
  sidebarBehavior: SidebarBehaviorPref;
  taskCardStyle: TaskCardStylePref;
  dateFormat: DateFormatPref;
  defaultTaskView: DefaultTaskViewPref;
  defaultTaskSort: DefaultTaskSortPref;
  showCompletedByDefault: boolean;
  reduceMotion: boolean;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  themeMode: 'light',
  accentColor: '#2563EB',
  density: 'comfortable',
  fontSize: 'medium',
  sidebarBehavior: 'expanded',
  taskCardStyle: 'rounded',
  dateFormat: 'YYYY-MM-DD',
  defaultTaskView: 'overview',
  defaultTaskSort: 'due_date',
  showCompletedByDefault: true,
  reduceMotion: false,
};

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('employee'), // 'admin' | 'manager' | 'employee'
  department: text('department').notNull().default('Engineering'),
  jobTitle: text('job_title').notNull().default('Team Member'),
  avatar: text('avatar').notNull().default(''),
  preferences: jsonb('preferences')
    .$type<UserPreferences>()
    .notNull()
    .default(DEFAULT_USER_PREFERENCES),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  color: text('color').notNull().default('#1E40AF'),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  startDate: text('start_date').notNull(),
  deadline: text('deadline').notNull(),
  status: text('status').notNull().default('active'), // 'planning' | 'active' | 'at_risk' | 'completed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  assigneeId: integer('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  assigneeIds: jsonb('assignee_ids').$type<number[]>().notNull().default([]),
  createdById: integer('created_by_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  dueDate: text('due_date').notNull().default(''),
  priority: text('priority').notNull().default('medium'), // 'high' | 'medium' | 'low'
  category: text('category').notNull().default('feature'),
  status: text('status').notNull().default('todo'), // 'todo' | 'in_progress' | 'on_hold' | 'completed'
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  subtasks: jsonb('subtasks').$type<SubtaskItem[]>().notNull().default([]),
  attachments: jsonb('attachments').$type<AttachmentItem[]>().notNull().default([]),
  archived: boolean('archived').notNull().default(false),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const taskTemplates = pgTable('task_templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  assigneeIds: jsonb('assignee_ids').$type<number[]>().notNull().default([]),
  priority: text('priority').notNull().default('medium'),
  category: text('category').notNull().default('feature'),
  status: text('status').notNull().default('todo'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  subtasks: jsonb('subtasks').$type<SubtaskItem[]>().notNull().default([]),
  dueOffsetDays: integer('due_offset_days'),
  createdById: integer('created_by_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  message: text('message').notNull(),
  attachments: jsonb('attachments').$type<AttachmentItem[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  senderId: integer('sender_id').references(() => users.id, { onDelete: 'set null' }),
  message: text('message').notNull(),
  type: text('type').notNull().default('assignment'), // 'assignment' | 'status_update' | 'deadline' | 'overdue' | 'reminder' | 'comment'
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  action: text('action').notNull(),
  oldValue: text('old_value').notNull().default(''),
  newValue: text('new_value').notNull().default(''),
  summary: text('summary').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const demoRequests = pgTable('demo_requests', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  company: text('company').notNull().default(''),
  teamSize: text('team_size').notNull().default('10-50'),
  message: text('message').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  ownedProjects: many(projects),
  assignedTasks: many(tasks, { relationName: 'taskAssignee' }),
  createdTasks: many(tasks, { relationName: 'taskCreator' }),
  comments: many(comments),
  notifications: many(notifications),
  activityLogs: many(activityLogs),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: 'taskAssignee',
  }),
  creator: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
    relationName: 'taskCreator',
  }),
  comments: many(comments),
  notifications: many(notifications),
  activityLogs: many(activityLogs),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, {
    fields: [comments.taskId],
    references: [tasks.id],
  }),
  author: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [notifications.taskId],
    references: [tasks.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  task: one(tasks, {
    fields: [activityLogs.taskId],
    references: [tasks.id],
  }),
  project: one(projects, {
    fields: [activityLogs.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ one }) => ({
  project: one(projects, {
    fields: [taskTemplates.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [taskTemplates.createdById],
    references: [users.id],
  }),
}));
