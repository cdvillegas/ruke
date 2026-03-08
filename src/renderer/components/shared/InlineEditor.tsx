import { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { appEditorTheme, inlineEditorExtensions } from './editorTheme';

const singleLineKeymap = Prec.highest(
  keymap.of([{
    key: 'Enter',
    run: () => true,
  }])
);

interface InlineEditorProps {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  jsonMode?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function InlineEditor({
  value,
  onChange,
  multiline = false,
  jsonMode = false,
  placeholder,
  className = '',
  disabled = false,
}: InlineEditorProps) {
  const extensions = useCallback(() => {
    const exts = [inlineEditorExtensions];
    if (jsonMode) exts.push(json());
    if (multiline) {
      exts.push(EditorView.lineWrapping);
    } else {
      exts.push(singleLineKeymap);
    }
    return exts;
  }, [jsonMode, multiline]);

  return (
    <div className={`rounded-xl overflow-hidden bg-bg-secondary border border-border focus-within:border-accent/40 transition-colors ${disabled ? 'opacity-40' : ''} ${className}`}>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions()}
        theme={appEditorTheme}
        placeholder={placeholder}
        readOnly={disabled}
        minHeight={multiline ? '36px' : undefined}
        maxHeight={multiline ? '300px' : undefined}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          bracketMatching: jsonMode,
          closeBrackets: jsonMode,
          highlightActiveLine: false,
          indentOnInput: multiline,
          autocompletion: false,
          searchKeymap: false,
        }}
      />
    </div>
  );
}
