import { useMemo, useState, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { appEditorTheme, blockEditorExtensions } from '../shared/editorTheme';
import { Copy, Check, WrapText, Download, Play, Pause, Volume2, Image as ImageIcon, FileDown } from 'lucide-react';

interface Props {
  body: string;
  bodyEncoding?: 'base64';
  contentType: string;
}

function AudioPlayer({ base64, contentType }: { base64: string; contentType: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const mimeType = contentType.split(';')[0].trim();
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = dataUrl;
    const ext = mimeType.split('/')[1]?.replace('mpeg', 'mp3') || 'bin';
    a.download = `response.${ext}`;
    a.click();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center">
        <Volume2 size={28} className="text-accent" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-medium text-text-primary">Audio Response</span>
        <span className="text-xs text-text-muted">{mimeType}</span>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <div
          className="h-1.5 bg-bg-tertiary rounded-full cursor-pointer overflow-hidden"
          onClick={(e) => {
            if (!audioRef.current || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
          }}
        >
          <div
            className="h-full bg-accent rounded-full transition-[width] duration-100"
            style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-text-muted font-mono">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="w-10 h-10 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors"
        >
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <button
          onClick={handleDownload}
          className="p-2 rounded-lg bg-bg-tertiary border border-border hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          title="Download audio"
        >
          <Download size={16} />
        </button>
      </div>

      <audio
        ref={audioRef}
        src={dataUrl}
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}

function ImageViewer({ base64, contentType }: { base64: string; contentType: string }) {
  const mimeType = contentType.split(';')[0].trim();
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = dataUrl;
    const ext = mimeType.split('/')[1] || 'bin';
    a.download = `response.${ext}`;
    a.click();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <img src={dataUrl} alt="Response" className="max-w-full max-h-[60%] rounded-lg border border-border object-contain" />
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border hover:bg-bg-hover text-text-secondary hover:text-text-primary text-xs transition-colors"
      >
        <Download size={14} />
        Download
      </button>
    </div>
  );
}

function BinaryViewer({ base64, contentType }: { base64: string; contentType: string }) {
  const mimeType = contentType.split(';')[0].trim();
  const sizeBytes = Math.ceil(base64.length * 3 / 4);
  const formatSize = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = `data:${mimeType};base64,${base64}`;
    const ext = mimeType.split('/')[1] || 'bin';
    a.download = `response.${ext}`;
    a.click();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <div className="w-14 h-14 rounded-2xl bg-bg-tertiary border border-border flex items-center justify-center">
        <FileDown size={24} className="text-text-muted" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-medium text-text-primary">Binary Response</span>
        <span className="text-xs text-text-muted">{mimeType} &middot; {formatSize(sizeBytes)}</span>
      </div>
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
      >
        <Download size={14} />
        Download File
      </button>
    </div>
  );
}

export function ResponseBody({ body, bodyEncoding, contentType }: Props) {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);

  const ct = contentType.toLowerCase();

  if (bodyEncoding === 'base64') {
    if (ct.startsWith('audio/')) return <AudioPlayer base64={body} contentType={contentType} />;
    if (ct.startsWith('image/')) return <ImageViewer base64={body} contentType={contentType} />;
    return <BinaryViewer base64={body} contentType={contentType} />;
  }

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
          extensions={isJson ? [json(), blockEditorExtensions] : [blockEditorExtensions]}
          theme={appEditorTheme}
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
