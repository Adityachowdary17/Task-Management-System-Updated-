import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FolderKanban,
  Layers,
  Menu,
  MessageSquare,
  Paperclip,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { api } from '../services/apiClient';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
}

const HERO_WORDS = [
  { text: 'Assign', accent: false },
  { text: 'Work.', accent: false },
  { text: 'Track', accent: false },
  { text: 'Progress.', accent: false },
  { text: 'Get', accent: true },
  { text: 'Things', accent: true },
  { text: 'Done.', accent: true },
];

const HOW_IT_WORKS = [
  {
    num: '01',
    title: 'Assign Work',
    mechanism: 'Create structured tasks with owners, deadlines, sub-tasks, and file briefs.',
    outcome: 'Every teammate knows what they own before the sprint begins.',
    icon: Users,
  },
  {
    num: '02',
    title: 'Track Progress',
    mechanism: 'Move cards across To Do, In Progress, On Hold, and Completed in real time.',
    outcome: 'Live Socket.io updates surface blockers and overdue risks immediately.',
    icon: FolderKanban,
  },
  {
    num: '03',
    title: 'Get Things Done',
    mechanism: 'Review completion rates, average cycle times, and team workload reports.',
    outcome: 'Managers balance capacity early and projects ship on schedule.',
    icon: CheckCircle2,
  },
];

const FEATURE_CARDS = [
  {
    title: 'Role-Based Manager & Employee Dashboards',
    description:
      'Managers oversee projects, team workload, and overdue escalations while employees focus on a clear personal queue, deadlines, and daily checklists.',
    span: 'lg:col-span-2',
    icon: ShieldCheck,
    metric: 'Admin, Manager & Employee RBAC',
  },
  {
    title: 'Live Multi-View Kanban & Task Lists',
    description:
      'Drag tasks across To Do, In Progress, On Hold, and Completed columns with instant multi-user Socket.io synchronization and CSV export.',
    span: 'lg:col-span-1',
    icon: Layers,
    metric: 'Real-time Socket.io sync',
  },
  {
    title: 'Calendar & Deadline Radar',
    description:
      'Visualize personal and cross-team due dates on a monthly schedule with automated alerts for approaching and overdue deliverables.',
    span: 'lg:col-span-1',
    icon: CalendarDays,
    metric: 'Automated deadline alerts',
  },
  {
    title: 'Workload, Cycle Time & Project Analytics',
    description:
      'Interactive Recharts breakdowns of completion rate, average completion hours, employee bandwidth, and project progress percentages.',
    span: 'lg:col-span-2',
    icon: BarChart3,
    metric: '8 live KPI dimensions',
  },
  {
    title: 'Comments, Sub-Tasks & Attachments',
    description:
      'Keep specs, progress threads, and uploaded files attached directly to every deliverable so context stays in one workspace.',
    span: 'lg:col-span-1',
    icon: Paperclip,
    metric: 'Up to 5 MB per file upload',
  },
  {
    title: 'Smart Manager Reminders & Activity Audit',
    description:
      'Trigger instant reminder notifications to assignees and inspect a chronological audit log of every status change and project update.',
    span: 'lg:col-span-2',
    icon: Bell,
    metric: 'Full audit trail',
  },
];

const PRICING_TIERS = [
  {
    name: 'Starter',
    audience: 'For early-stage teams',
    monthly: 0,
    annual: 0,
    summary: 'Core task tracking and Kanban workflows for focused small teams.',
    limits: [
      'Up to 10 team members',
      '5 active projects',
      'Kanban board, list view & calendar',
      'Real-time notifications & comments',
    ],
    featured: false,
    cta: 'Start Free Workspace',
  },
  {
    name: 'Growth',
    audience: 'For scaling operations',
    monthly: 14,
    annual: 11,
    summary: 'Full workload analytics, multi-assignee routing, and automated reminders.',
    limits: [
      'Unlimited team members & projects',
      'Manager workload & cycle-time KPIs',
      'Multi-member task assignments & CSV export',
      'File attachments & Gemini priority briefings',
    ],
    featured: true,
    cta: 'Get Started with Growth',
  },
  {
    name: 'Enterprise',
    audience: 'For multi-department orgs',
    monthly: 29,
    annual: 24,
    summary: 'Dedicated database isolation, custom role governance, and onboarding.',
    limits: [
      'Unlimited workspaces & audit retention',
      'Dedicated Cloud SQL PostgreSQL isolation',
      'Custom RBAC policies & security reviews',
      'Guided rollout & SLA support',
    ],
    featured: false,
    cta: 'Book Enterprise Demo',
  },
];

const FAQS = [
  {
    q: 'How do Admin / Manager and Employee dashboards differ?',
    a: 'Managers and Admins can create projects, manage team roles, assign tasks to one or multiple members, trigger deadline reminders, and inspect org-wide workload charts. Employees get a streamlined workspace focused on assigned tasks, personal calendar deadlines, status updates, sub-tasks, comments, and attachments.',
  },
  {
    q: 'Are task updates and notifications reflected in real time?',
    a: 'Yes. Every task creation, status transition on the Kanban board, comment, file attachment, and manager reminder is persisted to PostgreSQL and broadcast immediately over Socket.io to active team members.',
  },
  {
    q: 'Can we assign a single task to multiple team members?',
    a: 'Yes. Managers can assign any task to one owner or a cross-functional group of employees. Each assignee receives an assignment notification and sees the task in their personal queue.',
  },
  {
    q: 'How is our workspace data authenticated and stored?',
    a: 'Cadence supports both Google Sign-In via Firebase Auth and bcrypt-hashed email/password accounts backed by signed JWT bearer tokens and relational PostgreSQL storage.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const prefersReducedMotion = useReducedMotion();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<'manager' | 'employee' | 'kanban'>('manager');
  const [annualBilling, setAnnualBilling] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    teamSize: '10-50',
    message: '',
  });
  const [contactStatus, setContactStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [contactError, setContactError] = useState('');

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError('');
    if (!contactForm.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.email.trim())) {
      setContactError('Please enter your full name and a valid work email address.');
      setContactStatus('error');
      return;
    }

    setContactStatus('submitting');
    try {
      await api.submitDemoRequest(contactForm);
      setContactStatus('sent');
      setContactForm({ name: '', email: '', company: '', teamSize: '10-50', message: '' });
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'Unable to send request right now.');
      setContactStatus('error');
    }
  };

  const revealMotion = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.18 },
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <div id="home" className="min-h-screen bg-white text-slate-900">
      {/* Sticky 3-Zone Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Clean Wordmark */}
          <a href="#home" className="flex items-center gap-2.5 shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A] text-white font-display font-bold text-sm">
              C
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-[#0F172A]">
              Cadence
            </span>
          </a>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#home" className="whitespace-nowrap transition-colors hover:text-[#0F172A]">
              Home
            </a>
            <a href="#features" className="whitespace-nowrap transition-colors hover:text-[#0F172A]">
              Features
            </a>
            <a href="#pricing" className="whitespace-nowrap transition-colors hover:text-[#0F172A]">
              Pricing
            </a>
            <a href="#contact" className="whitespace-nowrap transition-colors hover:text-[#0F172A]">
              Contact
            </a>
          </nav>

          {/* Zone 3: Actions */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="whitespace-nowrap shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-[#0F172A] cursor-pointer"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('signup')}
              className="whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-all hover:-translate-y-0.5 hover:bg-blue-700 cursor-pointer"
            >
              Get Started
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 md:hidden cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
            <div className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              <a
                href="#home"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-slate-100"
              >
                Home
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-slate-100"
              >
                Features
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-slate-100"
              >
                Pricing
              </a>
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-slate-100"
              >
                Contact
              </a>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('login');
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-center font-semibold text-slate-800"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('signup');
                  }}
                  className="rounded-lg bg-blue-600 px-3 py-2.5 text-center font-semibold text-white"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 1. Animated Hero Section */}
      <section className="relative overflow-hidden bg-[#0B132B] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 25%, #2563EB 0%, transparent 45%), radial-gradient(circle at 85% 70%, #4F46E5 0%, transparent 40%)',
          }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-6">
            <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
              {HERO_WORDS.map((word, idx) => (
                <motion.span
                  key={`${word.text}-${idx}`}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.42,
                    delay: prefersReducedMotion ? 0 : idx * 0.06,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={`mr-3 inline-block ${word.accent ? 'text-blue-400' : 'text-white'}`}
                >
                  {word.text}
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : 0.42 }}
              className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg"
            >
              A simple task management system to assign work, set deadlines, monitor progress, and
              improve team productivity.
            </motion.p>

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : 0.54 }}
              className="mt-8 flex flex-wrap items-center gap-3.5"
            >
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:-translate-y-0.5 hover:bg-blue-500 cursor-pointer"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDemoModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-6 py-3.5 text-sm font-semibold text-slate-100 transition-all hover:border-slate-500 hover:bg-slate-800 cursor-pointer"
              >
                Book a Demo
              </button>
            </motion.div>

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : 0.68 }}
              className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-slate-800 pt-6"
            >
              <div>
                <div className="font-mono text-xl font-semibold text-white tabular-nums">94%</div>
                <div className="mt-0.5 text-xs text-slate-400">On-time sprint delivery</div>
              </div>
              <div>
                <div className="font-mono text-xl font-semibold text-white tabular-nums">4.2h</div>
                <div className="mt-0.5 text-xs text-slate-400">Saved weekly per lead</div>
              </div>
              <div>
                <div className="font-mono text-xl font-semibold text-white tabular-nums">Real-time</div>
                <div className="mt-0.5 text-xs text-slate-400">Socket.io board sync</div>
              </div>
            </motion.div>
          </div>

          {/* Floating Hero Dashboard & Task Cards Mockup */}
          <div className="relative lg:col-span-6">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: prefersReducedMotion ? 0 : 0.3 }}
              className="rounded-2xl border border-slate-700/80 bg-[#111C38] p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
                <div>
                  <div className="text-xs font-medium text-slate-400">Manager Overview</div>
                  <div className="font-display text-sm font-bold text-white">
                    Q4 Product Delivery Sprint
                  </div>
                </div>
                <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-medium text-emerald-300 tabular-nums">
                  82% On Track
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-[11px] text-slate-400">Active Tasks</div>
                  <div className="mt-1 font-mono text-xl font-semibold text-white tabular-nums">24</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-[11px] text-slate-400">Completed</div>
                  <div className="mt-1 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                    19
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-[11px] text-slate-400">Overdue</div>
                  <div className="mt-1 font-mono text-xl font-semibold text-amber-400 tabular-nums">
                    2
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      Ship offline draft mutation queue
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      Assigned to Dana Ortiz & Ravi Menon · Due Tomorrow
                    </div>
                  </div>
                  <span className="ml-3 shrink-0 rounded-md bg-blue-500/20 px-2.5 py-1 text-xs font-medium text-blue-300">
                    In Progress
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      Consolidate workspace onboarding to 4 steps
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      Assigned to Leah Cho · 2/3 subtasks done
                    </div>
                  </div>
                  <span className="ml-3 shrink-0 rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-300">
                    67% Done
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Floating Secondary Notification Card */}
            <motion.div
              animate={prefersReducedMotion ? undefined : { y: [0, -7, 0] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
              className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5 text-slate-900 shadow-xl sm:absolute sm:-bottom-6 sm:-left-6 sm:mt-0 sm:w-72"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Bell className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Deadline Reminder Sent</div>
                  <div className="mt-0.5 text-xs text-slate-600">
                    Priya Raman nudged 2 assignees on Billing Migration.
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. How It Works */}
      <section className="border-b border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...revealMotion} className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              How it works
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
              Assign Work → Track Progress → Get Things Done
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Built around three operational stages so managers delegate cleanly and teams stay unblocked.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.num}
                  {...revealMotion}
                  transition={{
                    duration: 0.45,
                    delay: prefersReducedMotion ? 0 : i * 0.08,
                  }}
                  className="rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-blue-600 tabular-nums">
                      {step.num}
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-[#0F172A]">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-xl font-bold text-[#0F172A]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.mechanism}</p>
                  <div className="mt-4 border-t border-slate-100 pt-3 text-xs font-medium text-slate-800">
                    {step.outcome}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Features Bento Grid */}
      <section id="features" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...revealMotion} className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Capabilities
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
              Structured workflows from sprint intake to completion analytics
            </h2>
          </motion.div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {FEATURE_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.title}
                  {...revealMotion}
                  transition={{
                    duration: 0.45,
                    delay: prefersReducedMotion ? 0 : (i % 3) * 0.06,
                  }}
                  className={`${card.span} flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-6 transition-all hover:border-blue-300 hover:bg-white hover:shadow-sm`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F172A] text-white">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="font-mono text-xs font-medium text-slate-500">
                        {card.metric}
                      </span>
                    </div>
                    <h3 className="mt-5 font-display text-lg font-bold text-[#0F172A]">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {card.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Interactive Dashboard Preview Section */}
      <section className="border-y border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...revealMotion} className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                Workspace Preview
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F172A]">
                One shared source of truth across views
              </h2>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
              {(
                [
                  ['manager', 'Manager Overview'],
                  ['employee', 'Employee Queue'],
                  ['kanban', 'Kanban Board'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreviewTab(key)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    previewTab === key
                      ? 'bg-[#0F172A] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div
            {...revealMotion}
            className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="text-xs font-medium text-slate-600">
                Workspace / {previewTab === 'manager' ? 'Admin & Manager Analytics' : previewTab === 'employee' ? 'My Assigned Deliverables' : 'Live Sprint Board'}
              </div>
              <div className="font-mono text-xs text-slate-500 tabular-nums">
                {previewTab === 'manager' ? 'Completion Rate: 79%' : previewTab === 'employee' ? '6 Assigned Tasks' : '4 Workflow Columns'}
              </div>
            </div>

            {previewTab === 'manager' && (
              <div className="grid gap-6 p-6 lg:grid-cols-12">
                <div className="grid grid-cols-2 gap-4 lg:col-span-5">
                  {[
                    ['Total Tasks', '48', 'text-[#0F172A]'],
                    ['Completed', '38', 'text-emerald-600'],
                    ['In Progress', '8', 'text-blue-600'],
                    ['Overdue', '2', 'text-red-600'],
                  ].map(([label, value, color]) => (
                    <div key={label} className="rounded-xl border border-slate-200 p-4">
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${color}`}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-slate-200 p-5 lg:col-span-7">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Workload by Team Member
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      ['Ravi Menon', 6, 85],
                      ['Dana Ortiz', 5, 72],
                      ['Leah Cho', 4, 60],
                      ['Sam Whitfield', 3, 45],
                    ].map(([name, count, pct]) => (
                      <div key={String(name)} className="grid grid-cols-12 items-center gap-3 text-xs">
                        <span className="col-span-4 font-medium text-slate-800">{name}</span>
                        <div className="col-span-6 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="col-span-2 text-right font-mono text-slate-600 tabular-nums">
                          {count} active
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {previewTab === 'employee' && (
              <div className="divide-y divide-slate-100 p-6">
                {[
                  ['Fix cold-start token refresh race on iOS', 'High', 'In Progress', '2d overdue'],
                  ['Ship offline draft mutation queue', 'High', 'In Progress', 'Tomorrow'],
                  ['Rotate production API signing keys', 'High', 'To Do', '1d overdue'],
                ].map(([title, prio, status, due]) => (
                  <div key={title} className="flex flex-wrap items-center justify-between gap-4 py-3.5">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Priority: {prio} · Status: {status}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-medium text-slate-700 tabular-nums">
                      {due}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {previewTab === 'kanban' && (
              <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['To Do', 'Dual-write shadow ledger', 'Rotate production keys'],
                  ['In Progress', 'Offline draft queue', 'Workspace setup consolidation'],
                  ['On Hold', 'Map legacy plan SKUs', 'Finance sign-off pending'],
                  ['Completed', 'Proration credit memos', 'RBAC permission matrix'],
                ].map(([col, t1, t2]) => (
                  <div key={col} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <div className="text-xs font-semibold text-slate-700">{col}</div>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800">
                        {t1}
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800">
                        {t2}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* 5. Benefits for Managers & Employees */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div
              {...revealMotion}
              className="rounded-2xl border border-slate-200 bg-[#0F172A] p-8 text-white"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                For Admins & Managers
              </span>
              <h3 className="mt-2 font-display text-2xl font-bold">
                Visibility without status meetings
              </h3>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                {[
                  'Create and organize projects, teams, and user permissions in seconds.',
                  'Assign work to single owners or multi-member delivery squads.',
                  'Monitor completion rates, average cycle hours, and overdue bottlenecks.',
                  'Send targeted deadline reminders directly to task assignees.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              {...revealMotion}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-8"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                For Employees & Contributors
              </span>
              <h3 className="mt-2 font-display text-2xl font-bold text-[#0F172A]">
                Clear priorities and calm execution
              </h3>
              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                {[
                  'View assigned deliverables sorted by deadline and priority level.',
                  'Update status between To Do, In Progress, On Hold, and Completed.',
                  'Collaborate with inline comments, sub-task checklists, and file uploads.',
                  'Receive instant alerts for assignments, approaching deadlines, and mentions.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 6. Customer Outcomes / Trust */}
      <section className="border-y border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...revealMotion} className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Proven Impact
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F172A]">
              Trusted by operations and product teams
            </h2>
          </motion.div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {[
              {
                metric: '38% faster sprint turnaround',
                quote:
                  'Moving our product and QA handoffs into Cadence cut Monday status standups down to ten minutes.',
                author: 'Meera Krishnan',
                role: 'VP of Engineering, Northwind Systems',
              },
              {
                metric: '0 missed compliance deadlines',
                quote:
                  'Automated 48-hour alerts and manager reminders keep security rotations and customer rollouts on schedule.',
                author: 'Daniel Park',
                role: 'Head of Operations, FinBridge',
              },
              {
                metric: '4.2 hours saved weekly per manager',
                quote:
                  'The workload balance chart spots overloaded engineers before a sprint slips, without chasing spreadsheets.',
                author: 'Hannah Alvarez',
                role: 'Delivery Lead, Harbor Logistics',
              },
            ].map((item, idx) => (
              <motion.blockquote
                key={item.author}
                {...revealMotion}
                transition={{
                  duration: 0.45,
                  delay: prefersReducedMotion ? 0 : idx * 0.08,
                }}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div>
                  <div className="font-mono text-sm font-semibold text-blue-600">{item.metric}</div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">“{item.quote}”</p>
                </div>
                <footer className="mt-6 border-t border-slate-100 pt-4">
                  <div className="text-sm font-semibold text-[#0F172A]">{item.author}</div>
                  <div className="text-xs text-slate-500">{item.role}</div>
                </footer>
              </motion.blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Pricing Section */}
      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            {...revealMotion}
            className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                Pricing
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F172A]">
                Transparent plans by team stage
              </h2>
            </div>

            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAnnualBilling(false)}
                className={`rounded-lg px-3 py-1.5 cursor-pointer ${
                  !annualBilling ? 'bg-white text-[#0F172A] shadow-xs' : 'text-slate-600'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setAnnualBilling(true)}
                className={`rounded-lg px-3 py-1.5 cursor-pointer ${
                  annualBilling ? 'bg-white text-[#0F172A] shadow-xs' : 'text-slate-600'
                }`}
              >
                Annual (Save 20%)
              </button>
            </div>
          </motion.div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {PRICING_TIERS.map((tier) => {
              const price = annualBilling ? tier.annual : tier.monthly;
              return (
                <motion.div
                  key={tier.name}
                  {...revealMotion}
                  className={`flex flex-col justify-between rounded-2xl border p-7 ${
                    tier.featured
                      ? 'border-blue-600 bg-[#0F172A] text-white shadow-xl'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                >
                  <div>
                    <div
                      className={`text-xs font-semibold ${
                        tier.featured ? 'text-blue-400' : 'text-blue-600'
                      }`}
                    >
                      {tier.audience}
                    </div>
                    <h3 className="mt-1 font-display text-2xl font-bold">{tier.name}</h3>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="font-mono text-4xl font-bold tabular-nums">${price}</span>
                      <span
                        className={`text-xs ${tier.featured ? 'text-slate-400' : 'text-slate-500'}`}
                      >
                        / user / month
                      </span>
                    </div>
                    <p
                      className={`mt-3 text-sm ${
                        tier.featured ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      {tier.summary}
                    </p>
                    <ul className="mt-6 space-y-2.5 text-sm">
                      {tier.limits.map((lim) => (
                        <li key={lim} className="flex items-start gap-2.5">
                          <Check
                            className={`mt-0.5 h-4 w-4 shrink-0 ${
                              tier.featured ? 'text-blue-400' : 'text-blue-600'
                            }`}
                          />
                          <span>{lim}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      tier.name === 'Enterprise' ? setDemoModalOpen(true) : onOpenAuth('signup')
                    }
                    className={`mt-8 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                      tier.featured
                        ? 'bg-blue-600 text-white hover:bg-blue-500'
                        : 'border border-slate-300 text-[#0F172A] hover:bg-slate-50'
                    }`}
                  >
                    {tier.cta}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. FAQ Section */}
      <section className="border-t border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div {...revealMotion} className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">FAQ</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F172A]">
              Common questions about Cadence
            </h2>
          </motion.div>

          <div className="mt-10 space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={faq.q} className="rounded-xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-[#0F172A] cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-600">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9. Contact / Book a Demo & Footer */}
      <section id="contact" className="border-t border-slate-200 bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Contact & Demo
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F172A]">
              Bring structured execution to your team
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Schedule a guided walkthrough for your managers or create your workspace immediately.
            </p>

            <div className="mt-8 space-y-4 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <span>hello@cadencework.io</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-blue-600" />
                <span>Response within 1 business day</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8 lg:col-span-7">
            {contactStatus === 'sent' ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
                <div className="font-display text-lg font-bold">Demo request received</div>
                <p className="mt-1 text-sm text-emerald-800">
                  Thank you. We saved your request and will follow up shortly. Ready to explore right
                  now?
                </p>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="mt-4 rounded-lg bg-[#0F172A] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  Open Workspace
                </button>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Full Name</label>
                    <input
                      type="text"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Alex Morgan"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Work Email</label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="alex@company.com"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Company</label>
                    <input
                      type="text"
                      value={contactForm.company}
                      onChange={(e) => setContactForm((p) => ({ ...p, company: e.target.value }))}
                      placeholder="Northwind Labs"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Team Size</label>
                    <select
                      value={contactForm.teamSize}
                      onChange={(e) => setContactForm((p) => ({ ...p, teamSize: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-600"
                    >
                      <option value="1-10">1 – 10 people</option>
                      <option value="10-50">10 – 50 people</option>
                      <option value="50-200">50 – 200 people</option>
                      <option value="200+">200+ people</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Workflow Goals
                  </label>
                  <textarea
                    rows={3}
                    value={contactForm.message}
                    onChange={(e) => setContactForm((p) => ({ ...p, message: e.target.value }))}
                    placeholder="Tell us about your team workflows, sprint tracking, or reporting needs..."
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-600"
                  />
                </div>

                {contactStatus === 'error' && contactError && (
                  <p className="text-xs font-medium text-red-600">{contactError}</p>
                )}

                <button
                  type="submit"
                  disabled={contactStatus === 'submitting'}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  {contactStatus === 'submitting' ? 'Sending...' : 'Request Demo'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-[#0B132B] py-10 text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 font-display text-xs font-bold text-white">
              C
            </span>
            <span className="font-display text-sm font-bold text-white">Cadence</span>
            <span className="text-xs text-slate-500">· Full-Stack Task Management</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs">
            <a href="#home" className="hover:text-white">
              Home
            </a>
            <a href="#features" className="hover:text-white">
              Features
            </a>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
            <a href="#contact" className="hover:text-white">
              Contact
            </a>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-white cursor-pointer"
            >
              Login
            </button>
          </div>
        </div>
      </footer>

      {/* Book a Demo Modal */}
      {demoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setDemoModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#0F172A]">Book a Live Demo</h3>
              <button
                type="button"
                aria-label="Close demo dialog"
                onClick={() => setDemoModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              See how managers assign work, balance capacity, and track live sprints in Cadence.
            </p>
            <div className="mt-4">
              {contactStatus === 'sent' ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  Request submitted! Check your inbox soon or jump straight into the app.
                </div>
              ) : (
                <form onSubmit={handleDemoSubmit} className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Full name"
                    value={contactForm.name}
                    onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Work email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600"
                  />
                  <input
                    type="text"
                    placeholder="Company name"
                    value={contactForm.company}
                    onChange={(e) => setContactForm((p) => ({ ...p, company: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600"
                  />
                  {contactStatus === 'error' && contactError && (
                    <p className="text-xs font-medium text-red-600">{contactError}</p>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setDemoModalOpen(false)}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={contactStatus === 'submitting'}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
                    >
                      {contactStatus === 'submitting' ? 'Submitting...' : 'Schedule Demo'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
