import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { VARIABLE_REGEX } from '@shared/constants';

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
  type?: string;
}

export function VariableInput({ value, onChange, onKeyDown, placeholder, className = '', type = 'text' }: VariableInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getAllVariableKeys = useEnvironmentStore((s) => s.getAllVariableKeys);
  const allKeys = useMemo(() => getAllVariableKeys(), [getAllVariableKeys]);

  const getVariableContext = useCallback((): { isInVariable: boolean; prefix: string; startIdx: number } => {
    const beforeCursor = value.substring(0, cursorPos);
    const lastOpen = beforeCursor.lastIndexOf('{{');
    if (lastOpen === -1) return { isInVariable: false, prefix: '', startIdx: -1 };

    const afterOpen = beforeCursor.substring(lastOpen + 2);
    if (afterOpen.includes('}}')) return { isInVariable: false, prefix: '', startIdx: -1 };

    return { isInVariable: true, prefix: afterOpen, startIdx: lastOpen };
  }, [value, cursorPos]);

  const context = getVariableContext();
  const suggestions = context.isInVariable
    ? allKeys.filter((k) => k.toLowerCase().startsWith(context.prefix.toLowerCase()))
    : [];

  useEffect(() => {
    setShowSuggestions(context.isInVariable && suggestions.length > 0);
    setSelectedSuggestion(0);
  }, [context.isInVariable, suggestions.length]);

  const applySuggestion = (key: string) => {
    const { startIdx } = context;
    const beforeVar = value.substring(0, startIdx);
    const afterCursor = value.substring(cursorPos);
    const closingIdx = afterCursor.indexOf('}}');
    const rest = closingIdx >= 0 ? afterCursor.substring(closingIdx + 2) : afterCursor;
    const newValue = `${beforeVar}{{${key}}}${rest}`;
    onChange(newValue);
    setShowSuggestions(false);

    requestAnimationFrame(() => {
      const newPos = `${beforeVar}{{${key}}}`.length;
      inputRef.current?.setSelectionRange(newPos, newPos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestion((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (suggestions[selectedSuggestion]) {
          e.preventDefault();
          applySuggestion(suggestions[selectedSuggestion]);
          return;
        }
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setCursorPos(e.target.selectionStart || 0);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    setCursorPos((e.target as HTMLInputElement).selectionStart || 0);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1 w-64 bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 py-1 animate-fade-in max-h-40 overflow-y-auto"
        >
          <div className="px-3 py-1 text-[9px] text-text-muted uppercase tracking-wider font-semibold">
            Variables
          </div>
          {suggestions.map((key, i) => (
            <button
              key={key}
              onMouseDown={(e) => {
                e.preventDefault();
                applySuggestion(key);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                i === selectedSuggestion
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              <code className="text-[11px] font-mono">{`{{${key}}}`}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function VariableHighlight({ text }: { text: string }) {
  const parts = text.split(VARIABLE_REGEX);
  if (parts.length <= 1) return <span className="font-mono">{text}</span>;

  return (
    <span className="font-mono">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="text-accent bg-accent/10 rounded px-0.5">{`{{${part}}}`}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}
