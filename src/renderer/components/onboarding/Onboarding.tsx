import { useState, useRef } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useConnectionStore } from '../../stores/connectionStore';
import {
  ArrowRight, Sparkles, Globe, Upload, Link,
  Check, ChevronRight, Loader2, Zap, Send,
} from 'lucide-react';

type Step = 'welcome' | 'connect' | 'ready';

export function Onboarding() {
  const [step, setStep] = useState<Step>('welcome');
  const [specInput, setSpecInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectedName, setConnectedName] = useState('');
  const [endpointCount, setEndpointCount] = useState(0);
  const { completeOnboarding } = useUiStore();
  const { importOpenApiSpec, addConnection } = useConnectionStore();

  const handleSpecImport = async () => {
    if (!specInput.trim()) return;
    setLoading(true);

    let text = specInput.trim();
    let sourceUrl: string | undefined;

    if (text.startsWith('http')) {
      sourceUrl = text;
      try {
        const res = await fetch(text);
        text = await res.text();
      } catch {
        setLoading(false);
        return;
      }
    }

    const conn = importOpenApiSpec(text, sourceUrl);
    if (conn) {
      setConnected(true);
      setConnectedName(conn.name);
      setEndpointCount(conn.endpoints.length);
      setTimeout(() => setStep('ready'), 1200);
    }
    setLoading(false);
  };

  const handleFileImport = async () => {
    const result = await window.ruke.file.import([
      { name: 'API Specs', extensions: ['json', 'yaml', 'yml'] },
    ]);
    if (result.success && result.content) {
      setLoading(true);
      const conn = importOpenApiSpec(result.content, result.path);
      if (conn) {
        setConnected(true);
        setConnectedName(conn.name);
        setEndpointCount(conn.endpoints.length);
        setTimeout(() => setStep('ready'), 1200);
      }
      setLoading(false);
    }
  };

  const handleSkipToApp = () => {
    completeOnboarding();
    useUiStore.getState().setActiveView('home');
  };

  return (
    <div className="h-screen w-screen bg-bg-primary flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[30%] w-[500px] h-[500px] bg-accent/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[20%] w-[400px] h-[400px] bg-accent/[0.03] rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md px-8">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-10 justify-center">
          {['welcome', 'connect', 'ready'].map((s, i) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-500 ${
                ['welcome', 'connect', 'ready'].indexOf(step) >= i ? 'bg-accent w-10' : 'bg-border w-6'
              }`}
            />
          ))}
        </div>

        {/* Welcome */}
        {step === 'welcome' && (
          <div className="text-center space-y-8 animate-fade-in">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-5">
                <span className="text-white text-2xl font-bold">R</span>
              </div>
              <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome to Rüke</h1>
              <p className="text-sm text-text-secondary leading-relaxed max-w-sm mx-auto">
                The API client that understands your APIs. Just tell it what you want, drop in a spec, and go.
              </p>
            </div>

            <div className="space-y-3 text-left">
              {[
                { icon: Sparkles, color: 'text-accent', title: 'AI-first', desc: 'Describe requests in plain English. AI does the rest.' },
                { icon: Globe, color: 'text-success', title: 'Spec-native', desc: 'Drop an OpenAPI spec and every endpoint is ready to use.' },
                { icon: Zap, color: 'text-warning', title: 'Works offline', desc: 'Everything runs locally. No cloud required. Ever.' },
              ].map((f) => (
                <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl bg-bg-secondary/60 border border-border/50">
                  <f.icon size={16} className={`${f.color} mt-0.5 shrink-0`} />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{f.title}</p>
                    <p className="text-xs text-text-muted">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep('connect')}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-all"
              >
                Connect your first API <ArrowRight size={16} />
              </button>
              <button
                onClick={handleSkipToApp}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                Skip — I'll explore on my own
              </button>
            </div>
          </div>
        )}

        {/* Connect */}
        {step === 'connect' && (
          <div className="text-center space-y-6 animate-fade-in">
            <div>
              <div className="w-14 h-14 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-4">
                <Globe size={24} className="text-success" />
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2">Connect an API</h2>
              <p className="text-sm text-text-secondary">
                Paste an OpenAPI spec URL, drop a file, or paste the spec JSON directly.
              </p>
            </div>

            {connected ? (
              <div className="p-5 rounded-2xl bg-success/10 border border-success/30 animate-fade-in">
                <Check size={24} className="mx-auto text-success mb-2" />
                <p className="text-sm font-medium text-success">{connectedName}</p>
                <p className="text-xs text-success/70">{endpointCount} endpoints imported</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <textarea
                    value={specInput}
                    onChange={(e) => setSpecInput(e.target.value)}
                    placeholder={"Paste a URL like:\nhttps://petstore3.swagger.io/api/v3/openapi.json\n\nOr paste the spec JSON directly..."}
                    rows={4}
                    className="w-full px-4 py-3 text-xs font-mono rounded-2xl bg-bg-secondary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none transition-colors"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={handleSpecImport}
                      disabled={loading || !specInput.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-accent hover:bg-accent-hover text-white text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <Link size={16} />}
                      <span>Import</span>
                    </button>
                    <button
                      onClick={handleFileImport}
                      className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-secondary border border-border hover:bg-bg-tertiary text-text-primary text-sm transition-colors"
                    >
                      <Upload size={16} />
                      <span>File</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[10px] text-text-muted mb-2">Try one of these:</p>
                  <div className="flex flex-col gap-1">
                    {[
                      { label: 'Swagger Petstore', url: 'https://petstore3.swagger.io/api/v3/openapi.json' },
                    ].map((example) => (
                      <button
                        key={example.url}
                        onClick={() => setSpecInput(example.url)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-secondary/60 border border-border/50 hover:border-accent/30 text-left transition-colors"
                      >
                        <Globe size={12} className="text-accent shrink-0" />
                        <div>
                          <span className="text-xs text-text-primary">{example.label}</span>
                          <span className="block text-[9px] text-text-muted font-mono truncate">{example.url}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              onClick={handleSkipToApp}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Ready */}
        {step === 'ready' && (
          <div className="text-center space-y-8 animate-fade-in">
            <div>
              <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={24} className="text-accent" />
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2">You're all set</h2>
              <p className="text-sm text-text-secondary max-w-sm mx-auto">
                {connectedName} is connected with {endpointCount} endpoints.
                Just type what you want to do and Rüke handles the rest.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-bg-secondary border border-border text-left">
              <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-3">Try typing:</p>
              <div className="space-y-2">
                {[
                  'GET all pets',
                  'Create a new pet named "Max"',
                  'Find pets by status: available',
                ].map((hint) => (
                  <div key={hint} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-tertiary border border-border">
                    <Send size={10} className="text-accent shrink-0" />
                    <span className="text-xs text-text-secondary italic">{hint}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleSkipToApp}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-all"
            >
              Start using Rüke <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
