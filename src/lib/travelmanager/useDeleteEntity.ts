'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTMToast } from '@/components/travelmanager/TMToast';

/**
 * Reusable hook for entity deletion with confirmation dialog state.
 *
 * Encapsulates the pattern duplicated across trips/[id], clients/[id],
 * vendors/[id], and bookings/[id] detail pages:
 * - open/close state for the delete dialog
 * - deleting loading state
 * - fetch DELETE → toast → redirect
 *
 * @param apiPath - API endpoint to DELETE (e.g. `/api/clients/abc123`)
 * @param redirectPath - Where to navigate after successful deletion
 * @param entityName - Human-readable name for toast messages (e.g. "Client")
 * @param onDeleted - Optional cleanup run after a successful delete, before
 *   redirect (e.g. purging the entity's on-device photos). Failures are
 *   swallowed — the entity is already gone remotely.
 */
export function useDeleteEntity(
  apiPath: string,
  redirectPath: string,
  entityName: string,
  onDeleted?: () => void | Promise<void>
) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const { showToast } = useTMToast();

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(apiPath, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Failed to delete ${entityName.toLowerCase()}`);
      if (onDeleted) {
        try {
          await onDeleted();
        } catch {
          // cleanup is best-effort; the remote delete already succeeded
        }
      }
      showToast(`${entityName} deleted`);
      router.push(redirectPath);
    } catch {
      showToast(`Failed to delete ${entityName.toLowerCase()}`, 'error');
    } finally {
      setDeleting(false);
    }
  }, [apiPath, redirectPath, entityName, router, showToast, onDeleted]);

  return {
    deleteOpen,
    setDeleteOpen,
    deleting,
    handleDelete,
  };
}
