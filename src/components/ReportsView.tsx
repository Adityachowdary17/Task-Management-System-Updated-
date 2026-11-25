import React from 'react';
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
import { AnalyticsSummary } from '../types';

interface ReportsViewProps {
  analytics: AnalyticsSummary | null;
  isDark: boolean;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ analytics, isDark }) => {
  if (!analytics) {
    return (
      <div className="ws-card p-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading analytics reports...
      </div>
    );
  }

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="ws-card ws-card-pad">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Completion Rate
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {analytics.completionRate}%
          </div>
        </div>
        <div className="ws-card ws-card-pad">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Avg Completion Time
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
            {analytics.avgCompletionHours}h
          </div>
        </div>
        <div className="ws-card ws-card-pad">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Active In Progress
          </div>
          <div className="mt-2 font-mono text-3xl font-bold ws-accent-text tabular-nums">
            {analytics.inProgressTasks}
          </div>
        </div>
        <div className="ws-card ws-card-pad">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Overdue Alerts
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-red-600 dark:text-red-400 tabular-nums">
            {analytics.overdueTasks}
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

      {/* Employee Performance & Workload Table */}
      <div className="ws-card overflow-x-auto">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
            Employee Workload & Delivery Report
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
