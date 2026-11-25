import React, { useEffect, useState } from 'react';
import {
  Check,
  Columns3,
  Eye,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Type,
  X,
} from 'lucide-react';
import { ACCENT_PRESETS, DEFAULT_USER_PREFERENCES, getInitials } from '../constants';
import { api } from '../services/apiClient';
import {
  DateFormatPref,
  DefaultTaskSortPref,
  DefaultTaskViewPref,
  FontSizePref,
  SidebarBehaviorPref,
  TaskCardStylePref,
  ThemeModePref,
  UiDensityPref,
  UserPreferences,
  UserProfile,
} from '../types';

interface SettingsViewProps {
  currentUser: UserProfile;
  osReducedMotion: boolean;
  onUserUpdated: (user: UserProfile) => void;
  onPreferencesChange: (patch: Partial<UserPreferences>) => Promise<void>;
  onResetPreferences: () => Promise<void>;
}

const THEME_OPTIONS: Array<{
  id: ThemeModePref;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

const DENSITY_OPTIONS: Array<{ id: UiDensityPref; label: string; hint: string }> = [
  { id: 'comfortable', label: 'Comfortable', hint: 'Standard padding and row height' },
  { id: 'compact', label: 'Compact', hint: 'Tighter rows for high-density scanning' },
];

const FONT_SIZE_OPTIONS: Array<{ id: FontSizePref; label: string; sample: string }> = [
  { id: 'small', label: 'Small', sample: '14px' },
  { id: 'medium', label: 'Medium', sample: '16px' },
  { id: 'large', label: 'Large', sample: '17.5px' },
];

const SIDEBAR_OPTIONS: Array<{ id: SidebarBehaviorPref; label: string }> = [
  { id: 'expanded', label: 'Expanded' },
  { id: 'collapsed', label: 'Collapsed' },
];

const CARD_STYLE_OPTIONS: Array<{ id: TaskCardStylePref; label: string; hint: string }> = [
  { id: 'rounded', label: 'Rounded', hint: 'Soft corners with subtle elevation' },
  { id: 'minimal', label: 'Minimal', hint: 'Crisp hairline borders, flat surfaces' },
];

const DATE_FORMAT_OPTIONS: Array<{ id: DateFormatPref; label: string; example: string }> = [
  { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '25/11/2026' },
  { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '11/25/2026' },
  { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2026-11-25' },
];

const DEFAULT_VIEW_OPTIONS: Array<{ id: DefaultTaskViewPref; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'all_tasks', label: 'All tasks' },
  { id: 'board', label: 'Kanban Board' },
  { id: 'calendar', label: 'Calendar' },
];

const DEFAULT_SORT_OPTIONS: Array<{ id: DefaultTaskSortPref; label: string }> = [
  { id: 'due_date', label: 'Due date' },
  { id: 'priority', label: 'Priority' },
  { id: 'updated', label: 'Recently updated' },
  { id: 'title', label: 'Title' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  osReducedMotion,
  onUserUpdated,
  onPreferencesChange,
  onResetPreferences,
}) => {
  const prefs = currentUser.preferences || DEFAULT_USER_PREFERENCES;

  const [name, setName] = useState(currentUser.name);
  const [department, setDepartment] = useState(currentUser.department);
  const [jobTitle, setJobTitle] = useState(currentUser.jobTitle);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [customHexInput, setCustomHexInput] = useState(prefs.accentColor);
  const [prefStatus, setPrefStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [prefError, setPrefError] = useState('');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setName(currentUser.name);
    setDepartment(currentUser.department);
    setJobTitle(currentUser.jobTitle);
  }, [currentUser.name, currentUser.department, currentUser.jobTitle]);

  useEffect(() => {
    setCustomHexInput(prefs.accentColor);
  }, [prefs.accentColor]);

  const applyPrefPatch = async (patch: Partial<UserPreferences>) => {
    setPrefStatus('saving');
    setPrefError('');
    try {
      await onPreferencesChange(patch);
      setPrefStatus('saved');
    } catch (err) {
      setPrefStatus('error');
      setPrefError(err instanceof Error ? err.message : 'Unable to save preference.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage('');
    setProfileError('');
    try {
      const res = await api.updateProfile({
        name,
        department,
        jobTitle,
        ...(newPassword ? { currentPassword, newPassword } : {}),
      });
      onUserUpdated(res.user);
      setCurrentPassword('');
      setNewPassword('');
      setProfileMessage('Profile settings updated successfully.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    setPrefError('');
    try {
      await onResetPreferences();
      setConfirmResetOpen(false);
      setPrefStatus('saved');
    } catch (err) {
      setPrefStatus('error');
      setPrefError(err instanceof Error ? err.message : 'Failed to reset preferences.');
    } finally {
      setResetting(false);
    }
  };

  const handleHexInputBlurOrCommit = (raw: string) => {
    const clean = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      void applyPrefPatch({ accentColor: clean.toUpperCase() });
    } else {
      setCustomHexInput(prefs.accentColor);
    }
  };

  const controlBase =
    'rounded-lg border border-slate-300 bg-white text-slate-900 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

  return (
    <div className="mx-auto max-w-4xl ws-stack">
      {/* User Identity Banner */}
      <div className="ws-card ws-card-pad-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-bold ws-accent-bg"
          >
            {getInitials(currentUser.name)}
          </span>
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
              {currentUser.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentUser.email} ·{' '}
              <span className="font-semibold capitalize text-slate-700 dark:text-slate-200">
                {currentUser.role}
              </span>
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Preferences sync automatically to your account across devices.
        </div>
      </div>

      {/* Workspace Customization Section */}
      <section
        aria-labelledby="workspace-customization-heading"
        className="ws-card ws-card-pad-lg space-y-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ws-accent-soft">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <div>
              <h3
                id="workspace-customization-heading"
                className="font-display text-base font-bold text-slate-900 dark:text-slate-50"
              >
                Workspace Customization
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personalize appearance, layout density, date formatting, and default task workflows.
                Changes apply immediately.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {prefStatus === 'saving' && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Saving...
              </span>
            )}
            {prefStatus === 'saved' && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to defaults
            </button>
          </div>
        </div>

        {prefError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
            {prefError}
          </div>
        )}

        {/* 1. Theme Mode & 2. Accent Color */}
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Sun className="h-3.5 w-3.5 text-slate-400" />
              Theme Mode
            </label>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Choose Light, Dark, or match your device appearance automatically.
            </p>
            <div
              role="radiogroup"
              aria-label="Theme mode"
              className="mt-2.5 grid grid-cols-3 gap-2"
            >
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = prefs.themeMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => void applyPrefPatch({ themeMode: opt.id })}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'ws-accent-bg border-transparent shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Palette className="h-3.5 w-3.5 text-slate-400" />
              Accent Color
            </label>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Pick a preset highlight or define a custom brand hex color.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              {ACCENT_PRESETS.map((preset) => {
                const selected = prefs.accentColor.toUpperCase() === preset.hex.toUpperCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    title={preset.name}
                    aria-label={`Select accent color ${preset.name}`}
                    aria-pressed={selected}
                    onClick={() => {
                      setCustomHexInput(preset.hex);
                      void applyPrefPatch({ accentColor: preset.hex });
                    }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform cursor-pointer ${
                      selected
                        ? 'scale-110 border-slate-900 ring-2 ring-slate-300 dark:border-white dark:ring-slate-600'
                        : 'border-white shadow-xs hover:scale-105 dark:border-slate-800'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                  >
                    {selected && <Check className="h-3.5 w-3.5 text-white drop-shadow-xs" />}
                  </button>
                );
              })}

              <div className="ml-1 flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-800">
                <input
                  type="color"
                  aria-label="Custom accent color picker"
                  value={/^#[0-9A-Fa-f]{6}$/.test(customHexInput) ? customHexInput : prefs.accentColor}
                  onChange={(e) => {
                    const nextHex = e.target.value.toUpperCase();
                    setCustomHexInput(nextHex);
                    void applyPrefPatch({ accentColor: nextHex });
                  }}
                  className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <input
                  type="text"
                  aria-label="Custom accent hex code"
                  maxLength={7}
                  value={customHexInput}
                  onChange={(e) => setCustomHexInput(e.target.value)}
                  onBlur={(e) => handleHexInputBlurOrCommit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleHexInputBlurOrCommit(customHexInput);
                    }
                  }}
                  className="w-20 bg-transparent font-mono text-xs uppercase text-slate-800 outline-none dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. UI Density & 4. Font Size */}
        <div className="grid gap-6 border-t border-slate-100 pt-5 md:grid-cols-2 dark:border-slate-800">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Columns3 className="h-3.5 w-3.5 text-slate-400" />
              UI Density
            </label>
            <div role="radiogroup" aria-label="UI density" className="mt-2 grid grid-cols-2 gap-2">
              {DENSITY_OPTIONS.map((opt) => {
                const active = prefs.density === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => void applyPrefPatch({ density: opt.id })}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                      active
                        ? 'ws-accent-soft font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className="text-[11px] opacity-80">{opt.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Type className="h-3.5 w-3.5 text-slate-400" />
              Interface Font Size
            </label>
            <div role="radiogroup" aria-label="Font size" className="mt-2 grid grid-cols-3 gap-2">
              {FONT_SIZE_OPTIONS.map((opt) => {
                const active = prefs.fontSize === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => void applyPrefPatch({ fontSize: opt.id })}
                    className={`rounded-lg border px-3 py-2 text-center transition-colors cursor-pointer ${
                      active
                        ? 'ws-accent-bg border-transparent'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className="font-mono text-[10px] opacity-80 tabular-nums">{opt.sample}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 5. Sidebar Behavior & 6. Task Card Style */}
        <div className="grid gap-6 border-t border-slate-100 pt-5 md:grid-cols-2 dark:border-slate-800">
          <div>
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Sidebar Default Behavior
            </label>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Sets the default desktop navigation width when entering the workspace.
            </p>
            <div
              role="radiogroup"
              aria-label="Sidebar behavior"
              className="mt-2 grid grid-cols-2 gap-2"
            >
              {SIDEBAR_OPTIONS.map((opt) => {
                const active = prefs.sidebarBehavior === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => void applyPrefPatch({ sidebarBehavior: opt.id })}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'ws-accent-bg border-transparent'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Task Card Style
            </label>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Applies to Kanban board cards, dashboard panels, and workspace containers.
            </p>
            <div
              role="radiogroup"
              aria-label="Task card style"
              className="mt-2 grid grid-cols-2 gap-2"
            >
              {CARD_STYLE_OPTIONS.map((opt) => {
                const active = prefs.taskCardStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => void applyPrefPatch({ taskCardStyle: opt.id })}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                      active
                        ? 'ws-accent-soft font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className="text-[11px] opacity-80">{opt.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 7. Date Format, 8. Default Task View, 9. Default Sort Order */}
        <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3 dark:border-slate-800">
          <div>
            <label
              htmlFor="pref-date-format"
              className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              Date Format
            </label>
            <select
              id="pref-date-format"
              value={prefs.dateFormat}
              onChange={(e) => void applyPrefPatch({ dateFormat: e.target.value as DateFormatPref })}
              className={`mt-1.5 w-full px-3 py-2 text-xs font-medium ${controlBase}`}
            >
              {DATE_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} ({opt.example})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pref-default-view"
              className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              Default Task View
            </label>
            <select
              id="pref-default-view"
              value={prefs.defaultTaskView}
              onChange={(e) =>
                void applyPrefPatch({ defaultTaskView: e.target.value as DefaultTaskViewPref })
              }
              className={`mt-1.5 w-full px-3 py-2 text-xs font-medium ${controlBase}`}
            >
              {DEFAULT_VIEW_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pref-default-sort"
              className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              Default Task Sort Order
            </label>
            <select
              id="pref-default-sort"
              value={prefs.defaultTaskSort}
              onChange={(e) =>
                void applyPrefPatch({ defaultTaskSort: e.target.value as DefaultTaskSortPref })
              }
              className={`mt-1.5 w-full px-3 py-2 text-xs font-medium ${controlBase}`}
            >
              {DEFAULT_SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 10. Show/Hide Completed Tasks & 11. Reduce Motion Toggle */}
        <div className="grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-start gap-2.5">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
              <div>
                <label
                  htmlFor="pref-show-completed"
                  className="block text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  Show completed tasks by default
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Display finished items in task lists, board columns, and calendar.
                </p>
              </div>
            </div>
            <button
              id="pref-show-completed"
              type="button"
              role="switch"
              aria-checked={prefs.showCompletedByDefault}
              onClick={() =>
                void applyPrefPatch({ showCompletedByDefault: !prefs.showCompletedByDefault })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                prefs.showCompletedByDefault
                  ? 'ws-accent-bg'
                  : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                  prefs.showCompletedByDefault ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
              <div>
                <label
                  htmlFor="pref-reduce-motion"
                  className="block text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  Reduce motion
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Minimize transitions and animations.
                  {osReducedMotion && (
                    <span className="ml-1 font-semibold text-blue-600 dark:text-blue-400">
                      (OS reduced motion active)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              id="pref-reduce-motion"
              type="button"
              role="switch"
              aria-checked={prefs.reduceMotion}
              onClick={() => void applyPrefPatch({ reduceMotion: !prefs.reduceMotion })}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                prefs.reduceMotion ? 'ws-accent-bg' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                  prefs.reduceMotion ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Profile & Security Form */}
      <form onSubmit={handleSaveProfile} className="ws-card ws-card-pad-lg space-y-4">
        <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
          Profile & Security
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`mt-1 w-full px-3 py-2 text-sm ${controlBase}`}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={`mt-1 w-full px-3 py-2 text-sm ${controlBase}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Job Title
          </label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className={`mt-1 w-full px-3 py-2 text-sm ${controlBase}`}
          />
        </div>

        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Change Password (optional)
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className={`w-full px-3 py-2 text-sm ${controlBase}`}
            />
            <input
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (8+ chars)"
              className={`w-full px-3 py-2 text-sm ${controlBase}`}
            />
          </div>
        </div>

        {profileError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
            {profileError}
          </div>
        )}
        {profileMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            {profileMessage}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingProfile}
            className="rounded-xl px-5 py-2.5 text-xs font-semibold ws-accent-bg disabled:opacity-60 cursor-pointer"
          >
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>

      {/* In-App Confirmation Dialog for Reset to Defaults */}
      {confirmResetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => !resetting && setConfirmResetOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className="ws-card w-full max-w-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4
                  id="reset-dialog-title"
                  className="font-display text-base font-bold text-slate-900 dark:text-slate-50"
                >
                  Reset workspace customization?
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  This will restore Light theme, Cobalt Blue accent, Comfortable density, Medium
                  font size, Expanded sidebar, Rounded cards, YYYY-MM-DD dates, Overview landing
                  module, Due date sorting, and motion defaults for your account.
                </p>
              </div>
              <button
                type="button"
                disabled={resetting}
                onClick={() => setConfirmResetOpen(false)}
                aria-label="Close confirmation dialog"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={resetting}
                onClick={() => setConfirmResetOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={() => void handleConfirmReset()}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 cursor-pointer"
              >
                {resetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
