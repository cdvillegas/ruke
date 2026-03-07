import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  headers: Record<string, string>;
}

export function ResponseHeaders({ headers }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const entries = Object.entries(headers);

  const handleCopy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="p-4">
      {entries.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-4">No response headers</p>
      ) : (
        <div className="space-y-1">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="group flex items-start gap-3 px-3 py-1.5 rounded-md hover:bg-bg-hover transition-colors"
            >
              <span className="text-xs font-mono font-semibold text-accent shrink-0 min-w-[160px]">
                {key}
              </span>
              <span className="text-xs font-mono text-text-secondary break-all flex-1">
                {value}
              </span>
              <button
                onClick={() => handleCopy(key, value)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-text-primary transition-all shrink-0"
              >
                {copiedKey === key ? (
                  <Check size={12} className="text-success" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
