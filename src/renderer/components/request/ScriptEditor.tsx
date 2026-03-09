import { useState } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import { appEditorTheme, blockEditorExtensions } from '../shared/editorTheme';
import {
  Play, CheckCircle2, XCircle, AlertTriangle,
  Code, ChevronDown, Timer, Variable, TestTube2, Link2,
} from 'lucide-react';
import type { TestResult, ScriptConfig } from '@shared/types';

const SCRIPT_TEMPLATES = {
  'Set variable from response': `// Extract a value from the response and save it as a variable
const data = response.json();
rk.variables.set('token', data.access_token);
rk.log('Token saved:', data.access_token);`,

  'Validate status code': `// Assert that the response status is 200
rk.test('Status is 200', () => {
  rk.expect(response.status).toBe(200);
});`,

  'Validate response body': `// Assert response body structure
rk.test('Response has data', () => {
  const data = response.json();
  rk.expect(data).toHaveProperty('id');
  rk.expect(data.name).toBeTruthy();
});`,

  'Chain requests': `// Set variables for the next request
const data = response.json();
rk.variables.set('userId', data.id);
rk.variables.set('authToken', response.headers['x-auth-token']);`,

  'Dynamic timestamp': `// Set a timestamp variable before the request
rk.variables.set('timestamp', Date.now().toString());
rk.variables.set('isoDate', new Date().toISOString());`,

  'Response time check': `// Assert response time is under threshold
rk.test('Response time under 500ms', () => {
  rk.expect(response.duration).toBeLessThan(500);
});`,
};

const PRE_TEMPLATES: Record<string, string> = {
  'Dynamic timestamp': SCRIPT_TEMPLATES['Dynamic timestamp'],
};

const POST_TEMPLATES: Record<string, string> = {
  'Set variable from response': SCRIPT_TEMPLATES['Set variable from response'],
  'Validate status code': SCRIPT_TEMPLATES['Validate status code'],
  'Validate response body': SCRIPT_TEMPLATES['Validate response body'],
  'Chain requests': SCRIPT_TEMPLATES['Chain requests'],
  'Response time check': SCRIPT_TEMPLATES['Response time check'],
};

const TEMPLATE_ICONS: Record<string, typeof Code> = {
  'Dynamic timestamp': Timer,
  'Set variable from response': Variable,
  'Validate status code': CheckCircle2,
  'Validate response body': TestTube2,
  'Chain requests': Link2,
  'Response time check': Timer,
};

export function ScriptEditor() {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const updateActiveRequest = useRequestStore((s) => s.updateActiveRequest);
  const [activeTab, setActiveTab] = useState<'pre' | 'post'>('post');
  const [lastResults, setLastResults] = useState<TestResult[]>([]);
  const [lastLogs, setLastLogs] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [editing, setEditing] = useState(false);

  const scripts: ScriptConfig = activeRequest.scripts || {};
  const currentScript = activeTab === 'pre' ? (scripts.preRequest || '') : (scripts.postResponse || '');
  const hasScript = !!currentScript.trim();
  const showEditor = hasScript || editing;

  const updateScript = (value: string) => {
    const updated: ScriptConfig = { ...scripts };
    if (activeTab === 'pre') {
      updated.preRequest = value;
    } else {
      updated.postResponse = value;
    }
    updateActiveRequest({ scripts: updated });
  };

  const applyTemplate = (code: string) => {
    updateScript(code);
    setEditing(true);
  };

  const testScript = async () => {
    if (!currentScript.trim()) return;
    setRunning(true);
    setLastResults([]);
    setLastLogs([]);
    setLastError(null);

    try {
      const response = useRequestStore.getState().response;
      const context = {
        request: {
          method: activeRequest.method,
          url: activeRequest.url,
          headers: Object.fromEntries(activeRequest.headers.filter(h => h.enabled).map(h => [h.key, h.value])),
          body: activeRequest.body.raw,
        },
        response: response ? {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          body: response.body,
          duration: response.duration,
        } : undefined,
        variables: {},
        testResults: [],
      };

      const result = await window.ruke.scripting.run(currentScript, context, activeTab === 'pre' ? 'pre-request' : 'post-response');
      setLastResults(result.testResults || []);
      setLastLogs(result.logs || []);
      if (result.error) setLastError(result.error);
    } catch (e: any) {
      setLastError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const templates = activeTab === 'pre' ? PRE_TEMPLATES : POST_TEMPLATES;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-bg-secondary/60 w-fit">
          <button
            onClick={() => setActiveTab('pre')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 ${
              activeTab === 'pre' ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Pre-request
            {scripts.preRequest && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-success inline-block" />}
          </button>
          <button
            onClick={() => setActiveTab('post')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 ${
              activeTab === 'post' ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Post-response
            {scripts.postResponse && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-success inline-block" />}
          </button>
        </div>

        {showEditor && (
          <button
            onClick={testScript}
            disabled={running || !hasScript}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
          >
            <Play size={11} />
            Test
          </button>
        )}
      </div>

      {!showEditor && (
        <div className="py-6 text-center">
          <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center mx-auto mb-3">
            <Code size={16} className="text-text-muted" />
          </div>
          <p className="text-xs text-text-secondary mb-1">
            {activeTab === 'pre' ? 'No pre-request script' : 'No post-response script'}
          </p>
          <p className="text-[11px] text-text-muted mb-4 max-w-xs mx-auto">
            {activeTab === 'pre'
              ? 'Set variables or modify the request before it is sent.'
              : 'Validate responses, extract values, and chain requests together.'}
          </p>

          <div className="flex flex-col gap-1.5 max-w-xs mx-auto">
            {Object.entries(templates).map(([name, code]) => {
              const Icon = TEMPLATE_ICONS[name] || Code;
              return (
                <button
                  key={name}
                  onClick={() => applyTemplate(code)}
                  className="flex items-center gap-2.5 px-3 py-2 text-left rounded-lg bg-bg-secondary border border-border hover:border-border-light hover:bg-bg-tertiary transition-colors group"
                >
                  <Icon size={12} className="text-text-muted group-hover:text-text-secondary shrink-0 transition-colors" />
                  <span className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors">{name}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setEditing(true)}
            className="mt-3 text-[11px] text-accent hover:text-accent-hover transition-colors"
          >
            Write from scratch
          </button>
        </div>
      )}

      {showEditor && (
        <>
          <div className="rounded-lg bg-bg-secondary border border-border/60 overflow-hidden focus-within:border-border-light transition-colors">
            <CodeMirror
              value={currentScript}
              onChange={updateScript}
              extensions={[javascript(), blockEditorExtensions, EditorView.lineWrapping]}
              theme={appEditorTheme}
              minHeight="80px"
              maxHeight="300px"
              placeholder={activeTab === 'pre'
                ? '// Runs before the request is sent\n// Use rk.variables.set(key, value) to set variables'
                : '// Runs after the response is received\n// Use rk.test(name, fn) to add test assertions\n// Use response.json() to parse the response body'
              }
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                bracketMatching: true,
                closeBrackets: true,
                highlightActiveLine: false,
                autocompletion: false,
              }}
            />
          </div>

          <button
            onClick={() => setShowRef(!showRef)}
            className="flex items-center gap-1.5 text-[10px] text-text-muted/60 hover:text-text-secondary transition-colors"
          >
            <ChevronDown size={10} className={`transition-transform ${showRef ? '' : '-rotate-90'}`} />
            API Reference
          </button>

          {showRef && (
            <div className="text-[10px] text-text-muted space-y-0.5 pl-3.5">
              <p><code className="text-accent/70 bg-accent/8 px-1 rounded">rk.variables.set(key, value)</code> / <code className="text-accent/70 bg-accent/8 px-1 rounded">.get(key)</code> — manage variables</p>
              <p><code className="text-accent/70 bg-accent/8 px-1 rounded">rk.test(name, fn)</code> / <code className="text-accent/70 bg-accent/8 px-1 rounded">rk.expect(val).toBe(expected)</code> — assertions</p>
              {activeTab === 'post' && (
                <p><code className="text-accent/70 bg-accent/8 px-1 rounded">response.json()</code> / <code className="text-accent/70 bg-accent/8 px-1 rounded">response.status</code> / <code className="text-accent/70 bg-accent/8 px-1 rounded">response.headers</code> — response data</p>
              )}
            </div>
          )}
        </>
      )}

      {(lastResults.length > 0 || lastLogs.length > 0 || lastError) && (
        <div className="space-y-1.5 border-t border-border/60 pt-2.5">
          {lastError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-error/10 border border-error/20">
              <AlertTriangle size={12} className="text-error mt-0.5 shrink-0" />
              <span className="text-[11px] text-error font-mono">{lastError}</span>
            </div>
          )}

          {lastResults.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] ${
                r.passed ? 'bg-success/10 border border-success/20' : 'bg-error/10 border border-error/20'
              }`}
            >
              {r.passed ? (
                <CheckCircle2 size={12} className="text-success shrink-0" />
              ) : (
                <XCircle size={12} className="text-error shrink-0" />
              )}
              <span className={r.passed ? 'text-success' : 'text-error'}>{r.name}</span>
              {r.error && <span className="text-error/70 ml-auto font-mono truncate max-w-[50%]">{r.error}</span>}
              {r.duration !== undefined && <span className="text-text-muted ml-auto tabular-nums">{r.duration}ms</span>}
            </div>
          ))}

          {lastLogs.length > 0 && (
            <div className="px-3 py-2 rounded-lg bg-bg-secondary border border-border/60">
              <p className="text-[9px] text-text-muted/40 uppercase tracking-wider font-medium mb-1">Console</p>
              {lastLogs.map((log, i) => (
                <p key={i} className="text-[11px] font-mono text-text-secondary">{log}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
