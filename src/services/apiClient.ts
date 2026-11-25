import {
  ActivityRecord,
  AnalyticsSummary,
  CommentRecord,
  NotificationRecord,
  ProjectRecord,
  ProjectStatus,
  SubtaskItem,
  TaskCategory,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  TaskTemplateRecord,
  UserPreferences,
  UserProfile,
  UserRole,
} from '../types';

// In-memory bearer token only (never persisted to localStorage or sessionStorage)
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // ignore non-json error bodies
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getBootstrapStatus: () => apiFetch<{ needsAdminClaim: boolean }>('/api/auth/bootstrap-status'),

  claimAdmin: (payload: { name: string; email: string; password: string; department?: string }) =>
    apiFetch<{ token: string; user: UserProfile }>('/api/auth/claim-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  signup: (payload: {
    name: string;
    email: string;
    password: string;
    role: 'employee' | 'manager';
    department?: string;
    jobTitle?: string;
  }) =>
    apiFetch<{ token: string; user: UserProfile }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ ok: boolean; message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  getMe: () => apiFetch<{ user: UserProfile }>('/api/auth/me'),

  updateProfile: (payload: {
    name?: string;
    department?: string;
    jobTitle?: string;
    currentPassword?: string;
    newPassword?: string;
  }) =>
    apiFetch<{ user: UserProfile }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updatePreferences: (payload: Partial<UserPreferences>) =>
    apiFetch<{ user: UserProfile }>('/api/auth/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  resetPreferences: () =>
    apiFetch<{ user: UserProfile }>('/api/auth/preferences/reset', {
      method: 'POST',
    }),

  submitDemoRequest: (payload: {
    name: string;
    email: string;
    company?: string;
    teamSize?: string;
    message?: string;
  }) =>
    apiFetch<{ id: number; message: string }>('/api/demo-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getUsers: () => apiFetch<UserProfile[]>('/api/users'),

  inviteUser: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    department: string;
    jobTitle: string;
  }) =>
    apiFetch<UserProfile>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUser: (
    id: number,
    payload: { role?: UserRole; department?: string; jobTitle?: string; isActive?: boolean }
  ) =>
    apiFetch<UserProfile>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getProjects: () => apiFetch<ProjectRecord[]>('/api/projects'),

  createProject: (payload: {
    name: string;
    description: string;
    color: string;
    startDate: string;
    deadline: string;
    status: ProjectStatus;
  }) =>
    apiFetch<ProjectRecord>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProject: (id: number, payload: Partial<ProjectRecord>) =>
    apiFetch<ProjectRecord>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteProject: (id: number) =>
    apiFetch<{ ok: boolean; id: number }>(`/api/projects/${id}`, {
      method: 'DELETE',
    }),

  getTasks: (showArchived = false) =>
    apiFetch<TaskRecord[]>(`/api/tasks?showArchived=${showArchived ? 'true' : 'false'}`),

  createTask: (payload: {
    projectId: number;
    title: string;
    description: string;
    assigneeIds: number[];
    dueDate: string;
    priority: TaskPriority;
    category: TaskCategory;
    status: TaskStatus;
    tags: string[];
    subtasks: SubtaskItem[];
  }) =>
    apiFetch<TaskRecord>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTask: (
    id: number,
    payload: Partial<{
      projectId: number;
      title: string;
      description: string;
      assigneeIds: number[];
      dueDate: string;
      priority: TaskPriority;
      category: TaskCategory;
      status: TaskStatus;
      tags: string[];
      subtasks: SubtaskItem[];
      archived: boolean;
    }>
  ) =>
    apiFetch<TaskRecord>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteTask: (id: number) =>
    apiFetch<{ ok: boolean; id: number }>(`/api/tasks/${id}`, {
      method: 'DELETE',
    }),

  bulkUpdateTasks: (payload: {
    taskIds: number[];
    status?: TaskStatus;
    projectId?: number;
  }) =>
    apiFetch<{ tasks: TaskRecord[] }>('/api/tasks/bulk-update', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  bulkDeleteTasks: (taskIds: number[]) =>
    apiFetch<{ ok: boolean; deletedIds: number[] }>('/api/tasks/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    }),

  getTaskTemplates: () => apiFetch<TaskTemplateRecord[]>('/api/task-templates'),

  createTaskTemplate: (payload: {
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
  }) =>
    apiFetch<TaskTemplateRecord>('/api/task-templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTaskTemplate: (
    id: number,
    payload: Partial<{
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
    }>
  ) =>
    apiFetch<TaskTemplateRecord>(`/api/task-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteTaskTemplate: (id: number) =>
    apiFetch<{ ok: boolean; id: number }>(`/api/task-templates/${id}`, {
      method: 'DELETE',
    }),

  instantiateTaskTemplate: (id: number, payload?: { projectId?: number; dueDate?: string }) =>
    apiFetch<TaskRecord>(`/api/task-templates/${id}/instantiate`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),

  sendTaskReminder: (id: number, note?: string) =>
    apiFetch<{ ok: boolean; count: number }>(`/api/tasks/${id}/remind`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  uploadAttachments: (taskId: number, files: FileList | File[]) => {
    const form = new FormData();
    Array.from(files)
      .slice(0, 3)
      .forEach((f) => form.append('files', f));
    return apiFetch<TaskRecord>(`/api/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: form,
    });
  },

  downloadAttachment: async (url: string, filename: string) => {
    const res = await fetch(url, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
    if (!res.ok) throw new Error('Unable to download file.');
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
  },

  getComments: (taskId: number) => apiFetch<CommentRecord[]>(`/api/tasks/${taskId}/comments`),

  addComment: (taskId: number, message: string) =>
    apiFetch<CommentRecord>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  getNotifications: () => apiFetch<NotificationRecord[]>('/api/notifications'),

  markNotificationRead: (id: number) =>
    apiFetch<NotificationRecord>(`/api/notifications/${id}/read`, { method: 'PATCH' }),

  markAllNotificationsRead: () =>
    apiFetch<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' }),

  getAnalytics: (scope: 'all' | 'mine' = 'all') =>
    apiFetch<AnalyticsSummary>(`/api/analytics?scope=${scope}`),

  getActivity: () => apiFetch<ActivityRecord[]>('/api/activity'),

  getPriorityBriefing: (payload: {
    scopeLabel: string;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      project: string;
      due: string;
      assignee: string;
      subtasksDone: number;
      subtasksTotal: number;
    }>;
  }) =>
    apiFetch<{
      summary: string;
      focusStatus: 'on-track' | 'at-risk' | 'overloaded';
      nextSteps: Array<{ taskId: string; taskTitle: string; action: string; reason: string }>;
      generatedAt: number;
    }>('/api/gemini/priority-briefing', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendGeminiChat: (payload: {
    message: string;
    history: Array<{ role: 'user' | 'model'; text: string }>;
    useSearch?: boolean;
    workspaceContext?: string;
  }) =>
    apiFetch<{ text: string; sources: Array<{ title: string; uri: string }> }>('/api/gemini/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
