'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface TMDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isDeleting?: boolean;
  relatedCount?: { vendors?: number; clients?: number; itinerary?: number };
}

export function TMDeleteDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  isDeleting,
  relatedCount,
}: TMDeleteDialogProps) {
  const relatedParts: string[] = [];
  if (relatedCount?.vendors) relatedParts.push(`${relatedCount.vendors} linked vendors`);
  if (relatedCount?.clients) relatedParts.push(`${relatedCount.clients} linked clients`);
  if (relatedCount?.itinerary) relatedParts.push(`${relatedCount.itinerary} itinerary items`);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {relatedParts.length > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>This will also remove {relatedParts.join(', ')}.</span>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting} autoFocus>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
