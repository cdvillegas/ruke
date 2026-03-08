import { useState, useCallback } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { ChevronRight, Sparkles, Lock, Zap, Globe, Check, ExternalLink } from 'lucide-react';
import { ProviderKeyCard, KEY_URLS } from '../shared/ProviderKeyCard';
import {
  MANAGED_PROVIDERS,
  PROVIDER_META,
  getConfiguredProviders,
  getProviderKey,
  type ManagedProvider,
} from '../../lib/agentRunner';

export function Onboarding() {
  const completeOnboarding = useUiStore((s) => s.completeOnboarding);
  const [connectedCount, setConnectedCount] = useState(() => getConfiguredProviders().length);
  const [activeTab, setActiveTab] = useState<ManagedProvider>('openai');

  const handleKeyChange = useCallback(() => {
    setConnectedCount(getConfiguredProviders().length);
  }, []);

  const handleEnterApp = () => {
    completeOnboarding();
    useUiStore.getState().setActiveView('chats');
  };

  const isConnected = (p: ManagedProvider) => {
    const key = getProviderKey(p);
    return !!key && key.length >= 10;
  };

  return (
    <div className="h-screen w-screen bg-bg-primary flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[30%] w-[500px] h-[500px] bg-accent/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[20%] w-[400px] h-[400px] bg-accent/[0.03] rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[560px] px-8">
        <div className="animate-fade-in space-y-8">

          {/* Brand + headline */}
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-5">
              <span className="text-white text-xl font-bold">R</span>
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome to Ruke</h1>
            <p className="text-[13px] text-text-secondary leading-relaxed max-w-sm mx-auto">
              Connect an AI provider to power natural-language API workflows, smart request generation, and automated testing.
            </p>
          </div>

          {/* Provider panel */}
          <div className="rounded-2xl bg-bg-secondary border border-border overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border">
              {MANAGED_PROVIDERS.map((provider) => {
                const meta = PROVIDER_META[provider];
                const connected = isConnected(provider);
                const active = activeTab === provider;

                return (
                  <button
                    key={provider}
                    onClick={() => setActiveTab(provider)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-xs font-medium transition-all relative ${
                      active
                        ? 'text-text-primary'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {connected && (
                      <span className="w-4 h-4 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                        <Check size={9} className="text-success" strokeWidth={3} />
                      </span>
                    )}
                    <span>{meta.label}</span>
                    {active && (
                      <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active tab content */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <p className="text-[13px] text-text-secondary tracking-tight">
                    {PROVIDER_META[activeTab].description}
                  </p>
                  {isConnected(activeTab) && (
                    <span className="flex items-center gap-1 text-[11px] text-success/80 font-medium">
                      <Check size={10} strokeWidth={2.5} /> Connected
                    </span>
                  )}
                </div>
                <a
                  href={KEY_URLS[activeTab]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md text-text-muted hover:text-accent border border-border hover:border-accent/30 transition-colors"
                >
                  {isConnected(activeTab) ? 'Dashboard' : 'Get a key'} <ExternalLink size={9} />
                </a>
              </div>
              <ProviderKeyCard
                key={activeTab}
                provider={activeTab}
                onKeyChange={handleKeyChange}
              />
            </div>
          </div>

          {/* Value props */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Zap, label: 'Ship faster', desc: 'Go from idea to working request in seconds' },
              { icon: Sparkles, label: 'Automate everything', desc: 'Generate tests, docs, and mocks with one prompt' },
              { icon: Globe, label: 'Zero context-switching', desc: 'AI already knows your endpoints and schemas' },
            ].map((f) => (
              <div key={f.label} className="text-center p-3 rounded-xl bg-bg-secondary/40 border border-border/40">
                <f.icon size={16} className="text-accent mx-auto mb-2" />
                <p className="text-[11px] font-medium text-text-primary mb-0.5">{f.label}</p>
                <p className="text-[10px] text-text-muted leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Privacy + CTA */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-1.5">
              <Lock size={10} className="text-text-muted" />
              <span className="text-[10px] text-text-muted">
                Your keys stay local — never sent to our servers.
              </span>
            </div>

            <button
              onClick={handleEnterApp}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-medium text-sm cursor-pointer transition-all ${
                connectedCount > 0
                  ? 'bg-accent hover:bg-accent-hover text-white'
                  : 'bg-bg-secondary border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              Start using Ruke <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
