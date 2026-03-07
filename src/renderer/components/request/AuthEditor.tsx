import { useRequestStore } from '../../stores/requestStore';
import type { AuthType } from '@shared/types';
import { Shield, Key, User, Lock } from 'lucide-react';

const AUTH_TYPES: { id: AuthType; label: string; icon: typeof Shield }[] = [
  { id: 'none', label: 'No Auth', icon: Shield },
  { id: 'bearer', label: 'Bearer Token', icon: Key },
  { id: 'basic', label: 'Basic Auth', icon: User },
  { id: 'api-key', label: 'API Key', icon: Lock },
];

export function AuthEditor() {
  const { activeRequest, setAuth } = useRequestStore();
  const auth = activeRequest.auth;

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {AUTH_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setAuth({ ...auth, type: t.id })}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
              auth.type === t.id
                ? 'bg-accent text-white'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            <t.icon size={13} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {auth.type === 'none' && (
        <p className="text-xs text-text-muted py-4 text-center">
          This request does not use authentication
        </p>
      )}

      {auth.type === 'bearer' && (
        <div className="space-y-2">
          <label className="text-xs text-text-secondary font-medium">Token</label>
          <input
            type="text"
            value={auth.bearer?.token || ''}
            onChange={(e) => setAuth({ ...auth, bearer: { token: e.target.value } })}
            placeholder="Enter bearer token or {{variable}}"
            className="w-full px-3 py-2 text-xs rounded-lg bg-bg-tertiary border border-border font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      )}

      {auth.type === 'basic' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-text-secondary font-medium">Username</label>
            <input
              type="text"
              value={auth.basic?.username || ''}
              onChange={(e) =>
                setAuth({
                  ...auth,
                  basic: { username: e.target.value, password: auth.basic?.password || '' },
                })
              }
              placeholder="Username"
              className="w-full px-3 py-2 text-xs rounded-lg bg-bg-tertiary border border-border font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-text-secondary font-medium">Password</label>
            <input
              type="password"
              value={auth.basic?.password || ''}
              onChange={(e) =>
                setAuth({
                  ...auth,
                  basic: { username: auth.basic?.username || '', password: e.target.value },
                })
              }
              placeholder="Password"
              className="w-full px-3 py-2 text-xs rounded-lg bg-bg-tertiary border border-border font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>
      )}

      {auth.type === 'api-key' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-text-secondary font-medium">Key</label>
            <input
              type="text"
              value={auth.apiKey?.key || ''}
              onChange={(e) =>
                setAuth({
                  ...auth,
                  apiKey: { key: e.target.value, value: auth.apiKey?.value || '', addTo: auth.apiKey?.addTo || 'header' },
                })
              }
              placeholder="e.g. X-API-Key"
              className="w-full px-3 py-2 text-xs rounded-lg bg-bg-tertiary border border-border font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-text-secondary font-medium">Value</label>
            <input
              type="text"
              value={auth.apiKey?.value || ''}
              onChange={(e) =>
                setAuth({
                  ...auth,
                  apiKey: { key: auth.apiKey?.key || '', value: e.target.value, addTo: auth.apiKey?.addTo || 'header' },
                })
              }
              placeholder="API key value"
              className="w-full px-3 py-2 text-xs rounded-lg bg-bg-tertiary border border-border font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-text-secondary font-medium">Add to</label>
            <div className="flex gap-2">
              {(['header', 'query'] as const).map((loc) => (
                <button
                  key={loc}
                  onClick={() =>
                    setAuth({
                      ...auth,
                      apiKey: { ...auth.apiKey!, addTo: loc },
                    })
                  }
                  className={`px-3 py-1.5 text-xs rounded-md capitalize transition-colors ${
                    auth.apiKey?.addTo === loc
                      ? 'bg-accent text-white'
                      : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
