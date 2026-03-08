import { useState } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import type { AuthType } from '@shared/types';
import { Shield, Key, User, Lock, Eye, EyeOff } from 'lucide-react';
import { VariableInput } from '../shared/VariableInput';

const AUTH_TYPES: { id: AuthType; label: string; icon: typeof Shield }[] = [
  { id: 'none', label: 'No Auth', icon: Shield },
  { id: 'bearer', label: 'Bearer Token', icon: Key },
  { id: 'basic', label: 'Basic Auth', icon: User },
  { id: 'api-key', label: 'API Key', icon: Lock },
];

const INPUT_CLASS =
  'w-full px-3 py-2.5 text-sm rounded-lg bg-bg-tertiary border border-border font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all';

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
  const auth = activeRequest.auth;
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showApiValue, setShowApiValue] = useState(false);

  return (
    <div className="space-y-4">
      {/* Auth type selector */}
      <div className="flex gap-1.5 flex-wrap">
        {AUTH_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setAuth({ ...auth, type: t.id })}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              auth.type === t.id
                ? 'bg-accent text-white shadow-sm shadow-accent/25'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-transparent hover:border-border'
            }`}
          >
            <t.icon size={13} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {auth.type === 'none' && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Shield size={20} className="text-text-muted/40 mb-2" />
          <p className="text-xs text-text-muted">
            This request does not use authentication
          </p>
        </div>
      )}

      {auth.type === 'bearer' && (
        <div>
          <FieldLabel>Token</FieldLabel>
          <div className="relative">
            <VariableInput
              value={auth.bearer?.token || ''}
              onChange={(v) => setAuth({ ...auth, bearer: { token: v } })}
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

      {auth.type === 'basic' && (
        <div className="space-y-4">
          <div>
            <FieldLabel>Username</FieldLabel>
            <VariableInput
              value={auth.basic?.username || ''}
              onChange={(v) =>
                setAuth({
                  ...auth,
                  basic: { username: v, password: auth.basic?.password || '' },
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
                value={auth.basic?.password || ''}
                onChange={(v) =>
                  setAuth({
                    ...auth,
                    basic: { username: auth.basic?.username || '', password: v },
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

      {auth.type === 'api-key' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Key Name</FieldLabel>
              <VariableInput
                value={auth.apiKey?.key || ''}
                onChange={(v) =>
                  setAuth({
                    ...auth,
                    apiKey: { key: v, value: auth.apiKey?.value || '', addTo: auth.apiKey?.addTo || 'header' },
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
                  value={auth.apiKey?.value || ''}
                  onChange={(v) =>
                    setAuth({
                      ...auth,
                      apiKey: { key: auth.apiKey?.key || '', value: v, addTo: auth.apiKey?.addTo || 'header' },
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
          </div>

          <div>
            <FieldLabel>Add to</FieldLabel>
            <div className="inline-flex rounded-lg bg-bg-tertiary border border-border p-0.5">
              {(['header', 'query'] as const).map((loc) => (
                <button
                  key={loc}
                  onClick={() =>
                    setAuth({
                      ...auth,
                      apiKey: { ...auth.apiKey!, addTo: loc },
                    })
                  }
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                    auth.apiKey?.addTo === loc
                      ? 'bg-bg-primary text-text-primary shadow-sm'
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
