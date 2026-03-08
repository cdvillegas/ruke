import { useState } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import type { AuthConfig, AuthType } from '@shared/types';
import { Shield, Key, User, Lock, Eye, EyeOff } from 'lucide-react';
import { VariableInput } from '../shared/VariableInput';

const AUTH_TYPES: { id: AuthType; label: string; icon: typeof Shield }[] = [
  { id: 'none', label: 'No Auth', icon: Shield },
  { id: 'bearer', label: 'Bearer Token', icon: Key },
  { id: 'basic', label: 'Basic Auth', icon: User },
  { id: 'api-key', label: 'API Key', icon: Lock },
];

const INPUT_CLASS =
  'w-full px-3 py-2 text-[11px] rounded-lg bg-bg-secondary border border-border/60 font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-border-light transition-colors';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-text-secondary mb-1.5">
      {children}
    </label>
  );
}

export function AuthEditor() {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const setAuth = useRequestStore((s) => s.setAuth);
  const requestAuth = activeRequest.auth;
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showApiValue, setShowApiValue] = useState(false);

  const displayType = requestAuth.type;

  const setType = (type: AuthType) => {
    setAuth({ ...requestAuth, type });
  };

  const updateAuth = (updates: Partial<AuthConfig>) => {
    setAuth({ ...requestAuth, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-0.5 p-0.5 rounded-lg bg-bg-secondary/60 w-fit">
        {AUTH_TYPES.map((t) => {
          const isActive = displayType === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 ${
                isActive
                  ? 'bg-bg-tertiary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <t.icon size={12} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {displayType === 'none' && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Shield size={20} className="text-text-muted/40 mb-2" />
          <p className="text-xs text-text-muted">
            This request does not use authentication
          </p>
        </div>
      )}

      {displayType === 'bearer' && (
        <div className="max-w-sm">
          <FieldLabel>Token</FieldLabel>
          <div className="relative">
            <VariableInput
              value={requestAuth.bearer?.token || ''}
              onChange={(v) => updateAuth({ type: 'bearer', bearer: { token: v } })}
              placeholder="Enter bearer token or {{variable}}"
              type={showToken ? 'text' : 'password'}
              className={INPUT_CLASS + ' pr-9'}
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
              tabIndex={-1}
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-text-muted mt-1.5">
            Sent as <code className="text-accent/70 bg-accent/8 px-1 rounded">Authorization: Bearer &lt;token&gt;</code>
          </p>
        </div>
      )}

      {displayType === 'basic' && (
        <div className="max-w-sm space-y-3">
          <div>
            <FieldLabel>Username</FieldLabel>
            <VariableInput
              value={requestAuth.basic?.username || ''}
              onChange={(v) =>
                updateAuth({
                  type: 'basic',
                  basic: { username: v, password: requestAuth.basic?.password || '' },
                })
              }
              placeholder="Username or {{variable}}"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <div className="relative">
              <VariableInput
                value={requestAuth.basic?.password || ''}
                onChange={(v) =>
                  updateAuth({
                    type: 'basic',
                    basic: { username: requestAuth.basic?.username || '', password: v },
                  })
                }
                placeholder="Password or {{variable}}"
                type={showPassword ? 'text' : 'password'}
                className={INPUT_CLASS + ' pr-9'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-text-muted">
            Sent as <code className="text-accent/70 bg-accent/8 px-1 rounded">Authorization: Basic base64(username:password)</code>
          </p>
        </div>
      )}

      {displayType === 'api-key' && (
        <div className="max-w-sm space-y-3">
          <div>
            <FieldLabel>Key Name</FieldLabel>
            <VariableInput
              value={requestAuth.apiKey?.key || ''}
              onChange={(v) =>
                updateAuth({
                  type: 'api-key',
                  apiKey: { key: v, value: requestAuth.apiKey?.value || '', addTo: requestAuth.apiKey?.addTo || 'header' },
                })
              }
              placeholder="e.g. X-API-Key"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <FieldLabel>Value</FieldLabel>
            <div className="relative">
              <VariableInput
                value={requestAuth.apiKey?.value || ''}
                onChange={(v) =>
                  updateAuth({
                    type: 'api-key',
                    apiKey: { key: requestAuth.apiKey?.key || '', value: v, addTo: requestAuth.apiKey?.addTo || 'header' },
                  })
                }
                placeholder="API key value or {{variable}}"
                type={showApiValue ? 'text' : 'password'}
                className={INPUT_CLASS + ' pr-9'}
              />
              <button
                type="button"
                onClick={() => setShowApiValue(!showApiValue)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                tabIndex={-1}
              >
                {showApiValue ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <FieldLabel>Add to</FieldLabel>
            <div className="inline-flex gap-0.5 p-0.5 rounded-md bg-bg-secondary/60">
              {(['header', 'query'] as const).map((loc) => (
                <button
                  key={loc}
                  onClick={() =>
                    updateAuth({
                      type: 'api-key',
                      apiKey: { ...requestAuth.apiKey!, addTo: loc },
                    })
                  }
                  className={`px-2 py-0.5 text-[10px] font-medium rounded capitalize transition-all duration-150 ${
                    requestAuth.apiKey?.addTo === loc
                      ? 'bg-bg-tertiary text-text-primary shadow-sm'
                      : 'text-text-muted hover:text-text-secondary'
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
