'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Paperclip, FileText, ImageIcon, Trash2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
  createdAt: string;
}

interface TripAttachmentsProps {
  tripId: string;
  onRefresh?: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = '.pdf,.doc,.docx,.jpg,.jpeg,.png';

const categoryColors: Record<string, string> = {
  FLIGHT: 'bg-blue-100 text-blue-700',
  HOTEL: 'bg-purple-100 text-purple-700',
  CAR_RENTAL: 'bg-green-100 text-green-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

const categoryLabels: Record<string, string> = {
  FLIGHT: 'Flight',
  HOTEL: 'Hotel',
  CAR_RENTAL: 'Car Rental',
  OTHER: 'Other',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="size-5 text-amber-500" />;
  if (mimeType === 'application/pdf') return <FileText className="size-5 text-red-500" />;
  return <Paperclip className="size-5 text-slate-400" />;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TripAttachments({ tripId, onRefresh }: TripAttachmentsProps) {
  const { showToast } = useTMToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState('OTHER');
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setAttachments(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent fail on initial load
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      showToast('File must be under 10MB', 'error');
      return false;
    }
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.split(',').includes(ext)) {
      showToast('Unsupported file type. Accepted: PDF, DOC, DOCX, JPG, PNG', 'error');
      return false;
    }
    return true;
  };

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', category);

      const res = await fetch(`/api/trips/${tripId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error();
      showToast('File uploaded');
      setSelectedFile(null);
      setCategory('OTHER');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchAttachments();
      onRefresh?.();
    } catch {
      showToast('Failed to upload file', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachmentId: string) => {
    try {
      const res = await fetch(`/api/attachments/${attachmentId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.open(data.url, '_blank');
    } catch {
      showToast('Failed to download file', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/attachments/${deleteTarget}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Attachment deleted');
      setDeleteTarget(null);
      fetchAttachments();
      onRefresh?.();
    } catch {
      showToast('Failed to delete attachment', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-slate-800">Attachments</h3>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
        }`}
      >
        <Upload className="mx-auto mb-2 size-8 text-slate-400" />
        {selectedFile ? (
          <p className="text-sm text-slate-700">
            <span className="font-medium">{selectedFile.name}</span>{' '}
            <span className="text-slate-400">({formatFileSize(selectedFile.size)})</span>
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600">Click or drag a file to upload</p>
            <p className="mt-1 text-xs text-slate-400">PDF, DOC, DOCX, JPG, PNG (max 10MB)</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
          className="hidden"
        />
      </div>

      {selectedFile && (
        <div className="flex items-center gap-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FLIGHT">Flight</SelectItem>
              <SelectItem value="HOTEL">Hotel</SelectItem>
              <SelectItem value="CAR_RENTAL">Car Rental</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={uploading}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Attachment List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : attachments.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Paperclip className="mb-2 size-8 text-slate-300" />
          <p className="text-sm text-slate-400">No attachments yet</p>
          <p className="mt-1 text-xs text-slate-400">Upload flight confirmations, hotel bookings, and more</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100/80"
            >
              {getFileIcon(attachment.mimeType)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700">{attachment.fileName}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{formatFileSize(attachment.fileSize)}</span>
                  <span>{formatDate(attachment.createdAt)}</span>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[attachment.category] || categoryColors.OTHER}`}>
                {categoryLabels[attachment.category] || attachment.category}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleDownload(attachment.id)}
                  className="cursor-pointer rounded p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-500"
                  title="Download"
                >
                  <Download className="size-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(attachment.id)}
                  className="cursor-pointer rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TMDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Attachment"
        description="Are you sure you want to delete this attachment? This action cannot be undone."
        isDeleting={isDeleting}
      />
    </div>
  );
}
