'use client';

import { useRef, useState } from 'react';
import { Camera, ImageIcon, Plus, Trash2 } from 'lucide-react';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { PhotoSlideshow } from '@/components/travelmanager/PhotoSlideshow';
import { usePhotos } from '@/lib/photos/usePhotos';
import type { PhotoParentType } from '@/lib/photos/types';
import { cn } from '@/lib/utils';

interface PhotoGalleryProps {
  tripId: string;
  parentType: PhotoParentType;
  parentId: string;
  /** Small inline strip (stops, notes) instead of the full grid (trip tab). */
  compact?: boolean;
  /** Fires after photos are added or deleted, for parents tracking counts. */
  onChanged?: () => void;
  className?: string;
}

/**
 * Photo strip/grid backed by the on-device store — nothing uploads anywhere.
 * Tapping a thumbnail opens the slideshow at that photo; the add tile opens
 * the system picker (which on iOS offers camera + photo library for free via
 * accept="image/*").
 */
export function PhotoGallery({ tripId, parentType, parentId, compact = false, onChanged, className }: PhotoGalleryProps) {
  const { showToast } = useTMToast();
  const { photos, thumbUrls, loading, adding, addFiles, removePhoto } = usePhotos({
    tripId,
    parentType,
    parentId,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith('image/') || f.type === '');
    if (files.length === 0) return;
    const result = await addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (result.added.length > 0) {
      showToast(result.added.length === 1 ? 'Photo added' : `${result.added.length} photos added`);
      onChanged?.();
    }
    if (result.failed.length > 0) {
      showToast(`Couldn't read ${result.failed.join(', ')}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await removePhoto(deleteTarget);
      setDeleteTarget(null);
      showToast('Photo deleted');
      onChanged?.();
    } catch {
      showToast('Failed to delete photo', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const thumbClass = compact
    ? 'size-14 rounded-md'
    : 'aspect-square w-full rounded-lg';

  if (loading) {
    return compact ? null : (
      <div className={cn('grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="aspect-square animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {!compact && photos.length === 0 && (
        <div className="mb-4 flex flex-col items-center py-8 text-center">
          <ImageIcon className="mb-2 size-8 text-slate-300" />
          <p className="text-sm text-slate-400">No photos yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Photos stay on this device — they&apos;re never uploaded
          </p>
        </div>
      )}

      <div
        className={cn(
          compact
            ? 'flex flex-wrap items-center gap-2'
            : 'grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5',
        )}
      >
        {photos.map((photo, i) => (
          <div key={photo.id} className={cn('group relative overflow-hidden bg-slate-100', thumbClass)}>
            <button
              onClick={() => setSlideshowIndex(i)}
              className="block size-full cursor-pointer"
              title={photo.fileName}
            >
              {thumbUrls[photo.id] ? (
                // eslint-disable-next-line @next/next/no-img-element -- blob: URL from on-device store
                <img
                  src={thumbUrls[photo.id]}
                  alt={photo.fileName}
                  className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                  draggable={false}
                />
              ) : (
                <ImageIcon className="m-auto size-5 text-slate-300" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(photo.id);
              }}
              className={cn(
                'absolute right-1 top-1 cursor-pointer rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100',
                compact && 'p-0.5',
              )}
              title="Delete photo"
            >
              <Trash2 className={compact ? 'size-3' : 'size-3.5'} />
            </button>
          </div>
        ))}

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={adding}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-200 text-slate-400 transition-colors hover:border-amber-300 hover:bg-amber-50/50 hover:text-amber-500 disabled:cursor-wait disabled:opacity-60',
            thumbClass,
          )}
          title="Add photos"
        >
          {compact ? (
            <Plus className="size-4" />
          ) : (
            <>
              {adding ? (
                <div className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500" />
              ) : (
                <Camera className="size-5" />
              )}
              <span className="text-xs">{adding ? 'Adding…' : 'Add photos'}</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      <PhotoSlideshow
        photos={photos}
        startIndex={slideshowIndex ?? 0}
        open={slideshowIndex !== null}
        onClose={() => setSlideshowIndex(null)}
      />

      <TMDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Photo"
        description="This photo is stored only on this device and can't be recovered after deletion. Delete it?"
        isDeleting={isDeleting}
      />
    </div>
  );
}
