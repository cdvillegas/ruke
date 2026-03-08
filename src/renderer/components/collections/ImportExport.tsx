import { useState } from 'react';
import { useCollectionStore } from '../../stores/collectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { nanoid } from 'nanoid';
import { FileDown, FileUp, Loader2, Check, AlertCircle } from 'lucide-react';
import type { ApiRequest, Collection, Environment, EnvVariable, RukeExport, HttpMethod } from '@shared/types';
import { APP_VERSION } from '@shared/constants';

export function ImportExport() {
  const [status, setStatus] = useState<'idle' | 'importing' | 'exporting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const collections = useCollectionStore((s) => s.collections);
  const createCollection = useCollectionStore((s) => s.createCollection);
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const saveRequest = useRequestStore((s) => s.saveRequest);

  const handleExport = async () => {
    setStatus('exporting');
    try {
      const colStore = useCollectionStore.getState();
      const reqStore = useRequestStore.getState();
      const envStore = useEnvironmentStore.getState();

      const allCollections = colStore.collections;
      const allRequests: ApiRequest[] = [
        ...reqStore.uncollectedRequests,
        ...reqStore.archivedRequests,
      ];
      for (const col of allCollections) {
        const colReqs = colStore.requests[col.id] || [];
        for (const r of colReqs) {
          if (!allRequests.find((ar) => ar.id === r.id)) {
            allRequests.push(r);
          }
        }
      }

      const allEnvironments = envStore.environments;
      const allVariables: EnvVariable[] = [];
      for (const env of allEnvironments) {
        const vars = envStore.getEnvironmentVariables(env.id);
        allVariables.push(...vars);
      }

      const data: RukeExport = {
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        collections: allCollections,
        requests: allRequests,
        environments: allEnvironments,
        variables: allVariables,
      };
      const result = await window.ruke.file.export(JSON.stringify(data, null, 2));
      if (result.success) {
        setStatus('success');
        setMessage(`Exported ${allRequests.length} requests, ${allCollections.length} collections`);
      } else {
        setStatus('idle');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
    }
    setTimeout(() => setStatus('idle'), 3000);
  };

  const handleImport = async () => {
    setStatus('importing');
    try {
      const result = await window.ruke.file.import();
      if (result.success) {
        const content = JSON.parse(result.content);

        if (content.info && content.item) {
          await importPostmanCollection(content);
        } else if (content.version && content.collections) {
          await importRukeFile(content);
        } else {
          throw new Error('Unrecognized file format');
        }

        setStatus('success');
        setMessage('Import successful');
        useCollectionStore.getState().loadCollections();
      } else {
        setStatus('idle');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Import failed');
    }
    setTimeout(() => setStatus('idle'), 3000);
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleImport}
        disabled={status === 'importing'}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-bg-tertiary border border-border hover:bg-bg-hover text-text-primary text-xs font-medium transition-colors disabled:opacity-50"
      >
        {status === 'importing' ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FileDown size={14} />
        )}
        <span>Import Collection</span>
      </button>

      <button
        onClick={handleExport}
        disabled={status === 'exporting'}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-bg-tertiary border border-border hover:bg-bg-hover text-text-primary text-xs font-medium transition-colors disabled:opacity-50"
      >
        {status === 'exporting' ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FileUp size={14} />
        )}
        <span>Export Collection</span>
      </button>

      {status === 'success' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/30 text-success text-xs animate-fade-in">
          <Check size={14} />
          <span>{message}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-error/10 border border-error/30 text-error text-xs animate-fade-in">
          <AlertCircle size={14} />
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}

async function importPostmanCollection(data: any) {
  const wsId = useCollectionStore.getState().activeWorkspaceId;
  if (!wsId) return;

  const collectionName = data.info?.name || 'Imported Collection';
  const collection = await useCollectionStore.getState().createCollection(collectionName);

  if (data.item) {
    for (const item of data.item) {
      await importPostmanItem(item, collection.id);
    }
  }
}

async function importPostmanItem(item: any, collectionId: string) {
  if (item.item) {
    for (const child of item.item) {
      await importPostmanItem(child, collectionId);
    }
    return;
  }

  if (item.request) {
    const req = item.request;
    const method = (typeof req.method === 'string' ? req.method : 'GET') as HttpMethod;
    let url = '';
    if (typeof req.url === 'string') {
      url = req.url;
    } else if (req.url?.raw) {
      url = req.url.raw;
    }

    const headers = (req.header || []).map((h: any) => ({
      key: h.key || '',
      value: h.value || '',
      enabled: !h.disabled,
    }));

    const request: ApiRequest = {
      id: nanoid(),
      collectionId,
      name: item.name || url,
      method,
      url,
      headers,
      params: [],
      body: { type: 'none' },
      auth: { type: 'none' },
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (req.body) {
      if (req.body.mode === 'raw') {
        request.body = {
          type: req.body.options?.raw?.language === 'json' ? 'json' : 'raw',
          raw: req.body.raw || '',
        };
      }
    }

    await window.ruke.db.query('createRequest', request);
  }
}

async function importRukeFile(data: RukeExport) {
  const wsId = useCollectionStore.getState().activeWorkspaceId;
  if (!wsId) return;

  const idMap = new Map<string, string>();

  if (data.collections?.length) {
    const sorted = [...data.collections].sort((a, b) => {
      const aDepth = a.parentId ? 1 : 0;
      const bDepth = b.parentId ? 1 : 0;
      return aDepth - bDepth;
    });
    for (const col of sorted) {
      const newId = nanoid();
      idMap.set(col.id, newId);
      const parentId = col.parentId ? (idMap.get(col.parentId) || null) : null;
      await window.ruke.db.query('createCollection', newId, wsId, col.name, parentId, col.sortOrder || 0);
    }
  }

  if (data.requests?.length) {
    for (const req of data.requests) {
      const newReq: ApiRequest = {
        ...req,
        id: nanoid(),
        collectionId: req.collectionId ? (idMap.get(req.collectionId) || null) : null,
      };
      await window.ruke.db.query('createRequest', newReq);
    }
  }

  if (data.environments?.length) {
    const envStore = useEnvironmentStore.getState();
    for (const env of data.environments) {
      const newEnvId = nanoid();
      idMap.set(env.id, newEnvId);
      await window.ruke.db.query('createEnvironment', newEnvId, wsId, env.name, env.sortOrder || 0, env.connectionId, env.baseUrl);

      const envVars = (data.variables || []).filter((v) => v.environmentId === env.id);
      for (const v of envVars) {
        const newVar: EnvVariable = {
          ...v,
          id: nanoid(),
          environmentId: newEnvId,
        };
        await window.ruke.db.query('createVariable', newVar);
      }
    }
    await envStore.loadEnvironments(wsId);
  }
}
