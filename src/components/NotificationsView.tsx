import React from 'react';
import { Bell, CheckCheck, Clock, AlertTriangle, MessageSquare, UserCheck } from 'lucide-react';
import { formatRelativeTime } from '../constants';
import { DateFormatPref, NotificationRecord } from '../types';

interface NotificationsViewProps {
  notifications: NotificationRecord[];
  dateFormat: DateFormatPref;
  onMarkRead: (id: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onOpenTaskById: (taskId: number | null) => void;
}

const TYPE_META: Record<
  NotificationRecord['type'],
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  assignment: {
    label: 'Assignment',
    icon: UserCheck,
    tone: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300',
  },
  status_update: {
    label: 'Status Update',
    icon: Bell,
    tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  deadline: {
    label: 'Approaching Deadline',
    icon: Clock,
    tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  },
  overdue: {
    label: 'Overdue Alert',
    icon: AlertTriangle,
    tone: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300',
  },
  reminder: {
    label: 'Manager Reminder',
    icon: Bell,
    tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300',
  },
  comment: {
    label: 'Comment',
    icon: MessageSquare,
    tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
};

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  dateFormat,
  onMarkRead,
  onMarkAllRead,
  onOpenTaskById,
}) => {
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="ws-stack">
      <div className="ws-card ws-card-pad flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            Notifications Center
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Assignments, status updates, approaching deadlines, overdue alerts, and reminders.
          </p>
        </div>

        <button
          type="button"
          disabled={unreadCount === 0}
          onClick={() => void onMarkAllRead()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
        >
          <CheckCheck className="h-4 w-4 ws-accent-text" />
          Mark All Read ({unreadCount})
        </button>
      </div>

      <div className="ws-card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
        {notifications.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-500 dark:text-slate-400">
            You are all caught up. No notifications yet.
          </div>
        ) : (
          notifications.map((n) => {
            const meta = TYPE_META[n.type] || TYPE_META.assignment;
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                className={`ws-cell flex flex-wrap items-center justify-between gap-4 ${
                  n.isRead ? '' : 'bg-blue-50/40 dark:bg-blue-950/25'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {meta.label}
                      </span>
                      {!n.isRead && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold ws-accent-bg">
                          New
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                        {formatRelativeTime(n.createdAt, dateFormat)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{n.message}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {n.taskId && (
                    <button
                      type="button"
                      onClick={() => onOpenTaskById(n.taskId)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Open Task
                    </button>
                  )}
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => void onMarkRead(n.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold ws-accent-bg cursor-pointer"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
