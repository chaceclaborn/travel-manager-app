'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Check } from 'lucide-react';

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_LENGTH = 1000;

  // Focus the textarea when the modal opens, and reset state when it closes.
  useEffect(() => {
    if (open) {
      setStatus('idle');
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setMessage('');
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function handleSubmit() {
    if (!message.trim() || status === 'sending') return;

    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!res.ok) throw new Error('Failed');

      setStatus('sent');
      setMessage('');
      setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 1600);
    } catch {
      setStatus('error');
    }
  }

  if (!open) return null;

  return (
    <div
      data-no-track
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Send feedback"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">Send Feedback</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close feedback"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5">
          {status === 'sent' ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="size-11 rounded-full bg-green-50 flex items-center justify-center mb-3">
                <Check className="size-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-slate-700">Thanks for your feedback!</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-3">
                Found a bug or have an idea? Let us know — we read every note.
              </p>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
                placeholder="What could we improve?"
                rows={5}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-slate-400">
                  {message.length}/{MAX_LENGTH}
                </span>
                <div className="flex items-center gap-3">
                  {status === 'error' && (
                    <span className="text-xs text-red-500">Failed to send</span>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={!message.trim() || status === 'sending'}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {status === 'sending' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
