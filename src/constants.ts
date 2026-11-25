import {
  DateFormatPref,
  ProjectStatus,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  UserPreferences,
} from './types';

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

export const ACCENT_PRESETS: Array<{ name: string; hex: string }> = [
  { name: 'Cobalt Blue', hex: '#2563EB' },
  { name: 'Electric Indigo', hex: '#4F46E5' },
  { name: 'Teal Pulse', hex: '#0D9488' },
  { name: 'Emerald Green', hex: '#059669' },
  { name: 'Warm Amber', hex: '#D97706' },
  { name: 'Crimson Rose', hex: '#E11D48' },
];

export function computeAccentTokens(hex: string): {
  accent: string;
  hover: string;
  soft: string;
  border: string;
  fg: string;
} {
  const clean = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : '#2563EB';
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);

  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  const fg = lum > 0.42 ? '#0F172A' : '#FFFFFF';

  const darken = (c: number) => Math.max(0, Math.round(c * 0.84));
  const hover = `#${[darken(r), darken(g), darken(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;

  return {
    accent: clean,
    hover,
    soft: `rgba(${r}, ${g}, ${b}, 0.13)`,
    border: `rgba(${r}, ${g}, ${b}, 0.35)`,
    fg,
  };
}

export const STATUSES: { id: TaskStatus; label: string; badgeClass: string; dotColor: string }[] = [
  {
    id: 'todo',
    label: 'To Do',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    dotColor: '#64748B',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    dotColor: '#2563EB',
  },
  {
    id: 'on_hold',
    label: 'On Hold',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    dotColor: '#D97706',
  },
  {
    id: 'completed',
    label: 'Completed',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    dotColor: '#16A34A',
  },
];

export const PRIORITIES: { id: TaskPriority; label: string; badgeClass: string }[] = [
  {
    id: 'high',
    label: 'High',
    badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
  },
  {
    id: 'medium',
    label: 'Medium',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  },
  {
    id: 'low',
    label: 'Low',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
];

export const CATEGORIES: { id: TaskCategory; label: string; color: string }[] = [
  { id: 'feature', label: 'Feature', color: '#2563EB' },
  { id: 'bug', label: 'Bug', color: '#DC2626' },
  { id: 'migration', label: 'Migration', color: '#4F46E5' },
  { id: 'design', label: 'Design', color: '#0284C7' },
  { id: 'ops', label: 'Ops', color: '#475569' },
  { id: 'content', label: 'Content', color: '#D97706' },
  { id: 'security', label: 'Security', color: '#B91C1C' },
  { id: 'research', label: 'Research', color: '#0F766E' },
];

export const PROJECT_STATUSES: { id: ProjectStatus; label: string; badgeClass: string }[] = [
  {
    id: 'planning',
    label: 'Planning',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  },
  {
    id: 'active',
    label: 'Active',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
  },
  {
    id: 'at_risk',
    label: 'At Risk',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  },
  {
    id: 'completed',
    label: 'Completed',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  },
];

export const PROJECT_COLORS = [
  '#2563EB',
  '#0F766E',
  '#4F46E5',
  '#D97706',
  '#0284C7',
  '#7C3AED',
  '#DC2626',
  '#334155',
];

export function formatDisplayDate(
  isoOrDate: string,
  dateFormat: DateFormatPref = 'YYYY-MM-DD'
): string {
  if (!isoOrDate) return 'No date';
  const ymd = isoOrDate.slice(0, 10);
  const parts = ymd.split('-');
  if (parts.length !== 3 || parts[0].length !== 4) return isoOrDate;
  const [yyyy, mm, dd] = parts;
  if (dateFormat === 'DD/MM/YYYY') return `${dd}/${mm}/${yyyy}`;
  if (dateFormat === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDue(
  s: string,
  dateFormat: DateFormatPref = 'YYYY-MM-DD'
): {
  text: string;
  formatted: string;
  state: 'none' | 'today' | 'soon' | 'over' | 'far';
} {
  if (!s) return { text: 'No due date', formatted: 'No due date', state: 'none' };
  const formatted = formatDisplayDate(s, dateFormat);
  const parts = s.split('-');
  if (parts.length !== 3) return { text: s, formatted, state: 'far' };
  const target = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diff === 0) return { text: 'Today', formatted, state: 'today' };
  if (diff === 1) return { text: 'Tomorrow', formatted, state: 'soon' };
  if (diff === -1) return { text: 'Yesterday', formatted, state: 'over' };
  if (diff < -1) return { text: `${Math.abs(diff)}d overdue`, formatted, state: 'over' };
  if (diff < 7) return { text: `In ${diff}d`, formatted, state: 'soon' };
  return {
    text: formatted,
    formatted,
    state: 'far',
  };
}

export function formatRelativeTime(
  isoOrMs: string | number,
  dateFormat: DateFormatPref = 'YYYY-MM-DD'
): string {
  const ts = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
  if (Number.isNaN(ts)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDisplayDate(new Date(ts).toISOString().slice(0, 10), dateFormat);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
