import React from 'react';
import { History } from 'lucide-react';
import { formatRelativeTime } from '../constants';
import { ActivityRecord, DateFormatPref } from '../types';

interface ActivityLogViewProps {
  events: ActivityRecord[];
  dateFormat: DateFormatPref;
  onOpenTaskById: (taskId: number | null) => void;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({
  events,
  dateFormat,
  onOpenTaskById,
}) => {
  return (
    <div className="ws-stack">
      <div className="ws-card ws-card-pad">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
          Activity & Audit Log
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Chronological history of task updates, status transitions, projects, attachments, and
          reminders.
        </p>
      </div>

      <div className="ws-card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
        {events.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-500 dark:text-slate-400">
            No workspace activity recorded yet.
          </div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className="ws-cell flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <History className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    <span className="font-semibold">{ev.actorName}</span> · {ev.summary}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{ev.action.replace(/_/g, ' ')}</span>
                    {ev.oldValue && ev.newValue && (
                      <span>
                        ({ev.oldValue} → {ev.newValue})
                      </span>
                    )}
                    <span>· {formatRelativeTime(ev.createdAt, dateFormat)}</span>
                  </div>
                </div>
              </div>

              {ev.taskId && (
                <button
                  type="button"
                  onClick={() => onOpenTaskById(ev.taskId)}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  View Task
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
