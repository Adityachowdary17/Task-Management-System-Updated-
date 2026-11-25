import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { MotionConfig } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import {
  Archive,
  BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  Globe,
  History,
  Kanban,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { auth } from './firebase';
import { computeAccentTokens, DEFAULT_USER_PREFERENCES, getInitials } from './constants';
import { api, getAuthToken, setAuthToken } from './services/apiClient';
import {
  ActivityRecord,
  AnalyticsSummary,
  DefaultTaskSortPref,
  DefaultTaskViewPref,
  NotificationRecord,
  PerspectiveMode,
  ProjectRecord,
  TaskFilterState,
  TaskRecord,
  TaskStatus,
  TaskTemplateRecord,
  UserPreferences,
  UserProfile,
  WorkspaceModule,
} from './types';
import { ActivityLogView } from './components/ActivityLogView';
import { AuthScreen } from './components/AuthScreen';
import { BoardView } from './components/BoardView';
import { CalendarView } from './components/CalendarView';
import { DashboardView } from './components/DashboardView';
import { LandingPage } from './components/LandingPage';
import { ListView } from './components/ListView';
import { NotificationsView } from './components/NotificationsView';
import { ProjectsView } from './components/ProjectsView';
import { ReportsView } from './components/ReportsView';
import { ResearchDrawer } from './components/ResearchDrawer';
import { SettingsView } from './components/SettingsView';
import { TaskModal } from './components/TaskModal';
import { TeamView } from './components/TeamView';
import { TemplatesView } from './components/TemplatesView';

const NAV_ITEMS: Array<{
  id: WorkspaceModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'board', label: 'Kanban Board', icon: Kanban },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'activity', label: 'Activity Log', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function mapDefaultViewToModule(view: DefaultTaskViewPref): WorkspaceModule {
  if (view === 'all_tasks') return 'tasks';
  if (view === 'board') return 'board';
  if (view === 'calendar') return 'calendar';
  return 'dashboard';
}

const PRIORITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const App: React.FC = () => {
  const [surface, setSurface] = useState<'landing' | 'auth' | 'workspace'>('landing');
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [perspective, setPerspective] = useState<PerspectiveMode>('manager');

  const [activeModule, setActiveModule] = useState<WorkspaceModule>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);

  const [osDark, setOsDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );
  const [osReducedMotion, setOsReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplateRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  const [filters, setFilters] = useState<TaskFilterState>({
    q: '',
    projectId: 'all',
    priority: 'all',
    status: 'all',
    assigneeId: 'all',
    tag: 'all',
    showArchived: false,
  });

  const [taskSort, setTaskSort] = useState<DefaultTaskSortPref>('due_date');
  const [showCompleted, setShowCompleted] = useState<boolean>(true);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const [prefillTemplate, setPrefillTemplate] = useState<TaskTemplateRecord | null>(null);
  const [toast, setToast] = useState<string>('');

  const initializedUserIdRef = useRef<number | null>(null);
  const prefSeqRef = useRef(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? '' : prev));
    }, 3200);
  }, []);

  // Watch OS color scheme and reduced-motion preferences
  useEffect(() => {
    const colorMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onColor = (e: MediaQueryListEvent) => setOsDark(e.matches);
    const onMotion = (e: MediaQueryListEvent) => setOsReducedMotion(e.matches);
    colorMedia.addEventListener('change', onColor);
    motionMedia.addEventListener('change', onMotion);
    return () => {
      colorMedia.removeEventListener('change', onColor);
      motionMedia.removeEventListener('change', onMotion);
    };
  }, []);

  const prefs = currentUser?.preferences || DEFAULT_USER_PREFERENCES;
  const effectiveDark = prefs.themeMode === 'dark' || (prefs.themeMode === 'system' && osDark);
  const effectiveReduceMotion = prefs.reduceMotion || osReducedMotion;

  // Apply user customization CSS variables and attributes globally across the workspace
  useEffect(() => {
    const root = document.documentElement;
    if (surface !== 'workspace' || !currentUser) {
      root.classList.remove('dark');
      root.removeAttribute('data-density');
      root.removeAttribute('data-card-style');
      root.removeAttribute('data-reduce-motion');
      root.style.fontSize = '';
      return;
    }

    root.classList.toggle('dark', effectiveDark);
    root.setAttribute('data-density', prefs.density);
    root.setAttribute('data-card-style', prefs.taskCardStyle);
    root.setAttribute('data-reduce-motion', effectiveReduceMotion ? 'true' : 'false');

    const fontMap = { small: '14px', medium: '16px', large: '17.5px' };
    root.style.fontSize = fontMap[prefs.fontSize] || '16px';

    const tokens = computeAccentTokens(prefs.accentColor);
    root.style.setProperty('--accent', tokens.accent);
    root.style.setProperty('--accent-hover', tokens.hover);
    root.style.setProperty('--accent-soft', tokens.soft);
    root.style.setProperty('--accent-border', tokens.border);
    root.style.setProperty('--accent-fg', tokens.fg);
  }, [surface, currentUser, prefs, effectiveDark, effectiveReduceMotion]);

  // Apply user's default module, sidebar behavior, sort, and showCompleted once per login/session
  const applyInitialUserDefaults = useCallback((user: UserProfile) => {
    const userPrefs = user.preferences || DEFAULT_USER_PREFERENCES;
    setActiveModule(mapDefaultViewToModule(userPrefs.defaultTaskView));
    setSidebarCollapsed(userPrefs.sidebarBehavior === 'collapsed');
    setTaskSort(userPrefs.defaultTaskSort);
    setShowCompleted(userPrefs.showCompletedByDefault);
    initializedUserIdRef.current = user.id;
  }, []);

  const loadWorkspaceData = useCallback(
    async (showArchived: boolean, activePerspective: PerspectiveMode) => {
      const scope = activePerspective === 'employee' ? 'mine' : 'all';
      const [uList, pList, tList, tplList, nList, aList, stats] = await Promise.all([
        api.getUsers(),
        api.getProjects(),
        api.getTasks(showArchived),
        api.getTaskTemplates(),
        api.getNotifications(),
        api.getActivity(),
        api.getAnalytics(scope),
      ]);
      setUsers(uList);
      setProjects(pList);
      setTasks(tList);
      setTaskTemplates(tplList);
      setNotifications(nList);
      setActivity(aList);
      setAnalytics(stats);
    },
    []
  );

  // Restore Firebase Google session silently if present
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && !getAuthToken()) {
        try {
          const idToken = await fbUser.getIdToken();
          setAuthToken(idToken);
          const { user } = await api.getMe();
          setCurrentUser(user);
          setPerspective(user.role === 'employee' ? 'employee' : 'manager');
          if (initializedUserIdRef.current !== user.id) {
            applyInitialUserDefaults(user);
          }
          setSurface('workspace');
        } catch {
          setAuthToken(null);
        }
      }
    });
    return () => unsub();
  }, [applyInitialUserDefaults]);

  // Load workspace data when authenticated
  useEffect(() => {
    if (surface !== 'workspace' || !currentUser) return;
    void loadWorkspaceData(filters.showArchived, perspective).catch((err) => {
      showToast(err instanceof Error ? err.message : 'Unable to refresh workspace.');
    });
  }, [surface, currentUser?.id, filters.showArchived, perspective, loadWorkspaceData, showToast]);

  // Real-time Socket.io sync
  useEffect(() => {
    const token = getAuthToken();
    if (surface !== 'workspace' || !currentUser || !token) return;

    const socket: Socket = io({
      path: '/socket.io',
      auth: { token },
    });

    socket.on('task:created', (created: TaskRecord) => {
      setTasks((prev) => (prev.some((t) => t.id === created.id) ? prev : [created, ...prev]));
      void api.getAnalytics(perspective === 'employee' ? 'mine' : 'all').then(setAnalytics).catch(() => {});
      void api.getProjects().then(setProjects).catch(() => {});
    });

    socket.on('task:updated', (updated: TaskRecord) => {
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === updated.id);
        if (!exists) return prev;
        return prev.map((t) => (t.id === updated.id ? updated : t));
      });
      void api.getAnalytics(perspective === 'employee' ? 'mine' : 'all').then(setAnalytics).catch(() => {});
      void api.getProjects().then(setProjects).catch(() => {});
      void api.getActivity().then(setActivity).catch(() => {});
    });

    socket.on('task:deleted', ({ id }: { id: number }) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      void api.getAnalytics(perspective === 'employee' ? 'mine' : 'all').then(setAnalytics).catch(() => {});
      void api.getProjects().then(setProjects).catch(() => {});
    });

    socket.on('project:created', (proj: ProjectRecord) => {
      setProjects((prev) => (prev.some((p) => p.id === proj.id) ? prev : [...prev, proj]));
    });

    socket.on('project:updated', (proj: ProjectRecord) => {
      setProjects((prev) => prev.map((p) => (p.id === proj.id ? { ...p, ...proj } : p)));
    });

    socket.on('project:deleted', ({ id }: { id: number }) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setTasks((prev) => prev.filter((t) => t.projectId !== id));
    });

    socket.on('notification:created', (notif: NotificationRecord) => {
      setNotifications((prev) => (prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev]));
      showToast(notif.message);
    });

    socket.on('team:updated', ({ user }: { user: UserProfile }) => {
      setUsers((prev) => {
        const exists = prev.some((u) => u.id === user.id);
        return exists ? prev.map((u) => (u.id === user.id ? user : u)) : [...prev, user];
      });
    });

    socket.on('template:created', (tpl: TaskTemplateRecord) => {
      setTaskTemplates((prev) => (prev.some((t) => t.id === tpl.id) ? prev : [tpl, ...prev]));
    });

    socket.on('template:updated', (tpl: TaskTemplateRecord) => {
      setTaskTemplates((prev) => prev.map((t) => (t.id === tpl.id ? tpl : t)));
    });

    socket.on('template:deleted', ({ id }: { id: number }) => {
      setTaskTemplates((prev) => prev.filter((t) => t.id !== id));
    });

    return () => {
      socket.disconnect();
    };
  }, [surface, currentUser?.id, perspective, showToast]);

  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (!filters.showArchived && t.archived) return false;
      if (!showCompleted && filters.status !== 'completed' && t.status === 'completed') return false;
      if (perspective === 'employee' && currentUser) {
        const assigned = t.assigneeId === currentUser.id || t.assigneeIds.includes(currentUser.id);
        if (!assigned) return false;
      }
      if (filters.projectId !== 'all' && t.projectId !== filters.projectId) return false;
      if (filters.priority !== 'all' && t.priority !== filters.priority) return false;
      if (filters.status !== 'all' && t.status !== filters.status) return false;
      if (filters.assigneeId !== 'all') {
        const matchAssignee =
          t.assigneeId === filters.assigneeId || t.assigneeIds.includes(filters.assigneeId);
        if (!matchAssignee) return false;
      }
      if (filters.tag !== 'all' && !t.tags.includes(filters.tag)) return false;
      if (filters.q.trim()) {
        const q = filters.q.trim().toLowerCase();
        const hay = `${t.title} ${t.description} ${t.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (taskSort === 'priority') {
        const diff = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
        if (diff !== 0) return diff;
      } else if (taskSort === 'updated') {
        const diff = (b.updatedAt || '').localeCompare(a.updatedAt || '');
        if (diff !== 0) return diff;
      } else if (taskSort === 'title') {
        const diff = a.title.localeCompare(b.title);
        if (diff !== 0) return diff;
      } else {
        const aDue = a.dueDate || '9999-12-31';
        const bDue = b.dueDate || '9999-12-31';
        const diff = aDue.localeCompare(bDue);
        if (diff !== 0) return diff;
      }
      return a.id - b.id;
    });
  }, [tasks, filters, perspective, currentUser, showCompleted, taskSort]);

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

  const handlePreferencesChange = async (patch: Partial<UserPreferences>) => {
    if (!currentUser) return;
    const prevUser = currentUser;
    const nextPrefs: UserPreferences = {
      ...(currentUser.preferences || DEFAULT_USER_PREFERENCES),
      ...patch,
    };

    // Immediate optimistic UI update
    setCurrentUser({ ...currentUser, preferences: nextPrefs });
    if (patch.sidebarBehavior !== undefined) {
      setSidebarCollapsed(patch.sidebarBehavior === 'collapsed');
    }
    if (patch.defaultTaskSort !== undefined) {
      setTaskSort(patch.defaultTaskSort);
    }
    if (patch.showCompletedByDefault !== undefined) {
      setShowCompleted(patch.showCompletedByDefault);
    }

    const seq = ++prefSeqRef.current;
    try {
      const res = await api.updatePreferences(nextPrefs);
      if (seq === prefSeqRef.current) {
        setCurrentUser(res.user);
      }
    } catch (err) {
      if (seq === prefSeqRef.current) {
        setCurrentUser(prevUser);
      }
      throw err;
    }
  };

  const handleResetPreferences = async () => {
    if (!currentUser) return;
    const res = await api.resetPreferences();
    setCurrentUser(res.user);
    const resetPrefs = res.user.preferences || DEFAULT_USER_PREFERENCES;
    setSidebarCollapsed(resetPrefs.sidebarBehavior === 'collapsed');
    setTaskSort(resetPrefs.defaultTaskSort);
    setShowCompleted(resetPrefs.showCompletedByDefault);
    showToast('Workspace customization reset to defaults');
  };

  const handleLogout = async () => {
    setAuthToken(null);
    setCurrentUser(null);
    initializedUserIdRef.current = null;
    setSurface('landing');
    try {
      await signOut(auth);
    } catch {
      // ignore if signed in via JWT only
    }
  };

  const handleTaskStatusChange = async (taskId: number, nextStatus: TaskStatus) => {
    try {
      const updated = await api.updateTask(taskId, { status: nextStatus });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      showToast(`Updated "${updated.title}" to ${nextStatus.replace('_', ' ')}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update task status.');
    }
  };

  const handleSendReminder = async (taskId: number) => {
    try {
      const res = await api.sendTaskReminder(taskId);
      showToast(`Reminder sent to ${res.count} assignee(s)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to send reminder.');
    }
  };

  const handleBulkTaskUpdate = async (
    taskIds: number[],
    updates: { status?: TaskStatus; projectId?: number }
  ) => {
    const res = await api.bulkUpdateTasks({ taskIds, ...updates });
    const updatedMap = new Map(res.tasks.map((t) => [t.id, t]));
    setTasks((prev) => prev.map((t) => updatedMap.get(t.id) || t));
    void api
      .getAnalytics(perspective === 'employee' ? 'mine' : 'all')
      .then(setAnalytics)
      .catch(() => {});
    void api.getProjects().then(setProjects).catch(() => {});
    void api.getActivity().then(setActivity).catch(() => {});
    showToast(`Updated ${res.tasks.length} tasks`);
  };

  const handleBulkTaskDelete = async (taskIds: number[]) => {
    const res = await api.bulkDeleteTasks(taskIds);
    const deletedSet = new Set(res.deletedIds);
    setTasks((prev) => prev.filter((t) => !deletedSet.has(t.id)));
    void api
      .getAnalytics(perspective === 'employee' ? 'mine' : 'all')
      .then(setAnalytics)
      .catch(() => {});
    void api.getProjects().then(setProjects).catch(() => {});
    void api.getActivity().then(setActivity).catch(() => {});
    showToast(`Deleted ${res.deletedIds.length} tasks`);
  };

  const handleOpenTaskById = (taskId: number | null) => {
    if (!taskId) return;
    const found = tasks.find((t) => t.id === taskId);
    if (found) {
      setPrefillTemplate(null);
      setEditingTask(found);
      setTaskModalOpen(true);
    }
  };

  if (surface === 'landing') {
    return (
      <LandingPage
        onOpenAuth={(mode) => {
          setAuthInitialMode(mode);
          setSurface('auth');
        }}
      />
    );
  }

  if (surface === 'auth' || !currentUser) {
    return (
      <AuthScreen
        initialMode={authInitialMode}
        onBackToLanding={() => setSurface('landing')}
        onAuthenticated={(user, token) => {
          setAuthToken(token);
          setCurrentUser(user);
          setPerspective(user.role === 'employee' ? 'employee' : 'manager');
          applyInitialUserDefaults(user);
          setSurface('workspace');
        }}
      />
    );
  }

  const currentNavLabel = NAV_ITEMS.find((n) => n.id === activeModule)?.label || 'Workspace';
  const dateFormat = prefs.dateFormat;
  const workspaceSummaryContext = `User: ${currentUser.name} (${currentUser.role}), Projects: ${projects.length}, Open Tasks: ${tasks.filter((t) => t.status !== 'completed').length}`;

  return (
    <MotionConfig reducedMotion={effectiveReduceMotion ? 'always' : 'user'}>
      <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {/* Desktop Sidebar (Expanded 256px or Collapsed 76px) */}
        <aside
          className={`hidden shrink-0 flex-col border-r border-slate-200 bg-[#0B132B] text-slate-300 transition-all dark:border-slate-800 lg:flex ${
            sidebarCollapsed ? 'w-[76px]' : 'w-64'
          }`}
        >
          <div
            className={`flex h-16 items-center border-b border-slate-800 ${
              sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
            }`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold ws-accent-bg">
                C
              </span>
              {!sidebarCollapsed && (
                <span className="font-display text-lg font-bold text-white">Cadence</span>
              )}
            </div>

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {sidebarCollapsed && (
            <div className="flex justify-center border-b border-slate-800/70 py-2">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                title="Expand sidebar"
                aria-label="Expand sidebar"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          )}

          <nav className="flex-1 space-y-1 p-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={sidebarCollapsed ? item.label : undefined}
                  aria-label={item.label}
                  onClick={() => setActiveModule(item.id)}
                  className={`relative flex w-full items-center rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    sidebarCollapsed
                      ? 'justify-center px-2 py-2.5'
                      : 'justify-between px-3.5 py-2.5'
                  } ${
                    active
                      ? 'ws-accent-bg'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </span>
                  {item.id === 'notifications' && unreadNotifCount > 0 && (
                    <span
                      className={`rounded-md bg-red-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white tabular-nums ${
                        sidebarCollapsed ? 'absolute right-1.5 top-1.5 px-1 py-0 text-[9px]' : ''
                      }`}
                    >
                      {unreadNotifCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-slate-800 p-3.5">
            <div
              className={`flex items-center ${
                sidebarCollapsed ? 'flex-col gap-2' : 'gap-3'
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 font-mono text-xs font-bold text-white">
                {getInitials(currentUser.name)}
              </span>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-white">{currentUser.name}</div>
                  <div className="truncate text-[11px] capitalize text-slate-400">
                    {currentUser.role} · {currentUser.department}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => void handleLogout()}
                title="Sign out"
                aria-label="Sign out"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Drawer */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-50 flex bg-slate-950/60 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <aside
              className="flex w-64 flex-col bg-[#0B132B] text-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
                <span className="font-display text-lg font-bold text-white">Cadence</span>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1 text-slate-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 p-3">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveModule(item.id);
                        setMobileSidebarOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                        active ? 'ws-accent-bg' : 'text-slate-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="border-t border-slate-800 p-4">
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content Shell */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Bar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open navigation menu"
                className="rounded-lg border border-slate-200 p-2 text-slate-700 dark:border-slate-700 dark:text-slate-200 lg:hidden cursor-pointer"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Workspace <span className="mx-1.5 text-slate-300 dark:text-slate-700">/</span>{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-50">
                  {currentNavLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {isManagerOrAdmin && (
                <div className="hidden sm:inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setPerspective('manager')}
                    className={`rounded-md px-2.5 py-1 whitespace-nowrap cursor-pointer ${
                      perspective === 'manager'
                        ? 'ws-accent-bg'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    Manager View
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerspective('employee')}
                    className={`rounded-md px-2.5 py-1 whitespace-nowrap cursor-pointer ${
                      perspective === 'employee'
                        ? 'ws-accent-bg'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    My Tasks
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setResearchOpen(true)}
                title="Web-grounded research assistant"
                className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Globe className="h-3.5 w-3.5 ws-accent-text" />
                Research
              </button>

              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, showArchived: !prev.showArchived }))
                }
                title="Toggle archived tasks"
                className={`hidden md:inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer ${
                  filters.showArchived
                    ? 'ws-accent-soft'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <Archive className="h-3.5 w-3.5" />
                {filters.showArchived ? 'Showing Archived' : 'Archived'}
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('notifications')}
                aria-label="Notifications"
                className="relative rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 font-mono text-[10px] font-bold text-white tabular-nums">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingTask(null);
                  setPrefillTemplate(null);
                  setTaskModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold ws-accent-bg cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                New Task
              </button>
            </div>
          </header>

          {/* Active Module Viewport */}
          <main className="flex-1 p-4 sm:p-6">
            {activeModule === 'dashboard' && (
              <DashboardView
                currentUser={currentUser}
                perspective={perspective}
                analytics={analytics}
                tasks={visibleTasks}
                projects={projects}
                users={users}
                dateFormat={dateFormat}
                isDark={effectiveDark}
                onOpenTask={(t) => {
                  setEditingTask(t);
                  setTaskModalOpen(true);
                }}
                onNavigateModule={(mod) => setActiveModule(mod)}
              />
            )}

            {activeModule === 'projects' && (
              <ProjectsView
                projects={projects}
                users={users}
                dateFormat={dateFormat}
                isManagerOrAdmin={Boolean(isManagerOrAdmin)}
                onSelectProjectTasks={(pid) => {
                  setFilters((prev) => ({ ...prev, projectId: pid }));
                  setActiveModule('tasks');
                }}
                onProjectSaved={(proj, isNew) => {
                  setProjects((prev) =>
                    isNew
                      ? [...prev, proj]
                      : prev.map((p) => (p.id === proj.id ? { ...p, ...proj } : p))
                  );
                  showToast(
                    isNew ? `Project "${proj.name}" created` : `Project "${proj.name}" updated`
                  );
                }}
                onProjectDeleted={(pid) => {
                  setProjects((prev) => prev.filter((p) => p.id !== pid));
                  setTasks((prev) => prev.filter((t) => t.projectId !== pid));
                  showToast('Project removed');
                }}
              />
            )}

            {activeModule === 'tasks' && (
              <ListView
                tasks={visibleTasks}
                projects={projects}
                users={users}
                filters={filters}
                dateFormat={dateFormat}
                taskSort={taskSort}
                showCompleted={showCompleted}
                isManagerOrAdmin={Boolean(isManagerOrAdmin)}
                onFiltersChange={setFilters}
                onTaskSortChange={setTaskSort}
                onShowCompletedChange={setShowCompleted}
                onOpenTask={(t) => {
                  setEditingTask(t);
                  setTaskModalOpen(true);
                }}
                onCreateTask={() => {
                  setEditingTask(null);
                  setPrefillTemplate(null);
                  setTaskModalOpen(true);
                }}
                onStatusChange={handleTaskStatusChange}
                onSendReminder={handleSendReminder}
                onBulkUpdate={handleBulkTaskUpdate}
                onBulkDelete={handleBulkTaskDelete}
              />
            )}

            {activeModule === 'board' && (
              <BoardView
                tasks={visibleTasks}
                projects={projects}
                users={users}
                dateFormat={dateFormat}
                onOpenTask={(t) => {
                  setPrefillTemplate(null);
                  setEditingTask(t);
                  setTaskModalOpen(true);
                }}
                onStatusChange={handleTaskStatusChange}
              />
            )}

            {activeModule === 'calendar' && (
              <CalendarView
                tasks={visibleTasks}
                projects={projects}
                onOpenTask={(t) => {
                  setPrefillTemplate(null);
                  setEditingTask(t);
                  setTaskModalOpen(true);
                }}
              />
            )}

            {activeModule === 'templates' && (
              <TemplatesView
                templates={taskTemplates}
                projects={projects}
                users={users}
                currentUser={currentUser}
                dateFormat={dateFormat}
                onUseTemplateInModal={(tpl) => {
                  setEditingTask(null);
                  setPrefillTemplate(tpl);
                  setTaskModalOpen(true);
                }}
                onQuickCreateFromTemplate={async (tpl) => {
                  try {
                    const created = await api.instantiateTaskTemplate(tpl.id);
                    setTasks((prev) =>
                      prev.some((t) => t.id === created.id) ? prev : [created, ...prev]
                    );
                    void api
                      .getAnalytics(perspective === 'employee' ? 'mine' : 'all')
                      .then(setAnalytics)
                      .catch(() => {});
                    void api.getProjects().then(setProjects).catch(() => {});
                    void api.getActivity().then(setActivity).catch(() => {});
                    showToast(`Created task "${created.title}" from "${tpl.name}"`);
                  } catch (err) {
                    showToast(
                      err instanceof Error ? err.message : 'Failed to create task from template.'
                    );
                  }
                }}
                onTemplateSaved={(tpl, isNew) => {
                  setTaskTemplates((prev) =>
                    isNew
                      ? prev.some((item) => item.id === tpl.id)
                        ? prev
                        : [tpl, ...prev]
                      : prev.map((item) => (item.id === tpl.id ? tpl : item))
                  );
                  void api.getActivity().then(setActivity).catch(() => {});
                  showToast(
                    isNew ? `Template "${tpl.name}" created` : `Template "${tpl.name}" updated`
                  );
                }}
                onTemplateDeleted={(tid) => {
                  setTaskTemplates((prev) => prev.filter((item) => item.id !== tid));
                  void api.getActivity().then(setActivity).catch(() => {});
                  showToast('Template deleted');
                }}
                onNotifyToast={showToast}
              />
            )}

            {activeModule === 'team' && (
              <TeamView
                users={users}
                tasks={tasks}
                currentUser={currentUser}
                onUserAdded={(u) => {
                  setUsers((prev) => [...prev, u]);
                  showToast(`Added ${u.name} to workspace`);
                }}
                onUserUpdated={(u) => {
                  setUsers((prev) => prev.map((m) => (m.id === u.id ? u : m)));
                  showToast(`Updated ${u.name}`);
                }}
              />
            )}

            {activeModule === 'reports' && (
              <ReportsView analytics={analytics} isDark={effectiveDark} />
            )}

            {activeModule === 'notifications' && (
              <NotificationsView
                notifications={notifications}
                dateFormat={dateFormat}
                onMarkRead={async (id) => {
                  const updated = await api.markNotificationRead(id);
                  setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
                }}
                onMarkAllRead={async () => {
                  await api.markAllNotificationsRead();
                  setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                }}
                onOpenTaskById={handleOpenTaskById}
              />
            )}

            {activeModule === 'activity' && (
              <ActivityLogView
                events={activity}
                dateFormat={dateFormat}
                onOpenTaskById={handleOpenTaskById}
              />
            )}

            {activeModule === 'settings' && (
              <SettingsView
                currentUser={currentUser}
                osReducedMotion={osReducedMotion}
                onUserUpdated={(u) => {
                  setCurrentUser(u);
                  setUsers((prev) => prev.map((m) => (m.id === u.id ? u : m)));
                  showToast('Profile updated');
                }}
                onPreferencesChange={handlePreferencesChange}
                onResetPreferences={handleResetPreferences}
              />
            )}
          </main>
        </div>

        {/* Task Modal */}
        <TaskModal
          isOpen={taskModalOpen}
          task={editingTask}
          templates={taskTemplates}
          prefillTemplate={prefillTemplate}
          projects={projects}
          users={users}
          currentUser={currentUser}
          dateFormat={dateFormat}
          onClose={() => {
            setTaskModalOpen(false);
            setPrefillTemplate(null);
          }}
          onSaved={(saved) => {
            setTasks((prev) => {
              const exists = prev.some((t) => t.id === saved.id);
              return exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...prev];
            });
            setEditingTask(saved);
            setPrefillTemplate(null);
            void api
              .getAnalytics(perspective === 'employee' ? 'mine' : 'all')
              .then(setAnalytics)
              .catch(() => {});
            void api.getProjects().then(setProjects).catch(() => {});
            void api.getActivity().then(setActivity).catch(() => {});
            showToast(`Saved "${saved.title}"`);
          }}
          onDeleted={(id) => {
            setTasks((prev) => prev.filter((t) => t.id !== id));
            showToast('Task deleted');
          }}
          onTemplateSaved={(tpl) => {
            setTaskTemplates((prev) =>
              prev.some((item) => item.id === tpl.id) ? prev : [tpl, ...prev]
            );
            void api.getActivity().then(setActivity).catch(() => {});
          }}
          onNotifyToast={showToast}
        />

        {/* Web-Grounded Research Drawer */}
        <ResearchDrawer
          isOpen={researchOpen}
          workspaceContext={workspaceSummaryContext}
          onClose={() => setResearchOpen(false)}
        />

        {/* Toast Feedback */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 rounded-xl border border-slate-700 bg-[#0F172A] px-4 py-3 text-xs font-semibold text-white shadow-xl">
            {toast}
          </div>
        )}
      </div>
    </MotionConfig>
  );
};
