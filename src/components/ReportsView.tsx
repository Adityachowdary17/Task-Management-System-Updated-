import React, { useState } from 'react';
import { Download } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnalyticsSummary, DateFormatPref, PerspectiveMode } from '../types';
import { downloadAnalyticsPdf } from '../utils/pdfReport';

interface ReportsViewProps {
  analytics: AnalyticsSummary | null;
  isDark: boolean;
  dateFormat: DateFormatPref;
  perspective: PerspectiveMode;
  currentUserName?: string;
  onNotifyToast?: (msg: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  analytics,
  isDark,
  dateFormat,
  perspective,
  currentUserName,
  onNotifyToast,
}) => {
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!analytics) {
    return (
      <div className="ws-card p-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading analytics reports...
      </div>
    );
  }

  const handleDownloadPdf = () => {
    setDownloadingPdf(true);
    try {
      const { filename } = downloadAnalyticsPdf(analytics, {
        dateFormat,
        perspective,
        generatedByName: currentUserName,
      });
      onNotifyToast?.(`Downloaded ${filename}`);
    } catch (err) {
      onNotifyToast?.(err instanceof Error ? err.message : 'Unable to generate PDF report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const gridStroke = isDark ? '#334155' : '#E2E8F0';
  const tickFill = isDark ? '#94A3B8' : '#475569';
  const barFill = isDark ? '#60A5FA' : '#0F172A';
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
      <div className="ws-card ws-card-pad flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            Analytics &amp; Progress Reports
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {perspective === 'employee'
              ? 'Personal task delivery, throughput, and project milestones'
              : 'Workspace-wide delivery velocity, project progress, and team workload'}
          </p>
        </div>
        <button
          type="button"
          disabled={downloadingPdf}
          onClick={handleDownloadPdf}
          className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl px-4 py-2 text-xs font-semibold ws-accent-bg disabled:opacity-60 cursor-pointer"
        >
          <Download className="h-4 w-4" />
          {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="ws-card ws-card-pad">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Completion Rate
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {analytics.completionRate}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {analytics.completedTasks} of {analytics.totalTasks} tasks done
          </div>
        </div>
        <div className="ws-card ws-card-pad">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Avg Completion Time
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
            {analytics.avgCompletionHours}h
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Mean task cycle duration
          </div>
        </div>
        <div className="ws-card ws-card-pad">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Active In Progress
          </div>
          <div className="mt-2 font-mono text-3xl font-bold ws-accent-text tabular-nums">
            {analytics.inProgressTasks}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {analytics.todoTasks} to do · {analytics.onHoldTasks} on hold
          </div>
        </div>
        <div className="ws-card ws-card-pad">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Overdue Alerts
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-red-600 dark:text-red-400 tabular-nums">
            {analytics.overdueTasks}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {analytics.overdueTasks > 0 ? 'Past target due date' : 'All deadlines on track'}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="ws-card ws-card-pad lg:col-span-7">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
            7-Day Creation vs Completion Throughput
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Daily task intake compared against finished work
          </p>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.weeklyThroughput}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: tickFill }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke="#2563EB"
                  fill={isDark ? 'rgba(37, 99, 235, 0.25)' : '#DBEAFE'}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="#16A34A"
                  fill={isDark ? 'rgba(22, 163, 74, 0.25)' : '#DCFCE7'}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ws-card ws-card-pad lg:col-span-5">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
            Open Backlog by Priority
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Unfinished tasks segmented by urgency
          </p>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.priorityBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: tickFill }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Open Tasks" fill={barFill} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Project Progress Summary */}
      {analytics.projectProgress.length > 0 && (
        <div className="ws-card ws-card-pad">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                Project Progress Metrics
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Completion percentage and task throughput per initiative
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {analytics.projectProgress.map((proj) => (
              <div
                key={proj.projectId}
                className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: proj.color }}
                    />
                    <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {proj.name}
                    </span>
                    <span className="text-[11px] capitalize text-slate-400 dark:text-slate-500">
                      · {proj.status.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {proj.progress}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${proj.progress}%`, backgroundColor: proj.color }}
                  />
                </div>
                <div className="mt-1.5 font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {proj.completed} of {proj.total} tasks completed
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employee Performance & Workload Table */}
      <div className="ws-card overflow-x-auto">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
            Employee Workload &amp; Delivery Report
          </h3>
        </div>
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
            <tr>
              <th className="ws-cell">Team Member</th>
              <th className="ws-cell">Department</th>
              <th className="ws-cell text-right">Total</th>
              <th className="ws-cell text-right">Active</th>
              <th className="ws-cell text-right">Completed</th>
              <th className="ws-cell text-right">Overdue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {analytics.workloadByEmployee.map((row) => (
              <tr key={row.userId}>
                <td className="ws-cell font-semibold text-slate-900 dark:text-slate-100">
                  {row.name}
                </td>
                <td className="ws-cell text-slate-600 dark:text-slate-300">{row.department}</td>
                <td className="ws-cell text-right font-mono tabular-nums dark:text-slate-200">
                  {row.total}
                </td>
                <td className="ws-cell text-right font-mono ws-accent-text tabular-nums">
                  {row.active}
                </td>
                <td className="ws-cell text-right font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {row.completed}
                </td>
                <td className="ws-cell text-right font-mono text-red-600 dark:text-red-400 tabular-nums">
                  {row.overdue}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
