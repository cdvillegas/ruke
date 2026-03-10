import { useState } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import type { AuthConfig, AuthType, OAuth2Config } from '@shared/types';
import { Shield, Key, User, Lock, Eye, EyeOff, Plug } from 'lucide-react';
import { VariableInput } from '../shared/VariableInput';

const AUTH_TYPES: { id: AuthType; label: string; icon: typeof Shield }[] = [
  { id: 'none', label: 'No Auth', icon: Shield },
  { id: 'bearer', label: 'Bearer Token', icon: Key },
  { id: 'basic', label: 'Basic Auth', icon: User },
  { id: 'api-key', label: 'API Key', icon: Lock },
  { id: 'oauth2', label: 'OAuth 2.0', icon: Lock },
];

const GRANT_TYPES: { id: OAuth2Config['grantType']; label: string }[] = [
  { id: 'authorization_code', label: 'Authorization Code' },
  { id: 'client_credentials', label: 'Client Credentials' },
  { id: 'password', label: 'Password' },
  { id: 'implicit', label: 'Implicit' },
];

async function sha256(data: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-[11px] bg-transparent border-none font-mono text-text-primary placeholder:text-text-muted/30 focus:outline-none transition-colors';

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center border-b border-border/50 last:border-b-0 hover:bg-bg-hover/30 transition-colors">
      <div className="px-3 py-2 text-[10px] text-text-muted uppercase tracking-wider font-semibold border-r border-border/50 shrink-0">
        {label}
      </div>
      <div className="relative min-w-0">
        {children}
      </div>
    </div>
  );
}

export const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  none: 'No Auth',
  bearer: 'Bearer Token',
  basic: 'Basic Auth',
  'api-key': 'API Key',
  oauth2: 'OAuth 2.0',
};

interface AuthEditorCoreProps {
  auth: AuthConfig;
  onAuthChange: (auth: AuthConfig) => void;
  emptyState?: React.ReactNode;
  inheritedAuth?: { auth: AuthConfig; name: string };
}

function shouldReveal(value: string, manualShow: boolean): 'text' | 'password' {
  if (manualShow) return 'text';
  if (value.startsWith('{')) return 'text';
  return 'password';
}

export function AuthEditorCore({ auth, onAuthChange, emptyState, inheritedAuth }: AuthEditorCoreProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showApiValue, setShowApiValue] = useState(false);
  const [showOAuthToken, setShowOAuthToken] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const displayType = auth.type;

  const setType = (type: AuthType) => {
    if (type === 'oauth2' && !auth.oauth2) {
      onAuthChange({
        ...auth,
        type: 'oauth2',
        oauth2: {
          grantType: 'authorization_code',
          clientId: '',
          redirectUri: 'http://localhost/callback',
        },
      });
    } else {
      onAuthChange({ ...auth, type });
    }
  };

  const updateAuth = (updates: Partial<AuthConfig>) => {
    onAuthChange({ ...auth, ...updates });
  };

  const oauth2 = auth.oauth2;
  const updateOAuth2 = (updates: Partial<OAuth2Config>) => {
    onAuthChange({
      ...auth,
      type: 'oauth2',
      oauth2: { ...oauth2!, ...updates },
    });
  };

  const getOAuthToken = async () => {
    if (!oauth2) return;
    setOauthError(null);
    setOauthLoading(true);
    try {
      if (oauth2.grantType === 'authorization_code') {
        const authUrl = oauth2.authorizationUrl || '';
        const redirectUri = oauth2.redirectUri || 'http://localhost/callback';
        const params = new URLSearchParams();
        params.set('response_type', 'code');
        params.set('client_id', oauth2.clientId);
        params.set('redirect_uri', redirectUri);
        if (oauth2.scope) params.set('scope', oauth2.scope);
        if (oauth2.usePkce) {
          const verifier = generateCodeVerifier();
          const challenge = base64UrlEncode(await sha256(verifier));
          params.set('code_challenge', challenge);
          params.set('code_challenge_method', 'S256');
          updateOAuth2({ codeVerifier: verifier });
        }
        const fullAuthUrl = authUrl + (authUrl.includes('?') ? '&' : '?') + params.toString();
        const result = await window.ruke.oauth2.authorize(fullAuthUrl);
        if (result.error) throw new Error(result.error);
        if (!result.code) throw new Error('No authorization code received');
        const tokenUrl = oauth2.tokenUrl || '';
        const body = new URLSearchParams();
        body.set('grant_type', 'authorization_code');
        body.set('code', result.code);
        body.set('redirect_uri', redirectUri);
        body.set('client_id', oauth2.clientId);
        if (oauth2.clientSecret) body.set('client_secret', oauth2.clientSecret);
        if (oauth2.usePkce && oauth2.codeVerifier) body.set('code_verifier', oauth2.codeVerifier);
        const tokenRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        const data = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok) throw new Error(data.error_description || data.error || `HTTP ${tokenRes.status}`);
        const accessToken = data.access_token;
        const refreshToken = data.refresh_token;
        const expiresIn = data.expires_in;
        const tokenExpiry = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined;
        updateOAuth2({ accessToken, refreshToken, tokenExpiry, codeVerifier: undefined });
      } else if (oauth2.grantType === 'client_credentials') {
        const tokenUrl = oauth2.tokenUrl || '';
        const body = new URLSearchParams();
        body.set('grant_type', 'client_credentials');
        body.set('client_id', oauth2.clientId);
        if (oauth2.clientSecret) body.set('client_secret', oauth2.clientSecret);
        if (oauth2.scope) body.set('scope', oauth2.scope);
        const tokenRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        const data = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok) throw new Error(data.error_description || data.error || `HTTP ${tokenRes.status}`);
        const accessToken = data.access_token;
        const expiresIn = data.expires_in;
        const tokenExpiry = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined;
        updateOAuth2({ accessToken, tokenExpiry });
      } else if (oauth2.grantType === 'password') {
        const tokenUrl = oauth2.tokenUrl || '';
        const body = new URLSearchParams();
        body.set('grant_type', 'password');
        body.set('client_id', oauth2.clientId);
        body.set('username', oauth2.username || '');
        body.set('password', oauth2.password || '');
        if (oauth2.clientSecret) body.set('client_secret', oauth2.clientSecret);
        if (oauth2.scope) body.set('scope', oauth2.scope);
        const tokenRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        const data = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok) throw new Error(data.error_description || data.error || `HTTP ${tokenRes.status}`);
        const accessToken = data.access_token;
        const refreshToken = data.refresh_token;
        const expiresIn = data.expires_in;
        const tokenExpiry = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined;
        updateOAuth2({ accessToken, refreshToken, tokenExpiry });
      } else if (oauth2.grantType === 'implicit') {
        const authUrl = oauth2.authorizationUrl || '';
        const redirectUri = oauth2.redirectUri || 'http://localhost/callback';
        const params = new URLSearchParams();
        params.set('response_type', 'token');
        params.set('client_id', oauth2.clientId);
        params.set('redirect_uri', redirectUri);
        if (oauth2.scope) params.set('scope', oauth2.scope);
        const fullAuthUrl = authUrl + (authUrl.includes('?') ? '&' : '?') + params.toString();
        const result = await window.ruke.oauth2.authorize(fullAuthUrl);
        if (result.error) throw new Error(result.error);
        const hash = new URL(result.redirectUrl || '').hash.slice(1);
        const fragmentParams = new URLSearchParams(hash);
        const accessToken = fragmentParams.get('access_token');
        const expiresIn = fragmentParams.get('expires_in');
        if (!accessToken) throw new Error('No access token in redirect');
        const tokenExpiry = expiresIn ? new Date(Date.now() + parseInt(expiresIn, 10) * 1000).toISOString() : undefined;
        updateOAuth2({ accessToken, tokenExpiry });
      }
    } catch (err: unknown) {
      setOauthError(err instanceof Error ? err.message : String(err));
    } finally {
      setOauthLoading(false);
    }
  };

  const isInheritMode = !!inheritedAuth && displayType === 'none';
  const inheritedType = inheritedAuth?.auth.type;

  return (
    <div className="space-y-4">
      <div className="flex gap-0.5 p-0.5 rounded-lg bg-bg-secondary/60 w-fit flex-wrap">
        {inheritedAuth && (
          <button
            onClick={() => setType('none')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 ${
              isInheritMode
                ? 'bg-bg-tertiary text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Plug size={12} />
            <span>Inherit from API</span>
          </button>
        )}
        {AUTH_TYPES.filter(t => !inheritedAuth || t.id !== 'none').map((t) => {
          const isActive = !isInheritMode && displayType === t.id;
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

      {isInheritMode && inheritedAuth && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/5 border border-accent/10">
          <Plug size={13} className="text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-text-secondary">
              Inherits <span className="font-medium text-accent/80">{AUTH_TYPE_LABELS[inheritedType!]}</span> from{' '}
              <span className="font-medium text-text-primary">{inheritedAuth.name}</span>
            </p>
            {inheritedType === 'bearer' && inheritedAuth.auth.bearer?.token && (
              <p className="text-[10px] text-text-muted font-mono mt-0.5 truncate">
                Token: {inheritedAuth.auth.bearer.token.startsWith('{') ? inheritedAuth.auth.bearer.token : '••••••••'}
              </p>
            )}
            {inheritedType === 'basic' && (
              <p className="text-[10px] text-text-muted font-mono mt-0.5">
                {inheritedAuth.auth.basic?.username
                  ? (inheritedAuth.auth.basic.username.startsWith('{') ? inheritedAuth.auth.basic.username : '••••••••')
                  : '(no username)'}
              </p>
            )}
            {inheritedType === 'api-key' && inheritedAuth.auth.apiKey && (
              <p className="text-[10px] text-text-muted font-mono mt-0.5">
                {inheritedAuth.auth.apiKey.key || '(no key name)'} via {inheritedAuth.auth.apiKey.addTo}
              </p>
            )}
            {inheritedType === 'oauth2' && (
              <p className="text-[10px] text-text-muted mt-0.5">
                {inheritedAuth.auth.oauth2?.grantType?.replace('_', ' ') || 'OAuth 2.0'}
              </p>
            )}
          </div>
        </div>
      )}

      {displayType === 'none' && !isInheritMode && (
        emptyState || (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Shield size={20} className="text-text-muted/40 mb-2" />
            <p className="text-xs text-text-muted">
              No authentication configured
            </p>
          </div>
        )
      )}

      {displayType === 'bearer' && (
        <div className="rounded-lg border border-border/60 overflow-hidden bg-bg-secondary">
          <div className="px-3 py-1.5 border-b border-border bg-bg-tertiary/50">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Bearer Token</span>
          </div>
          <FieldRow label="Token">
            <div className="flex items-center">
              <VariableInput
                value={auth.bearer?.token || ''}
                onChange={(v) => updateAuth({ type: 'bearer', bearer: { token: v } })}
                placeholder="Enter token or {{variable}}"
                type={shouldReveal(auth.bearer?.token || '', showToken)}
                className={INPUT_CLASS + ' flex-1'}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="px-2.5 text-text-muted/40 hover:text-text-secondary transition-colors shrink-0"
                tabIndex={-1}
              >
                {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </FieldRow>
          <div className="px-3 py-2 bg-bg-tertiary/30 border-t border-border/30">
            <p className="text-[10px] text-text-muted">
              Sent as <code className="text-accent/70 bg-accent/8 px-1 rounded">Authorization: Bearer &lt;token&gt;</code>
            </p>
          </div>
        </div>
      )}

      {displayType === 'basic' && (
        <div className="rounded-lg border border-border/60 overflow-hidden bg-bg-secondary">
          <div className="px-3 py-1.5 border-b border-border bg-bg-tertiary/50">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Basic Auth</span>
          </div>
          <FieldRow label="Username">
            <VariableInput
              value={auth.basic?.username || ''}
              onChange={(v) =>
                updateAuth({ type: 'basic', basic: { username: v, password: auth.basic?.password || '' } })
              }
              placeholder="Username or {{variable}}"
              className={INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Password">
            <div className="flex items-center">
              <VariableInput
                value={auth.basic?.password || ''}
                onChange={(v) =>
                  updateAuth({ type: 'basic', basic: { username: auth.basic?.username || '', password: v } })
                }
                placeholder="Password or {{variable}}"
                type={shouldReveal(auth.basic?.password || '', showPassword)}
                className={INPUT_CLASS + ' flex-1'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="px-2.5 text-text-muted/40 hover:text-text-secondary transition-colors shrink-0"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </FieldRow>
          <div className="px-3 py-2 bg-bg-tertiary/30 border-t border-border/30">
            <p className="text-[10px] text-text-muted">
              Sent as <code className="text-accent/70 bg-accent/8 px-1 rounded">Authorization: Basic base64(username:password)</code>
            </p>
          </div>
        </div>
      )}

      {displayType === 'api-key' && (
        <div className="rounded-lg border border-border/60 overflow-hidden bg-bg-secondary">
          <div className="px-3 py-1.5 border-b border-border bg-bg-tertiary/50">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">API Key</span>
          </div>
          <FieldRow label="Key Name">
            <VariableInput
              value={auth.apiKey?.key || ''}
              onChange={(v) =>
                updateAuth({ type: 'api-key', apiKey: { key: v, value: auth.apiKey?.value || '', addTo: auth.apiKey?.addTo || 'header' } })
              }
              placeholder="e.g. X-API-Key"
              className={INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Value">
            <div className="flex items-center">
              <VariableInput
                value={auth.apiKey?.value || ''}
                onChange={(v) =>
                  updateAuth({ type: 'api-key', apiKey: { key: auth.apiKey?.key || '', value: v, addTo: auth.apiKey?.addTo || 'header' } })
                }
                placeholder="API key value or {{variable}}"
                type={shouldReveal(auth.apiKey?.value || '', showApiValue)}
                className={INPUT_CLASS + ' flex-1'}
              />
              <button
                type="button"
                onClick={() => setShowApiValue(!showApiValue)}
                className="px-2.5 text-text-muted/40 hover:text-text-secondary transition-colors shrink-0"
                tabIndex={-1}
              >
                {showApiValue ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </FieldRow>
          <FieldRow label="Add To">
            <div className="flex gap-0.5 p-1 pl-2">
              {(['header', 'query'] as const).map((loc) => (
                <button
                  key={loc}
                  onClick={() => updateAuth({ type: 'api-key', apiKey: { ...auth.apiKey!, addTo: loc } })}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded capitalize transition-all duration-150 ${
                    auth.apiKey?.addTo === loc
                      ? 'bg-bg-tertiary text-text-primary shadow-sm border border-border/60'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </FieldRow>
        </div>
      )}

      {displayType === 'oauth2' && oauth2 && (
        <div className="rounded-lg border border-border/60 overflow-hidden bg-bg-secondary">
          <div className="px-3 py-1.5 border-b border-border bg-bg-tertiary/50">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">OAuth 2.0</span>
          </div>

          <FieldRow label="Grant Type">
            <div className="flex flex-wrap gap-0.5 p-1 pl-2">
              {GRANT_TYPES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => updateOAuth2({ grantType: g.id })}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded capitalize transition-all duration-150 ${
                    oauth2.grantType === g.id
                      ? 'bg-bg-tertiary text-text-primary shadow-sm border border-border/60'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </FieldRow>

          <FieldRow label="Client ID">
            <VariableInput
              value={oauth2.clientId}
              onChange={(v) => updateOAuth2({ clientId: v })}
              placeholder="Client ID or {{variable}}"
              className={INPUT_CLASS}
            />
          </FieldRow>

          {(oauth2.grantType === 'authorization_code' ||
            oauth2.grantType === 'client_credentials' ||
            oauth2.grantType === 'password') && (
            <FieldRow label="Client Secret">
              <VariableInput
                value={oauth2.clientSecret || ''}
                onChange={(v) => updateOAuth2({ clientSecret: v })}
                placeholder="Client secret or {{variable}}"
                type={shouldReveal(oauth2.clientSecret || '', false)}
                className={INPUT_CLASS}
              />
            </FieldRow>
          )}

          {(oauth2.grantType === 'authorization_code' || oauth2.grantType === 'implicit') && (
            <>
              <FieldRow label="Auth URL">
                <VariableInput
                  value={oauth2.authorizationUrl || ''}
                  onChange={(v) => updateOAuth2({ authorizationUrl: v })}
                  placeholder="https://auth.example.com/authorize"
                  className={INPUT_CLASS}
                />
              </FieldRow>
              <FieldRow label="Redirect URI">
                <VariableInput
                  value={oauth2.redirectUri || 'http://localhost/callback'}
                  onChange={(v) => updateOAuth2({ redirectUri: v })}
                  placeholder="http://localhost/callback"
                  className={INPUT_CLASS}
                />
              </FieldRow>
            </>
          )}

          {(oauth2.grantType === 'authorization_code' ||
            oauth2.grantType === 'client_credentials' ||
            oauth2.grantType === 'password') && (
            <FieldRow label="Token URL">
              <VariableInput
                value={oauth2.tokenUrl || ''}
                onChange={(v) => updateOAuth2({ tokenUrl: v })}
                placeholder="https://auth.example.com/token"
                className={INPUT_CLASS}
              />
            </FieldRow>
          )}

          {(oauth2.grantType === 'authorization_code' ||
            oauth2.grantType === 'client_credentials' ||
            oauth2.grantType === 'implicit') && (
            <FieldRow label="Scope">
              <VariableInput
                value={oauth2.scope || ''}
                onChange={(v) => updateOAuth2({ scope: v })}
                placeholder="e.g. read write"
                className={INPUT_CLASS}
              />
            </FieldRow>
          )}

          {oauth2.grantType === 'authorization_code' && (
            <FieldRow label="PKCE">
              <div className="flex items-center gap-2 px-2 py-2">
                <input
                  type="checkbox"
                  id="oauth-pkce"
                  checked={oauth2.usePkce || false}
                  onChange={(e) => updateOAuth2({ usePkce: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer"
                />
                <label htmlFor="oauth-pkce" className="text-[11px] text-text-secondary cursor-pointer">
                  Use PKCE
                </label>
              </div>
            </FieldRow>
          )}

          {oauth2.grantType === 'password' && (
            <>
              <FieldRow label="Username">
                <VariableInput
                  value={oauth2.username || ''}
                  onChange={(v) => updateOAuth2({ username: v })}
                  placeholder="Username or {{variable}}"
                  className={INPUT_CLASS}
                />
              </FieldRow>
              <FieldRow label="Password">
                <VariableInput
                  value={oauth2.password || ''}
                  onChange={(v) => updateOAuth2({ password: v })}
                  placeholder="Password or {{variable}}"
                  type={shouldReveal(oauth2.password || '', false)}
                  className={INPUT_CLASS}
                />
              </FieldRow>
            </>
          )}

          <div className="flex items-center gap-3 px-3 py-2 border-t border-border/50 bg-bg-tertiary/30">
            <button
              type="button"
              onClick={getOAuthToken}
              disabled={oauthLoading}
              className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-accent/90 hover:bg-accent text-white disabled:opacity-50 transition-colors"
            >
              {oauthLoading ? 'Getting token...' : 'Get Token'}
            </button>
            {oauthError && (
              <p className="text-[10px] text-red-500/90">{oauthError}</p>
            )}
          </div>

          {oauth2.accessToken && (
            <>
              <div className="px-3 py-1.5 border-t border-border bg-bg-tertiary/50">
                <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Access Token</span>
              </div>
              <FieldRow label="Token">
                <div className="flex items-center">
                  <VariableInput
                    value={oauth2.accessToken}
                    onChange={(v) => updateOAuth2({ accessToken: v })}
                    placeholder=""
                    type={shouldReveal(oauth2.accessToken, showOAuthToken)}
                    className={INPUT_CLASS + ' flex-1'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOAuthToken(!showOAuthToken)}
                    className="px-2.5 text-text-muted/40 hover:text-text-secondary transition-colors shrink-0"
                    tabIndex={-1}
                  >
                    {showOAuthToken ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </FieldRow>
              <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-bg-tertiary/30">
                {oauth2.tokenExpiry && (
                  <p className="text-[10px] text-text-muted">
                    Expires: {new Date(oauth2.tokenExpiry).toLocaleString()}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => updateOAuth2({ accessToken: undefined, refreshToken: undefined, tokenExpiry: undefined })}
                  className="text-[10px] text-text-muted hover:text-red-500/90 transition-colors ml-auto"
                >
                  Clear Token
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Request-level auth editor with connection inheritance UX.
 * Used in RequestBuilder and GrpcRequestBuilder.
 */
export function AuthEditor() {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const setAuth = useRequestStore((s) => s.setAuth);

  const linkedConnection = activeRequest.connectionId
    ? useConnectionStore.getState().getConnection(activeRequest.connectionId)
    : undefined;
  const connectionAuth = linkedConnection?.auth;
  const connectionHasAuth = connectionAuth && connectionAuth.type !== 'none';

  return (
    <AuthEditorCore
      auth={activeRequest.auth}
      onAuthChange={setAuth}
      inheritedAuth={connectionHasAuth ? { auth: connectionAuth!, name: linkedConnection!.name } : undefined}
    />
  );
}
