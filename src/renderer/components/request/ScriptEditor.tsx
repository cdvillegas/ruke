import { useState } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { Play, CheckCircle2, XCircle, AlertTriangle, Sparkles } from 'lucide-react';
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

export function ScriptEditor() {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const updateActiveRequest = useRequestStore((s) => s.updateActiveRequest);
  const [activeTab, setActiveTab] = useState<'pre' | 'post'>('post');
  const [lastResults, setLastResults] = useState<TestResult[]>([]);
  const [lastLogs, setLastLogs] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const scripts: ScriptConfig = activeRequest.scripts || {};
  const currentScript = activeTab === 'pre' ? (scripts.preRequest || '') : (scripts.postResponse || '');

  const updateScript = (value: string) => {
    const updated: ScriptConfig = { ...scripts };
    if (activeTab === 'pre') {
      updated.preRequest = value;
    } else {
      updated.postResponse = value;
    }
    updateActiveRequest({ scripts: updated });
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
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-bg-secondary/60 flex-1">
          <button
            onClick={() => setActiveTab('pre')}
            className={`flex-1 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
              activeTab === 'pre' ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Pre-request
            {scripts.preRequest && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-success inline-block" />}
          </button>
          <button
            onClick={() => setActiveTab('post')}
            className={`flex-1 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
              activeTab === 'post' ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Post-response
            {scripts.postResponse && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-success inline-block" />}
          </button>
        </div>

        <button
          onClick={testScript}
          disabled={running || !currentScript.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
        >
          <Play size={11} />
          Test
        </button>
      </div>

      {!currentScript && (
        <div className="space-y-2">
          <p className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Templates</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(templates).map(([name, code]) => (
              <button
                key={name}
                onClick={() => updateScript(code)}
                className="px-2.5 py-1.5 text-[10px] rounded-lg bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary hover:border-border-light transition-colors"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg overflow-hidden border border-border">
        <CodeMirror
          value={currentScript}
          onChange={updateScript}
          extensions={[javascript()]}
          height="180px"
          theme="dark"
          placeholder={activeTab === 'pre'
            ? '// Runs before the request is sent\n// Use rk.variables.set(key, value) to set variables'
            : '// Runs after the response is received\n// Use rk.test(name, fn) to add test assertions\n// Use response.json() to parse the response body'
          }
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            autocompletion: false,
          }}
        />
      </div>

      <div className="text-[10px] text-text-muted space-y-0.5">
        <p><code className="text-accent/70 bg-accent/8 px-1 rounded">rk.variables.set(key, value)</code> / <code className="text-accent/70 bg-accent/8 px-1 rounded">.get(key)</code> — manage variables</p>
        <p><code className="text-accent/70 bg-accent/8 px-1 rounded">rk.test(name, fn)</code> / <code className="text-accent/70 bg-accent/8 px-1 rounded">rk.expect(val).toBe(expected)</code> — assertions</p>
        {activeTab === 'post' && (
          <p><code className="text-accent/70 bg-accent/8 px-1 rounded">response.json()</code> / <code className="text-accent/70 bg-accent/8 px-1 rounded">response.status</code> / <code className="text-accent/70 bg-accent/8 px-1 rounded">response.headers</code> — response data</p>
        )}
      </div>

      {(lastResults.length > 0 || lastLogs.length > 0 || lastError) && (
        <div className="space-y-2 border-t border-border pt-2">
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
            <div className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border">
              <p className="text-[9px] text-text-muted uppercase tracking-wider font-medium mb-1">Console</p>
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
