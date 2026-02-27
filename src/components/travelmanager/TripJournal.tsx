'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Pencil, Trash2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';

interface Note {
  id: string;
  date: string;
  content: string;
  createdAt: string;
}

interface TripJournalProps {
  tripId: string;
}

function formatDateHeading(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function groupByDate(notes: Note[]) {
  const groups: Record<string, Note[]> = {};
  for (const note of notes) {
    const key = new Date(note.date).toISOString().split('T')[0];
    if (!groups[key]) groups[key] = [];
    groups[key].push(note);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

const entryVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' as const },
  }),
};

const dateGroupVariants = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: { delay: i * 0.12, duration: 0.3 },
  }),
};

export function TripJournal({ tripId }: TripJournalProps) {
  const { showToast } = useTMToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({ date: '', content: '' });
  const [editForm, setEditForm] = useState({ date: '', content: '' });

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/notes`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch {
      showToast('Failed to load notes', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [tripId, showToast]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content.trim() || !form.date) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          content: form.content.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Journal entry added');
      setForm({ date: '', content: '' });
      setShowForm(false);
      fetchNotes();
    } catch {
      showToast('Failed to add entry', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditForm({
      date: new Date(note.date).toISOString().split('T')[0],
      content: note.content,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.content.trim() || !editForm.date || !editingId) return;

    setIsEditSubmitting(true);
    try {
      const res = await fetch(`/api/notes/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editForm.date,
          content: editForm.content.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Journal entry updated');
      setEditingId(null);
      fetchNotes();
    } catch {
      showToast('Failed to update entry', 'error');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/notes/${deleteTarget}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Journal entry deleted');
      setDeleteTarget(null);
      fetchNotes();
    } catch {
      showToast('Failed to delete entry', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const grouped = groupByDate(notes);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  let globalEntryIndex = 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Journal</h3>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="bg-amber-500 hover:bg-amber-600"
        >
          <Plus className="mr-1 size-4" />
          Add Entry
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAdd}
            className="space-y-3 overflow-hidden rounded-lg border border-amber-200 bg-amber-50/50 p-4"
          >
            <div className="space-y-1">
              <Label htmlFor="note-date">Date *</Label>
              <Input
                id="note-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="note-content">Entry *</Label>
              <Textarea
                id="note-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={4}
                placeholder="Write about your experience..."
                className="resize-none transition-colors duration-200 focus:border-amber-400 focus:ring-amber-400"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isSubmitting} className="bg-amber-500 hover:bg-amber-600">
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Calendar className="mb-3 size-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No journal entries yet</p>
          <p className="mt-1 text-xs text-slate-400">Start documenting your trip!</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-1 size-4" />
            Add Your First Entry
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([date, dateNotes], groupIdx) => (
            <motion.div
              key={date}
              custom={groupIdx}
              variants={dateGroupVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100 ring-2 ring-amber-200/60">
                  <Calendar className="size-3.5 text-amber-600" />
                </div>
                <h4 className="text-sm font-semibold text-slate-700">
                  {formatDateHeading(date)}
                </h4>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="space-y-3 pl-5">
                {dateNotes.map((note) => {
                  const entryIdx = globalEntryIndex++;
                  return (
                    <motion.div
                      key={note.id}
                      custom={entryIdx}
                      variants={entryVariants}
                      initial="hidden"
                      animate="visible"
                      layout
                      className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:border-slate-200 hover:shadow-md"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {editingId === note.id ? (
                          <motion.form
                            key="edit"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onSubmit={handleUpdate}
                            className="space-y-3"
                          >
                            <div className="space-y-1">
                              <Label>Date *</Label>
                              <Input
                                type="date"
                                value={editForm.date}
                                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Entry *</Label>
                              <Textarea
                                value={editForm.content}
                                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                                rows={4}
                                className="resize-none border-amber-200 bg-amber-50/30 transition-colors duration-200 focus:border-amber-400 focus:bg-white focus:ring-amber-400"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" disabled={isEditSubmitting} className="bg-amber-500 hover:bg-amber-600">
                                {isEditSubmitting ? 'Saving...' : 'Save'}
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </motion.form>
                        ) : (
                          <motion.div
                            key="view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{note.content}</p>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <button
                                  onClick={() => startEdit(note)}
                                  className="cursor-pointer rounded-md p-1.5 text-slate-300 transition-all duration-200 hover:bg-amber-50 hover:text-amber-500"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(note.id)}
                                  className="cursor-pointer rounded-md p-1.5 text-slate-300 transition-all duration-200 hover:bg-red-50 hover:text-red-500"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-slate-400">{formatTime(note.createdAt)}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <TMDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Journal Entry"
        description="Are you sure you want to delete this journal entry? This action cannot be undone."
        isDeleting={isDeleting}
      />
    </div>
  );
}
