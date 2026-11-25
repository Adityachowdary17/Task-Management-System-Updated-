import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProjectRecord, TaskRecord } from '../types';

interface CalendarViewProps {
  tasks: TaskRecord[];
  projects: ProjectRecord[];
  onOpenTask: (task: TaskRecord) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, projects, onOpenTask }) => {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayIso = new Date().toISOString().slice(0, 10);

  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: Array<{ iso: string | null; day: number | null }> = [];
    for (let i = 0; i < firstWeekday; i++) list.push({ iso: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      list.push({ iso: `${year}-${mStr}-${dStr}`, day: d });
    }
    while (list.length % 7 !== 0) list.push({ iso: null, day: null });
    return list;
  }, [year, month]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskRecord[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const list = map.get(t.dueDate) || [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [tasks]);

  return (
    <div className="ws-stack">
      <div className="ws-card ws-card-pad flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click any task pill to review or update deadlines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            aria-label="Previous month"
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const n = new Date();
              setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            aria-label="Next month"
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="ws-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2.5">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
          {cells.map((cell, idx) => {
            const dayTasks = cell.iso ? tasksByDate.get(cell.iso) || [] : [];
            const isToday = cell.iso === todayIso;
            return (
              <div
                key={idx}
                className={`min-h-[112px] p-2 ${
                  cell.iso
                    ? 'bg-white dark:bg-slate-900'
                    : 'bg-slate-50/70 dark:bg-slate-950/60'
                }`}
              >
                {cell.day && (
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-semibold tabular-nums ${
                        isToday ? 'ws-accent-bg' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {cell.day}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-1.5 space-y-1">
                  {dayTasks.slice(0, 3).map((t) => {
                    const proj = projectMap.get(t.projectId);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onOpenTask(t)}
                        className={`block w-full truncate rounded-md border px-1.5 py-1 text-left text-[11px] font-medium transition-colors cursor-pointer ${
                          t.status === 'completed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 line-through dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500'
                        }`}
                      >
                        <span
                          className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: proj?.color || '#2563EB' }}
                        />
                        {t.title}
                      </button>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <div className="px-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
