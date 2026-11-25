import { ProjectRecord, TaskFilterState, TaskRecord, UserProfile } from '../types';

const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

export function escapeCsvCell(raw: string | number | null | undefined): string {
  const str = raw == null ? '' : String(raw);
  const safe = FORMULA_PREFIX_RE.test(str) ? `'${str}` : str;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildTasksCsv(
  tasks: TaskRecord[],
  projects: ProjectRecord[],
  users: UserProfile[]
): string {
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const statusLabels: Record<string, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    on_hold: 'On Hold',
    completed: 'Completed',
  };

  const headers = [
    'Title',
    'Status',
    'Priority',
    'Category',
    'Project',
    'Due Date',
    'Assignees',
    'Tags',
    'Sub-tasks Progress',
    'Archived',
    'Description',
  ];

  const rows = tasks.map((t) => {
    const subtasks = t.subtasks || [];
    const doneCount = subtasks.filter((s) => s.done).length;
    const progress = subtasks.length > 0 ? `${doneCount}/${subtasks.length}` : '';
    const assigneeNames = (t.assigneeIds.length > 0 ? t.assigneeIds : t.assigneeId ? [t.assigneeId] : [])
      .map((id) => userMap.get(id))
      .filter(Boolean)
      .join(', ');

    return [
      t.title,
      statusLabels[t.status] || t.status,
      t.priority,
      t.category,
      projectMap.get(t.projectId) || String(t.projectId),
      t.dueDate || '',
      assigneeNames || 'Unassigned',
      t.tags.join(', '),
      progress,
      t.archived ? 'Yes' : 'No',
      t.description || '',
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return `\uFEFF${[headers.map(escapeCsvCell).join(','), ...rows].join('\r\n')}`;
}

export function downloadTasksCsv(
  tasks: TaskRecord[],
  projects: ProjectRecord[],
  users: UserProfile[],
  filters: TaskFilterState
): { filename: string; count: number } {
  const csv = buildTasksCsv(tasks, projects, users);
  const datePart = new Date().toISOString().slice(0, 10);
  const projSlug =
    filters.projectId !== 'all'
      ? projects
          .find((p) => p.id === filters.projectId)
          ?.name.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 24)
      : '';
  const filename = ['cadence-tasks', projSlug, datePart].filter(Boolean).join('-') + '.csv';

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { filename, count: tasks.length };
}
