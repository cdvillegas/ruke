import { File, X } from 'lucide-react';
import type { ChatAttachment } from '@shared/types';

export function AttachmentChip({ attachment, removable, onRemove }: {
  attachment: ChatAttachment;
  removable?: boolean;
  onRemove?: () => void;
}) {
  const sizeLabel = attachment.size >= 1024 * 1024
    ? `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`
    : `${(attachment.size / 1024).toFixed(1)} KB`;

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-tertiary/60 border border-border/40 text-xs">
      <File size={12} className="text-accent shrink-0" />
      <span className="text-text-primary font-medium truncate max-w-[160px]">{attachment.name}</span>
      <span className="text-text-muted">{sizeLabel}</span>
      {removable && onRemove && (
        <button onClick={onRemove} className="text-text-muted hover:text-text-primary transition-colors ml-0.5">
          <X size={12} />
        </button>
      )}
    </span>
  );
}
