import { useState, useRef, useCallback } from 'react';
import { useCollectionStore } from '../../stores/collectionStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import {
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { METHOD_COLORS } from '@shared/constants';
import type {
  ApiRequest,
  ApiResponse,
  AuthConfig,
  CollectionRunEntry,
  CollectionRunResult,
  HttpMethod,
} from '@shared/types';

declare global {
  interface Window {
    ruke: {
      sendRequest: (req: any) => Promise<ApiResponse>;
      scripting: {
        run: (script: string, context: any, phase: 'pre-request' | 'post-response') => Promise<{
          variables: Record<string, string>;
          testResults: { name: string; passed: boolean; error?: string; duration?: number }[];
          logs?: string[];
          error?: string;
        }>;
      };
    };
  }
}

interface Props {
  collectionId: string;
}

function getResolvedUrl(
  req: ApiRequest,
  getConnection: (id: string) => { id: string; baseUrl: string } | undefined,
  resolveString: (str: string) => string,
  resolvedVariables: Record<string, string>
): string {
  let resolved = req.url;
  if (req.connectionId) {
    const conn = getConnection(req.connectionId);
    if (conn) {
      const base = resolveString(conn.baseUrl).replace(/\/+$/, '');
      const path = req.url.startsWith('/') ? req.url : `/${req.url}`;
      resolved = req.url.startsWith('http') ? req.url : `${base}${path}`;
    }
  }
  for (const p of req.params) {
    if (p.enabled && p.key && p.value && resolved.includes(`{${p.key}}`)) {
      const val = p.value.replace(/\{\{([^}]+)\}\}/g, (_, key) =>
        resolvedVariables[key.trim()] ?? `{{${key}}}`
      );
      resolved = resolved.replace(`{${p.key}}`, encodeURIComponent(val));
    }
  }
  return resolved;
}

function getEffectiveAuth(
  req: ApiRequest,
  getConnection: (id: string) => { auth: AuthConfig } | undefined
): AuthConfig {
  if (req.auth.type !== 'none') return req.auth;
  if (req.connectionId) {
    const conn = getConnection(req.connectionId);
    if (conn && conn.auth?.type !== 'none') return conn.auth;
  }
  return req.auth;
}

function flattenRequests(
  collectionId: string,
  collections: { id: string; parentId: string | null; sortOrder: number }[],
  requestsMap: Record<string, ApiRequest[]>
): ApiRequest[] {
  const out: ApiRequest[] = [];
  const children = collections
    .filter((c) => c.parentId === collectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const directReqs = (requestsMap[collectionId] || []).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  for (const req of directReqs) {
    if (!req.archived) out.push(req);
  }
  for (const child of children) {
    out.push(...flattenRequests(child.id, collections, requestsMap));
  }
  return out;
}

export function CollectionRunner({ collectionId }: Props) {
  const collections = useCollectionStore((s) => s.collections);
  const requestsMap = useCollectionStore((s) => s.requests);
  const loadRequests = useCollectionStore((s) => s.loadRequests);
  const getConnection = useConnectionStore((s) => s.getConnection);
  const resolveVariables = useEnvironmentStore((s) => s.resolveVariables);
  const resolveString = useEnvironmentStore((s) => s.resolveString);

  const [running, setRunning] = useState(false);
  const [aborted, setAborted] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<CollectionRunResult | null>(null);
  const abortRef = useRef(false);

  const collection = collections.find((c) => c.id === collectionId);
  const requests = flattenRequests(collectionId, collections, requestsMap);

  const runCollection = useCallback(async () => {
    if (!collection || requests.length === 0) return;
    setRunning(true);
    setAborted(false);
    abortRef.current = false;
    setResult(null);
    setProgress({ current: 0, total: requests.length });

    const startedAt = new Date().toISOString();
    let runVariables: Record<string, string> = { ...resolveVariables() };
    const results: CollectionRunEntry[] = [];

    for (let i = 0; i < requests.length; i++) {
      if (abortRef.current) {
        setAborted(true);
        break;
      }

      const req = requests[i];
      setProgress({ current: i + 1, total: requests.length });

      const resolvedUrl = getResolvedUrl(
        req,
        getConnection,
        resolveString,
        runVariables
      );
      const effectiveAuth = getEffectiveAuth(req, getConnection);

      let sendPayload = {
        ...req,
        url: resolvedUrl,
        auth: effectiveAuth,
        resolvedVariables: runVariables,
      };

      let entry: CollectionRunEntry = {
        requestId: req.id,
        requestName: req.name,
        method: req.method as HttpMethod,
        url: resolvedUrl,
        status: 0,
        statusText: '',
        duration: 0,
        testResults: [],
        passed: false,
      };

      if (req.scripts?.preRequest) {
        const preResult = await window.ruke.scripting.run(
          req.scripts.preRequest,
          {
            request: {
              method: req.method,
              url: resolvedUrl,
              headers: Object.fromEntries(
                req.headers.filter((h) => h.enabled).map((h) => [h.key, h.value])
              ),
              body: req.body.raw,
            },
            variables: runVariables,
            testResults: [],
          },
          'pre-request'
        );
        if (preResult.variables) {
          runVariables = { ...runVariables, ...preResult.variables };
        }
        sendPayload = { ...sendPayload, resolvedVariables: runVariables };
      }

      try {
        const response = await window.ruke.sendRequest(sendPayload);
        entry.status = response.status;
        entry.statusText = response.statusText;
        entry.duration = response.duration;

        let testResults = entry.testResults;
        if (req.scripts?.postResponse) {
          const scriptResult = await window.ruke.scripting.run(
            req.scripts.postResponse,
            {
              request: {
                method: req.method,
                url: resolvedUrl,
                headers: Object.fromEntries(
                  req.headers.filter((h) => h.enabled).map((h) => [h.key, h.value])
                ),
                body: req.body.raw,
              },
              response: {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                body: response.body,
                duration: response.duration,
              },
              variables: runVariables,
              testResults: [],
            },
            'post-response'
          );
          if (scriptResult.variables) {
            runVariables = { ...runVariables, ...scriptResult.variables };
          }
          testResults = scriptResult.testResults || [];
          if (scriptResult.error) {
            entry.error = scriptResult.error;
          }
        }

        entry.testResults = testResults;
        const allPassed = entry.testResults.every((t) => t.passed);
        const okStatus = response.status >= 200 && response.status < 300;
        entry.passed = okStatus && allPassed && !entry.error;
      } catch (err: any) {
        entry.status = 0;
        entry.statusText = 'Request failed';
        entry.error = err?.message || String(err);
        entry.passed = false;
      }

      results.push(entry);
    }

    const completedAt = new Date().toISOString();
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    setResult({
      collectionId,
      collectionName: collection.name,
      startedAt,
      completedAt,
      duration,
      total: results.length,
      passed,
      failed,
      skipped: 0,
      results,
    });
    setRunning(false);
    setProgress({ current: 0, total: 0 });
  }, [
    collection,
    collectionId,
    requests,
    getConnection,
    resolveVariables,
    resolveString,
  ]);

  const handleAbort = useCallback(() => {
    abortRef.current = true;
  }, []);

  useEffect(() => {
    loadRequests(collectionId);
  }, [collectionId, loadRequests]);

  if (!collection) {
    return (
      <div className="p-4 text-center text-text-muted text-sm">
        Collection not found
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-bg-primary">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            {collection.name}
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            {requests.length} request{requests.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <button
              onClick={handleAbort}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-error/15 text-error hover:bg-error/25 transition-colors text-sm font-medium"
            >
              <Square size={14} />
              Abort
            </button>
          ) : (
            <button
              onClick={runCollection}
              disabled={requests.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              <Play size={14} />
              Run Collection
            </button>
          )}
        </div>
      </div>

      {running && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              Running request {progress.current} of {progress.total}
            </span>
          </div>
          <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-200"
              style={{
                width: progress.total
                  ? `${(progress.current / progress.total) * 100}%`
                  : '0%',
              }}
            />
          </div>
        </div>
      )}

      {aborted && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-sm">
          <Square size={14} />
          Run aborted
        </div>
      )}

      {result && !running && (
        <>
          <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-bg-secondary border border-border">
            <span className="flex items-center gap-1.5 text-text-primary">
              <Clock size={14} />
              {result.duration}ms
            </span>
            <span className="flex items-center gap-1.5 text-text-primary">
              Total: {result.total}
            </span>
            <span className="flex items-center gap-1.5 text-success">
              <CheckCircle2 size={14} />
              {result.passed}
            </span>
            <span className="flex items-center gap-1.5 text-error">
              <XCircle size={14} />
              {result.failed}
            </span>
          </div>

          <div className="space-y-1.5">
            {result.results.map((entry) => (
              <div
                key={entry.requestId}
                className="rounded-lg border border-border bg-bg-secondary overflow-hidden"
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  <span
                    className="font-mono font-bold text-[10px] w-10 shrink-0"
                    style={{
                      color: METHOD_COLORS[entry.method] || '#6b7280',
                    }}
                  >
                    {entry.method}
                  </span>
                  <span className="text-sm text-text-primary truncate flex-1">
                    {entry.requestName}
                  </span>
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      entry.passed ? 'text-success' : 'text-error'
                    }`}
                  >
                    {entry.passed ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <XCircle size={14} />
                    )}
                    {entry.status} {entry.statusText}
                  </span>
                  <span className="text-xs text-text-muted">
                    {entry.duration}ms
                  </span>
                </div>
                {entry.testResults.length > 0 && (
                  <div className="px-3 pb-3 space-y-1">
                    {entry.testResults.map((t, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-xs ${
                          t.passed ? 'text-success' : 'text-error'
                        }`}
                      >
                        {t.passed ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <XCircle size={12} />
                        )}
                        {t.name}
                        {t.error && (
                          <span className="text-error/80">— {t.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {entry.error && (
                  <div className="px-3 pb-3">
                    <p className="text-xs text-error">{entry.error}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!result && !running && requests.length === 0 && (
        <div className="py-8 text-center text-text-muted text-sm">
          No requests in this collection. Add requests to run.
        </div>
      )}
    </div>
  );
}
