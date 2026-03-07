import { useState } from 'react';
import { useUiStore } from '../../stores/uiStore';
import {
  ArrowRight, Sparkles, Globe, ChevronRight, Zap, Send, Braces,
} from 'lucide-react';
import { SmartAddPanel, type QuickExample } from '../connections/ConnectionsView';

const QUICK_EXAMPLES: QuickExample[] = [
  {
    label: 'Swagger Petstore',
    desc: 'Classic REST API — OpenAPI 3.0',
    type: 'openapi',
    url: 'https://petstore3.swagger.io/api/v3/openapi.json',
    icon: Globe,
    color: 'text-success',
  },
  {
    label: 'GitHub API',
    desc: 'REST API — OpenAPI 3.0',
    type: 'openapi',
    url: 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json',
    icon: Globe,
    color: 'text-accent',
  },
  {
    label: 'Star Wars API',
    desc: 'GraphQL — introspection',
    type: 'graphql',
    url: 'https://swapi-graphql.netlify.app/graphql',
    icon: Braces,
    color: 'text-warning',
  },
];

type Step = 'welcome' | 'connect' | 'ready';

export function Onboarding() {
  const [step, setStep] = useState<Step>('welcome');
  const [connectedName, setConnectedName] = useState('');
  const [endpointCount, setEndpointCount] = useState(0);
  const [connectedType, setConnectedType] = useState<'openapi' | 'graphql' | 'grpc'>('openapi');
  const { completeOnboarding } = useUiStore();

  const handleConnected = (name: string, count: number, type: 'openapi' | 'graphql' | 'grpc') => {
    setConnectedName(name);
    setEndpointCount(count);
    setConnectedType(type);
    setTimeout(() => setStep('ready'), 1200);
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

      <div className="relative w-full max-w-lg px-8">
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
          <div className="text-center space-y-8 animate-fade-in max-w-md mx-auto">
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
                { icon: Globe, color: 'text-success', title: 'Spec-native', desc: 'Import OpenAPI or GraphQL specs — every endpoint is ready to use.' },
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

        {/* Connect — uses the same SmartAddPanel as the main app */}
        {step === 'connect' && (
          <div className="animate-fade-in space-y-6">
            <h2 className="text-xl font-bold text-text-primary text-center">Connect your first API</h2>

            <SmartAddPanel
              onConnected={handleConnected}
              quickExamples={QUICK_EXAMPLES}
            />

            <div className="text-center">
              <button
                onClick={handleSkipToApp}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* Ready */}
        {step === 'ready' && (
          <div className="text-center space-y-8 animate-fade-in max-w-md mx-auto">
            <div>
              <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={24} className="text-accent" />
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2">You're all set</h2>
              <p className="text-sm text-text-secondary max-w-sm mx-auto">
                {connectedName} is connected with {endpointCount} {connectedType === 'graphql' ? 'operations' : connectedType === 'grpc' ? 'methods' : 'endpoints'}.
                Just type what you want to do and Rüke handles the rest.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-bg-secondary border border-border text-left">
              <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-3">Try typing:</p>
              <div className="space-y-2">
                {(connectedType === 'graphql' ? [
                  'List all films',
                  'Get details for Luke Skywalker',
                  'Show me all starships',
                ] : [
                  'GET all pets',
                  'Create a new pet named "Max"',
                  'Find pets by status: available',
                ]).map((hint) => (
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
