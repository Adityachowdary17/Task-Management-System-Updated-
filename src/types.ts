export type UserRole = 'admin' | 'manager' | 'employee';
export type TaskStatus = 'todo' | 'in_progress' | 'on_hold' | 'completed';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskCategory =
  | 'feature'
  | 'bug'
  | 'migration'
  | 'design'
  | 'ops'
  | 'content'
  | 'security'
  | 'research';
export type ProjectStatus = 'planning' | 'active' | 'at_risk' | 'completed';

export type WorkspaceModule =
  | 'dashboard'
  | 'projects'
  | 'tasks'
  | 'board'
  | 'calendar'
  | 'templates'
  | 'team'
  | 'reports'
  | 'notifications'
  | 'activity'
  | 'settings';

export type PerspectiveMode = 'manager' | 'employee';

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

export interface UserProfile {
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
  createdAt: string;
}

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

export interface ProjectRecord {
  id: number;
  name: string;
  description: string;
  color: string;
  ownerId: number;
  startDate: string;
  deadline: string;
  status: ProjectStatus;
  createdAt: string;
  taskCount?: number;
  completedCount?: number;
  overdueCount?: number;
  progress?: number;
}

export interface TaskRecord {
  id: number;
  projectId: number;
  title: string;
  description: string;
  assigneeId: number | null;
  assigneeIds: number[];
  createdById: number;
  dueDate: string;
  priority: TaskPriority;
  category: TaskCategory;
  status: TaskStatus;
  tags: string[];
  subtasks: SubtaskItem[];
  attachments: AttachmentItem[];
  archived: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTemplateRecord {
  id: number;
  name: string;
  title: string;
  description: string;
  projectId: number | null;
  assigneeIds: number[];
  priority: TaskPriority;
  category: TaskCategory;
  status: TaskStatus;
  tags: string[];
  subtasks: SubtaskItem[];
  dueOffsetDays: number | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentRecord {
  id: number;
  taskId: number;
  userId: number;
  message: string;
  attachments: AttachmentItem[];
  createdAt: string;
  authorName: string;
  authorRole: UserRole;
}

export interface NotificationRecord {
  id: number;
  userId: number;
  taskId: number | null;
  senderId: number | null;
  message: string;
  type: 'assignment' | 'status_update' | 'deadline' | 'overdue' | 'reminder' | 'comment';
  isRead: boolean;
  createdAt: string;
}

export interface ActivityRecord {
  id: number;
  taskId: number | null;
  projectId: number | null;
  userId: number;
  action: string;
  oldValue: string;
  newValue: string;
  summary: string;
  createdAt: string;
  actorName: string;
  actorRole: UserRole;
}

export interface AnalyticsSummary {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  onHoldTasks: number;
  todoTasks: number;
  overdueTasks: number;
  completionRate: number;
  avgCompletionHours: number;
  workloadByEmployee: Array<{
    userId: number;
    name: string;
    department: string;
    role: UserRole;
    total: number;
    active: number;
    completed: number;
    overdue: number;
  }>;
  projectProgress: Array<{
    projectId: number;
    name: string;
    color: string;
    status: ProjectStatus;
    total: number;
    completed: number;
    progress: number;
  }>;
  statusBreakdown: Array<{ name: string; value: number; color: string }>;
  priorityBreakdown: Array<{ name: string; count: number }>;
  weeklyThroughput: Array<{ day: string; created: number; completed: number }>;
}

export interface TaskFilterState {
  q: string;
  projectId: number | 'all';
  priority: TaskPriority | 'all';
  status: TaskStatus | 'all';
  assigneeId: number | 'all';
  tag: string;
  showArchived: boolean;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  sources: GroundingSource[];
}
