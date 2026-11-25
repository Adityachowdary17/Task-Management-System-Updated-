import React, { useState } from 'react';
import { ExternalLink, Globe, Send, Sparkles, X } from 'lucide-react';
import { api } from '../services/apiClient';
import { ChatMessage } from '../types';

interface ResearchDrawerProps {
  isOpen: boolean;
  workspaceContext: string;
  onClose: () => void;
}

export const ResearchDrawer: React.FC<ResearchDrawerProps> = ({
  isOpen,
  workspaceContext,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: prompt,
      sources: [],
    };
    const nextHistory = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const res = await api.sendGeminiChat({
        message: prompt,
        history: nextHistory,
        useSearch: true,
        workspaceContext,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: res.text,
          sources: res.sources || [],
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete web-grounded query.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Web-Grounded Workspace Strategist"
        className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border ws-accent-soft">
              <Globe className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                Web-Grounded Research
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Live Google Search citations for planning & specs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close research panel"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                <Sparkles className="h-3.5 w-3.5 ws-accent-text" />
                Ask with live Search Grounding
              </div>
              <p className="mt-1.5 leading-relaxed">
                Verify current framework releases, security advisories, compliance deadlines, or
                estimation benchmarks directly alongside your active tasks.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'ml-8 ws-accent-bg'
                  : 'mr-4 border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>
              {msg.sources.length > 0 && (
                <div className="mt-2.5 border-t border-slate-200/80 pt-2 dark:border-slate-700">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Sources
                  </div>
                  <div className="flex flex-col gap-1">
                    {msg.sources.map((src) => (
                      <a
                        key={src.uri}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 truncate text-[11px] font-medium ws-accent-text hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{src.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="mr-8 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              Searching & synthesizing grounded answer...
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <form
          onSubmit={handleSend}
          className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-800"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a web-grounded question..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold ws-accent-bg disabled:opacity-50 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </aside>
    </div>
  );
};
