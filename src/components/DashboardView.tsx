import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDue } from '../constants';
import { api } from '../services/apiClient';
import {
  AnalyticsSummary,
  DateFormatPref,
  PerspectiveMode,
  ProjectRecord,
  TaskRecord,
  UserProfile,
} from '../types';

interface DashboardViewProps {
  currentUser: UserProfile;
  perspective: PerspectiveMode;
  analytics: AnalyticsSummary | null;
  tasks: TaskRecord[];
  projects: ProjectRecord[];
  users: UserProfile[];
  dateFormat: DateFormatPref;
  isDark: boolean;
  onOpenTask: (task: TaskRecord) => void;
  onNavigateModule: (mod: 'tasks' | 'board' | 'projects' | 'reports') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  perspective,
  analytics,
  tasks,
  projects,
  users,
  dateFormat,
  isDark,
  onOpenTask,
  onNavigateModule,
}) => {
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState('');
  const [briefing, setBriefing] = useState<{
    summary: string;
    focusStatus: 'on-track' | 'at-risk' | 'overloaded';
    nextSteps: Array<{ taskId: string; taskTitle: string; action: string; reason: string }>;
  } | null>(null);

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  const visibleTasks =
    perspective === 'employee'
      ? tasks.filter(
          (t) => t.assigneeId === currentUser.id || t.assigneeIds.includes(currentUser.id)
        )
      : tasks;

  const highPriorityOpen = visibleTasks.filter(
    (t) => t.priority === 'high' && t.status !== 'completed'
  );

  const upcomingTasks = visibleTasks
    .filter((t) => t.status !== 'completed')
    .slice(0, 6);

  const handleGenerateBriefing = async () => {
    if (highPriorityOpen.length === 0) return;
    setBriefingLoading(true);
    setBriefingError('');
    try {
      const payload = highPriorityOpen.slice(0, 20).map((t) => {
        const subDone = t.subtasks.filter((s) => s.done).length;
        const assigneeNames = t.assigneeIds
          .map((id) => userMap.get(id)?.name)
          .filter(Boolean)
          .join(', ');
        return {
          id: String(t.id),
          title: t.title,
          status: t.status,
          project: projectMap.get(t.projectId)?.name || 'Workspace',
          due: t.dueDate,
          assignee: assigneeNames || 'Unassigned',
          subtasksDone: subDone,
          subtasksTotal: t.subtasks.length,
        };
      });

      const res = await api.getPriorityBriefing({
        scopeLabel:
          perspective === 'employee'
            ? `Personal high-priority tasks for ${currentUser.name}`
            : 'Workspace high-priority tasks',
        tasks: payload,
      });
      setBriefing(res);
    } catch (err) {
      setBriefingError(err instanceof Error ? err.message : 'Unable to generate AI briefing.');
    } finally {
      setBriefingLoading(false);
    }
  };

  const kpis = analytics
    ? [
        {
          label: 'Total Tasks',
          value: analytics.totalTasks,
          sub: `${analytics.todoTasks} to do · ${analytics.onHoldTasks} on hold`,
          icon: Layers,
          accent: 'text-slate-900 dark:text-slate-50',
        },
        {
          label: 'Tasks Completed',
          value: analytics.completedTasks,
          sub: `${analytics.completionRate}% completion rate`,
          icon: CheckCircle2,
          accent: 'text-emerald-600 dark:text-emerald-400',
        },
        {
          label: 'In Progress',
          value: analytics.inProgressTasks,
          sub: 'Active execution queue',
          icon: TrendingUp,
          accent: 'ws-accent-text',
        },
        {
          label: 'Overdue Tasks',
          value: analytics.overdueTasks,
          sub:
            analytics.avgCompletionHours > 0
              ? `Avg cycle: ${analytics.avgCompletionHours}h`
              : 'Needs immediate attention',
          icon: AlertTriangle,
          accent:
            analytics.overdueTasks > 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-slate-700 dark:text-slate-200',
        },
      ]
    : [];

  const gridStroke = isDark ? '#334155' : '#E2E8F0';
  const tickFill = isDark ? '#94A3B8' : '#475569';
  const tooltipStyle = isDark
    ? {
        backgroundColor: '#0F172A',
        border: '1px solid #334155',
        borderRadius: '0.75rem',
        color: '#F8FAFC',
        fontSize: '12px',
      }
    : {
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '0.75rem',
        color: '#0F172A',
        fontSize: '12px',
      };

  return (
    <div className="ws-stack">
      {/* Header Summary Strip */}
      <div className="ws-card ws-card-pad-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider ws-accent-text">
            {perspective === 'employee' ? 'Employee Workspace' : 'Admin & Manager Control Center'}
          </div>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
            Welcome back, {currentUser.name.split(' ')[0]}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {perspective === 'employee'
              ? 'Your assigned deliverables, active checklists, and upcoming deadlines.'
              : 'Live operational KPIs, team workload distribution, and project delivery health.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/80">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Completion Rate
            </div>
            <div className="font-mono text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums">
              {analytics?.completionRate ?? 0}%
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/80">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Avg Completion Time
            </div>
            <div className="font-mono text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums">
              {analytics?.avgCompletionHours ?? 0}h
            </div>
          </div>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="ws-card ws-card-pad transition-colors hover:border-slate-300 dark:hover:border-slate-600"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </span>
                <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              </div>
              <div className={`mt-3 font-mono text-3xl font-bold tabular-nums ${kpi.accent}`}>
                {kpi.value}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{kpi.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Gemini High-Priority Briefing */}
      <div className="ws-card ws-card-pad">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border ws-accent-soft">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                High-Priority Next Steps Briefing
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {highPriorityOpen.length} open high-priority{' '}
                {highPriorityOpen.length === 1 ? 'task' : 'tasks'} in current scope
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={briefingLoading || highPriorityOpen.length === 0}
            onClick={handleGenerateBriefing}
            className="rounded-xl px-4 py-2 text-xs font-semibold transition-colors ws-accent-bg disabled:opacity-50 cursor-pointer"
          >
            {briefingLoading ? 'Analyzing queue...' : 'Generate Priority Summary'}
          </button>
        </div>

        {briefingError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
            {briefingError}
          </div>
        )}

        {briefing && (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {briefing.summary}
              </p>
              <span
                className={`rounded-md px-2.5 py-1 font-mono text-xs font-semibold uppercase ${
                  briefing.focusStatus === 'on-track'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : briefing.focusStatus === 'overloaded'
                      ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}
              >
                {briefing.focusStatus}
              </span>
            </div>

            {briefing.nextSteps.length > 0 && (
              <div className="grid gap-2.5 md:grid-cols-2">
                {briefing.nextSteps.map((step, i) => {
                  const matchedTask = tasks.find((t) => String(t.id) === step.taskId);
                  return (
                    <div
                      key={`${step.taskId}-${i}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {step.taskTitle}
                        </div>
                        {matchedTask && (
                          <button
                            type="button"
                            onClick={() => onOpenTask(matchedTask)}
                            className="shrink-0 text-xs font-semibold ws-accent-text hover:underline cursor-pointer"
                          >
                            Open
                          </button>
                        )}
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-800 dark:text-slate-200">
                        {step.action}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {step.reason}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Charts Row */}
      {analytics && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Workload by Employee */}
          <div className="ws-card ws-card-pad lg:col-span-7">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  Workload by Team Member
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Active vs completed task distribution
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateModule('reports')}
                className="inline-flex items-center gap-1 text-xs font-semibold ws-accent-text hover:underline cursor-pointer"
              >
                Full Reports <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.workloadByEmployee.slice(0, 7)}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: tickFill }}
                    tickFormatter={(v: string) => v.split(' ')[0]}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="active" name="Active" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#16A34A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Breakdown Donut */}
          <div className="ws-card ws-card-pad lg:col-span-5">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              Status Breakdown
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Current distribution across workflow stages
            </p>
            <div className="mt-2 h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.statusBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                  >
                    {analytics.statusBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {analytics.statusBreakdown.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-2.5 py-1.5 dark:border-slate-800"
                >
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.name}
                  </span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Split: Project Progress + Upcoming Deadlines */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="ws-card ws-card-pad lg:col-span-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              Project Progress Percentage
            </h3>
            <button
              type="button"
              onClick={() => onNavigateModule('projects')}
              className="text-xs font-semibold ws-accent-text hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {(analytics?.projectProgress || []).map((proj) => (
              <div key={proj.projectId}>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: proj.color }}
                    />
                    {proj.name}
                  </span>
                  <span className="font-mono font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                    {proj.completed}/{proj.total} ({proj.progress}%)
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${proj.progress}%`, backgroundColor: proj.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ws-card ws-card-pad lg:col-span-7">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              Upcoming & Overdue Deliverables
            </h3>
            <button
              type="button"
              onClick={() => onNavigateModule('tasks')}
              className="text-xs font-semibold ws-accent-text hover:underline cursor-pointer"
            >
              Open Task List
            </button>
          </div>
          {upcomingTasks.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              All assigned tasks are completed.
            </div>
          ) : (
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingTasks.map((task) => {
                const dueInfo = formatDue(task.dueDate, dateFormat);
                const proj = projectMap.get(task.projectId);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpenTask(task)}
                    className="flex w-full items-center justify-between gap-4 rounded-lg px-2 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {task.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{proj?.name || 'Project'}</span>
                        <span>·</span>
                        <span className="capitalize">{task.priority} priority</span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 font-mono text-xs font-semibold tabular-nums ${
                        dueInfo.state === 'over'
                          ? 'text-red-600 dark:text-red-400'
                          : dueInfo.state === 'today'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {dueInfo.formatted}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
