import React, { useState } from 'react';
import { MessageSquare, Paperclip } from 'lucide-react';
import { formatDue, getInitials, PRIORITIES, STATUSES } from '../constants';
import { DateFormatPref, ProjectRecord, TaskRecord, TaskStatus, UserProfile } from '../types';

interface BoardViewProps {
  tasks: TaskRecord[];
  projects: ProjectRecord[];
  users: UserProfile[];
  dateFormat: DateFormatPref;
  onOpenTask: (task: TaskRecord) => void;
  onStatusChange: (taskId: number, status: TaskStatus) => Promise<void>;
}

export const BoardView: React.FC<BoardViewProps> = ({
  tasks,
  projects,
  users,
  dateFormat,
  onOpenTask,
  onStatusChange,
}) => {
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  const handleDrop = async (targetStatus: TaskStatus) => {
    setDragOverCol(null);
    if (!dragTaskId) return;
    const task = tasks.find((t) => t.id === dragTaskId);
    setDragTaskId(null);
    if (task && task.status !== targetStatus) {
      await onStatusChange(task.id, targetStatus);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {STATUSES.map((column) => {
        const colTasks = tasks.filter((t) => t.status === column.id);
        const isDropTarget = dragOverCol === column.id;
        return (
          <div
            key={column.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(column.id);
            }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={() => void handleDrop(column.id)}
            style={{ borderRadius: 'var(--card-radius)', padding: 'var(--card-pad)' }}
            className={`flex min-h-[460px] flex-col border transition-colors ${
              isDropTarget
                ? 'ws-accent-border bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-slate-200 bg-slate-100/70 dark:border-slate-800 dark:bg-slate-900/70'
            }`}
          >
            <div className="flex items-center justify-between px-1 pb-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: column.dotColor }}
                />
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  {column.label}
                </h3>
              </div>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 tabular-nums">
                {colTasks.length}
              </span>
            </div>

            <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap)' }}>
              {colTasks.length === 0 ? (
                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  Drop tasks here
                </div>
              ) : (
                colTasks.map((task) => {
                  const proj = projectMap.get(task.projectId);
                  const prio = PRIORITIES.find((p) => p.id === task.priority);
                  const due = formatDue(task.dueDate, dateFormat);
                  const subTotal = task.subtasks.length;
                  const subDone = task.subtasks.filter((s) => s.done).length;
                  const subPct = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0;
                  const assignees = (
                    task.assigneeIds.length > 0
                      ? task.assigneeIds
                      : task.assigneeId
                        ? [task.assigneeId]
                        : []
                  )
                    .map((id) => userMap.get(id))
                    .filter((u): u is UserProfile => Boolean(u));

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDragTaskId(task.id)}
                      onDragEnd={() => {
                        setDragTaskId(null);
                        setDragOverCol(null);
                      }}
                      className="ws-card-sm ws-card-pad transition-colors hover:border-slate-400 dark:hover:border-slate-600"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {proj?.name || 'Workspace'}
                        </span>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                            prio?.badgeClass || ''
                          }`}
                        >
                          {prio?.label}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenTask(task)}
                        className="mt-2 block w-full text-left font-display text-sm font-bold text-slate-900 hover:underline dark:text-slate-50 cursor-pointer"
                      >
                        {task.title}
                      </button>

                      {subTotal > 0 && (
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span>Sub-tasks</span>
                            <span className="font-mono tabular-nums">
                              {subDone}/{subTotal}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${subPct}%`, backgroundColor: 'var(--accent)' }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                        <div className="flex -space-x-1.5">
                          {assignees.length > 0 ? (
                            assignees.slice(0, 3).map((u) => (
                              <span
                                key={u.id}
                                title={u.name}
                                className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-[#0F172A] font-mono text-[10px] font-semibold text-white dark:border-slate-900 dark:bg-slate-700"
                              >
                                {getInitials(u.name)}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400">Unassigned</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 text-[11px]">
                          {task.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 font-mono text-slate-500 dark:text-slate-400">
                              <Paperclip className="h-3 w-3" />
                              {task.attachments.length}
                            </span>
                          )}
                          <span
                            className={`font-mono font-semibold tabular-nums ${
                              due.state === 'over' && task.status !== 'completed'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {due.formatted}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <select
                          aria-label={`Change status for ${task.title}`}
                          value={task.status}
                          onChange={(e) => void onStatusChange(task.id, e.target.value as TaskStatus)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {STATUSES.map((s) => (
                            <option key={s.id} value={s.id}>
                              Move to: {s.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => onOpenTask(task)}
                          title="Open comments & attachments"
                          className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
