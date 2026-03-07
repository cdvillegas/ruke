import { useState } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { useUiStore } from '../../stores/uiStore';
import {
  Plug, Plus, Trash2, Globe, ChevronRight, ChevronDown,
  Upload, Link, Search, Play, ExternalLink, Edit3,
} from 'lucide-react';
import { METHOD_COLORS } from '@shared/constants';
import type { ApiConnection, ApiEndpoint, HttpMethod } from '@shared/types';

export function ConnectionsView() {
  const { connections, activeConnectionId, setActiveConnection, deleteConnection, importOpenApiSpec, addConnection } = useConnectionStore();
  const [showAdd, setShowAdd] = useState(false);
  const [specInput, setSpecInput] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeConn = connections.find(c => c.id === activeConnectionId);

  const handleImportSpec = async () => {
    if (!specInput.trim()) return;
    setLoading(true);

    if (specInput.trim().startsWith('{') || specInput.trim().startsWith('openapi')) {
      importOpenApiSpec(specInput.trim());
    } else {
      try {
        const res = await fetch(specInput.trim());
        const text = await res.text();
        importOpenApiSpec(text, specInput.trim());
      } catch (e) {
        console.error('Failed to fetch spec:', e);
      }
    }
    setSpecInput('');
    setLoading(false);
    setShowAdd(false);
  };

  const handleAddManual = () => {
    if (!manualName.trim() || !manualUrl.trim()) return;
    addConnection({ name: manualName.trim(), baseUrl: manualUrl.trim(), specType: 'manual' });
    setManualName('');
    setManualUrl('');
    setShowAdd(false);
  };

  const handleFileImport = async () => {
    const result = await window.ruke.file.import([
      { name: 'API Specs', extensions: ['json', 'yaml', 'yml'] },
    ]);
    if (result.success && result.content) {
      importOpenApiSpec(result.content, result.path);
      setShowAdd(false);
    }
  };

  const handleRunEndpoint = (conn: ApiConnection, endpoint: ApiEndpoint) => {
    const url = conn.baseUrl + endpoint.path;
    const store = useRequestStore.getState();
    store.updateActiveRequest({
      method: endpoint.method,
      url,
      name: endpoint.summary || `${endpoint.method} ${endpoint.path}`,
      headers: [{ key: '', value: '', enabled: true }],
      params: (endpoint.parameters || [])
        .filter(p => p.in === 'query')
        .map(p => ({ key: p.name, value: '', enabled: true })),
      body: endpoint.requestBody
        ? { type: endpoint.requestBody.type, raw: endpoint.requestBody.example || endpoint.requestBody.schema || '' }
        : { type: 'none' },
      auth: conn.auth,
    });
    useUiStore.getState().setActiveView('request');
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Connection List */}
      <div className="w-64 border-r border-border bg-bg-secondary flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Plug size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">APIs</h2>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {connections.map((conn) => (
            <button
              key={conn.id}
              onClick={() => setActiveConnection(conn.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left group ${
                conn.id === activeConnectionId
                  ? 'bg-bg-active'
                  : 'hover:bg-bg-hover'
              }`}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-white text-[10px] font-bold"
                style={{ background: conn.iconColor }}
              >
                {conn.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{conn.name}</p>
                <p className="text-[9px] text-text-muted font-mono truncate">{conn.baseUrl}</p>
              </div>
              <span className="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                {conn.endpoints.length}
              </span>
            </button>
          ))}

          {connections.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Globe size={20} className="mx-auto text-text-muted opacity-30 mb-2" />
              <p className="text-[10px] text-text-muted">No APIs connected</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 overflow-y-auto">
        {showAdd ? (
          <AddConnectionPanel
            specInput={specInput}
            setSpecInput={setSpecInput}
            manualName={manualName}
            setManualName={setManualName}
            manualUrl={manualUrl}
            setManualUrl={setManualUrl}
            loading={loading}
            onImportSpec={handleImportSpec}
            onAddManual={handleAddManual}
            onFileImport={handleFileImport}
            onClose={() => setShowAdd(false)}
          />
        ) : activeConn ? (
          <ConnectionDetail
            conn={activeConn}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onRunEndpoint={handleRunEndpoint}
            onDelete={() => deleteConnection(activeConn.id)}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Plug size={32} className="mx-auto text-text-muted opacity-20 mb-4" />
              <p className="text-sm text-text-muted mb-2">Connect an API to get started</p>
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs rounded-xl bg-accent hover:bg-accent-hover text-white transition-colors"
              >
                <Plus size={14} /> Add API Connection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddConnectionPanel({ specInput, setSpecInput, manualName, setManualName, manualUrl, setManualUrl, loading, onImportSpec, onAddManual, onFileImport, onClose }: any) {
  const [tab, setTab] = useState<'spec' | 'manual'>('spec');

  return (
    <div className="max-w-lg mx-auto p-8">
      <h2 className="text-lg font-semibold text-text-primary mb-6">Connect an API</h2>

      <div className="flex gap-1 mb-6 p-1 bg-bg-tertiary rounded-xl">
        <button
          onClick={() => setTab('spec')}
          className={`flex-1 px-4 py-2 text-xs rounded-lg font-medium transition-colors ${
            tab === 'spec' ? 'bg-bg-secondary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
          }`}
        >
          From Spec / URL
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`flex-1 px-4 py-2 text-xs rounded-lg font-medium transition-colors ${
            tab === 'manual' ? 'bg-bg-secondary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Manual
        </button>
      </div>

      {tab === 'spec' ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-text-secondary font-medium block mb-1.5">Spec URL or paste JSON</label>
            <textarea
              value={specInput}
              onChange={(e) => setSpecInput(e.target.value)}
              placeholder="https://api.example.com/openapi.json or paste spec here..."
              rows={4}
              className="w-full px-4 py-3 text-xs font-mono rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none transition-colors"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onImportSpec}
              disabled={loading || !specInput.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs rounded-xl bg-accent hover:bg-accent-hover text-white disabled:opacity-50 transition-colors"
            >
              <Link size={14} /> Import
            </button>
            <button
              onClick={onFileImport}
              className="flex items-center gap-2 px-4 py-2.5 text-xs rounded-xl bg-bg-tertiary border border-border hover:bg-bg-hover text-text-primary transition-colors"
            >
              <Upload size={14} /> Browse File
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-text-secondary font-medium block mb-1.5">API Name</label>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="My API"
              className="w-full px-4 py-2.5 text-xs rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary font-medium block mb-1.5">Base URL</label>
            <input
              type="text"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="https://api.example.com"
              className="w-full px-4 py-2.5 text-xs font-mono rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <button
            onClick={onAddManual}
            disabled={!manualName.trim() || !manualUrl.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs rounded-xl bg-accent hover:bg-accent-hover text-white disabled:opacity-50 transition-colors"
          >
            <Plus size={14} /> Connect
          </button>
        </div>
      )}

      <button
        onClick={onClose}
        className="mt-4 text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

function ConnectionDetail({ conn, searchQuery, setSearchQuery, onRunEndpoint, onDelete }: {
  conn: ApiConnection;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onRunEndpoint: (conn: ApiConnection, ep: ApiEndpoint) => void;
  onDelete: () => void;
}) {
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set(['all']));

  const filtered = searchQuery
    ? conn.endpoints.filter(ep =>
        ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.method.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conn.endpoints;

  const tags = Array.from(new Set(filtered.flatMap(ep => ep.tags || ['Other']))).sort();
  const byTag = tags.length > 0
    ? tags.map(tag => ({
        tag,
        endpoints: filtered.filter(ep => (ep.tags || ['Other']).includes(tag)),
      }))
    : [{ tag: 'Endpoints', endpoints: filtered }];

  const toggleTag = (tag: string) => {
    const next = new Set(expandedTags);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    setExpandedTags(next);
  };

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
            style={{ background: conn.iconColor }}
          >
            {conn.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{conn.name}</h2>
            <p className="text-xs text-text-muted font-mono">{conn.baseUrl}</p>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors"
          title="Remove connection"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {conn.description && (
        <p className="text-xs text-text-secondary mb-6 leading-relaxed">{conn.description}</p>
      )}

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search endpoints..."
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="space-y-2">
        {byTag.map(({ tag, endpoints }) => (
          <div key={tag} className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => toggleTag(tag)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-bg-secondary hover:bg-bg-tertiary transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                {expandedTags.has(tag) ? <ChevronDown size={13} className="text-text-muted" /> : <ChevronRight size={13} className="text-text-muted" />}
                <span className="text-xs font-semibold text-text-primary">{tag}</span>
              </div>
              <span className="text-[10px] text-text-muted">{endpoints.length}</span>
            </button>
            {expandedTags.has(tag) && (
              <div>
                {endpoints.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => onRunEndpoint(conn, ep)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 border-t border-border hover:bg-bg-hover transition-colors group text-left"
                  >
                    <span
                      className="font-mono font-bold text-[10px] w-14 text-left shrink-0"
                      style={{ color: METHOD_COLORS[ep.method] || '#6b7280' }}
                    >
                      {ep.method}
                    </span>
                    <span className="text-xs font-mono text-text-secondary flex-1 truncate">{ep.path}</span>
                    <span className="text-[10px] text-text-muted truncate max-w-[200px] hidden sm:block">{ep.summary}</span>
                    <Play size={12} className="text-text-muted opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-text-muted">
              {searchQuery ? 'No matching endpoints' : 'No endpoints defined. Add them manually or import a spec.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
