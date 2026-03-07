import { useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { Copy, Check, WrapText } from 'lucide-react';

interface Props {
  body: string;
}

export function ResponseBody({ body }: Props) {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);

  const formatted = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }, [body]);

  const isJson = useMemo(() => {
    try {
      JSON.parse(body);
      return true;
    } catch {
      return false;
    }
  }, [body]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border shrink-0">
        <button
          onClick={() => setWordWrap(!wordWrap)}
          className={`p-1 rounded text-text-muted hover:text-text-primary transition-colors ${
            wordWrap ? 'bg-bg-active' : ''
          }`}
          title="Toggle word wrap"
        >
          <WrapText size={13} />
        </button>
        <button
          onClick={handleCopy}
          className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
          title="Copy response"
        >
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
        </button>
        {isJson && (
          <span className="text-[10px] text-text-muted ml-auto">JSON</span>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={formatted}
          extensions={isJson ? [json()] : []}
          theme={oneDark}
          readOnly
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: false,
          }}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}
