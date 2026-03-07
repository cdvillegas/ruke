import { Plus, Trash2 } from 'lucide-react';
import { useEnvironmentStore } from '../../stores/environmentStore';
import type { KeyValue } from '@shared/types';

interface Props {
  pairs: KeyValue[];
  onChange: (pairs: KeyValue[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function KeyValueEditor({ pairs, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }: Props) {
  const resolveString = useEnvironmentStore((s) => s.resolveString);

  const update = (index: number, field: keyof KeyValue, val: string | boolean) => {
    const updated = pairs.map((p, i) =>
      i === index ? { ...p, [field]: val } : p
    );
    onChange(updated);
  };

  const add = () => {
    onChange([...pairs, { key: '', value: '', enabled: true }]);
  };

  const remove = (index: number) => {
    onChange(pairs.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5">
      {/* Header row */}
      <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 px-1 text-[10px] text-text-muted uppercase tracking-wider font-semibold">
        <div className="w-5" />
        <div>Key</div>
        <div>Value</div>
        <div className="w-7" />
      </div>

      {pairs.map((pair, i) => {
        const resolvedValue = pair.value.includes('{{') ? resolveString(pair.value) : null;
        return (
          <div
            key={i}
            className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center group"
          >
            <input
              type="checkbox"
              checked={pair.enabled}
              onChange={(e) => update(i, 'enabled', e.target.checked)}
              className="w-4 h-4 rounded border-border accent-accent cursor-pointer"
            />
            <input
              type="text"
              value={pair.key}
              onChange={(e) => update(i, 'key', e.target.value)}
              placeholder={keyPlaceholder}
              className={`px-3 py-1.5 text-xs rounded-md bg-bg-tertiary border border-border font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors ${
                !pair.enabled ? 'opacity-40' : ''
              }`}
            />
            <div className="relative">
              <input
                type="text"
                value={pair.value}
                onChange={(e) => update(i, 'value', e.target.value)}
                placeholder={valuePlaceholder}
                className={`w-full px-3 py-1.5 text-xs rounded-md bg-bg-tertiary border border-border font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors ${
                  !pair.enabled ? 'opacity-40' : ''
                }`}
              />
              {resolvedValue && resolvedValue !== pair.value && (
                <div className="absolute -bottom-4 left-0 text-[9px] text-accent font-mono truncate max-w-full">
                  = {resolvedValue}
                </div>
              )}
            </div>
            <button
              onClick={() => remove(i)}
              className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}

      <button
        onClick={add}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors rounded-md hover:bg-bg-hover"
      >
        <Plus size={13} />
        <span>Add</span>
      </button>
    </div>
  );
}
