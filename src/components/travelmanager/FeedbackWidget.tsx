'use client';

import { useState, useRef } from 'react';
import { MessageSquarePlus, X, Send, Loader2, Check } from 'lucide-react';

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_LENGTH = 1000;

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
        setOpen(false);
        setStatus('idle');
      }, 2000);
    } catch {
      setStatus('error');
    }
  }

  return (
    <div data-no-track className="fixed bottom-6 right-6 z-[55]">
      {open && (
        <div className="absolute bottom-14 right-0 w-80 bg-white rounded-xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100">
            <span className="text-sm font-semibold text-amber-800">Send Feedback</span>
            <button
              onClick={() => { setOpen(false); setStatus('idle'); }}
              className="text-amber-600 hover:text-amber-800 transition-colors"
              aria-label="Close feedback"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="p-4">
            {status === 'sent' ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="size-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
                  <Check className="size-5 text-green-600" />
                </div>
                <p className="text-sm font-medium text-slate-700">Thanks for your feedback!</p>
              </div>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
                  placeholder="What could we improve?"
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">
                    {message.length}/{MAX_LENGTH}
                  </span>
                  <div className="flex items-center gap-2">
                    {status === 'error' && (
                      <span className="text-xs text-red-500">Failed to send</span>
                    )}
                    <button
                      onClick={handleSubmit}
                      disabled={!message.trim() || status === 'sending'}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      )}

      <button
        onClick={() => setOpen(!open)}
        className="size-12 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-all"
        aria-label="Send feedback"
      >
        <MessageSquarePlus className="size-5" />
      </button>
    </div>
  );
}
