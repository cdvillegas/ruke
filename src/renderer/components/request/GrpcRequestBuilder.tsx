import { useState, useCallback, useMemo } from 'react';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useUiStore } from '../../stores/uiStore';
import { KeyValueEditor } from './KeyValueEditor';
import { AuthEditor } from './AuthEditor';
import { GRPC_STATUS_CODES, GRPC_STATUS_COLORS } from '@shared/constants';
import type { GrpcRequest, GrpcResponse, GrpcMethodType, ProtoDefinition, ProtoMethod, KeyValue } from '@shared/types';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  Send, Loader2, Save, FileUp, Server, Zap,
  ArrowUpDown, ArrowDown, ArrowUp, Radio,
  Clock, Shield, ChevronDown, Info,
} from 'lucide-react';
import { nanoid } from 'nanoid';

const METHOD_TYPE_LABELS: Record<GrpcMethodType, { label: string; icon: typeof ArrowDown; color: string }> = {
  unary: { label: 'Unary', icon: Zap, color: '#22c55e' },
  server_streaming: { label: 'Server Stream', icon: ArrowDown, color: '#3b82f6' },
  client_streaming: { label: 'Client Stream', icon: ArrowUp, color: '#f59e0b' },
  bidi_streaming: { label: 'Bidi Stream', icon: ArrowUpDown, color: '#a855f7' },
};

interface GrpcRequestBuilderProps {
  request: GrpcRequest;
  onUpdate: (updates: Partial<GrpcRequest>) => void;
  onSend: () => void;
  onSave: () => void;
  loading: boolean;
  response: GrpcResponse | null;
  protoDefinition?: ProtoDefinition;
  onLoadProto?: () => void;
}

export function GrpcRequestBuilder({
  request, onUpdate, onSend, onSave, loading, response,
  protoDefinition, onLoadProto,
}: GrpcRequestBuilderProps) {
  const resolveString = useEnvironmentStore((s) => s.resolveString);
  const activeRequestTab = useUiStore((s) => s.activeRequestTab);
  const setActiveRequestTab = useUiStore((s) => s.setActiveRequestTab);

  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);

  const services = protoDefinition?.services || [];
  const currentService = services.find(s => s.fullName === request.serviceName || s.name === request.serviceName);
  const currentMethod = currentService?.methods.find(m => m.name === request.methodName);
  const methodTypeInfo = currentMethod ? METHOD_TYPE_LABELS[currentMethod.methodType] : null;
  const MethodTypeIcon = methodTypeInfo?.icon || Zap;

  const resolvedUrl = resolveString(request.serverUrl);
  const hasVariables = request.serverUrl !== resolvedUrl && request.serverUrl.includes('{{');

  const generateSkeleton = useCallback((method: ProtoMethod): string => {
    if (!method.inputFields || method.inputFields.length === 0) return '{}';
    const obj: Record<string, any> = {};
    for (const field of method.inputFields) {
      if (field.repeated) {
        obj[field.name] = [];
      } else if (['string', 'bytes'].includes(field.type)) {
        obj[field.name] = '';
      } else if (['int32', 'int64', 'uint32', 'uint64', 'float', 'double', 'fixed32', 'fixed64', 'sfixed32', 'sfixed64', 'sint32', 'sint64'].includes(field.type)) {
        obj[field.name] = 0;
      } else if (field.type === 'bool') {
        obj[field.name] = false;
      } else {
        obj[field.name] = {};
      }
    }
    return JSON.stringify(obj, null, 2);
  }, []);

  const handleSelectMethod = useCallback((service: typeof services[0], method: ProtoMethod) => {
    onUpdate({
      serviceName: service.fullName,
      methodName: method.name,
      methodType: method.methodType,
      message: generateSkeleton(method),
    });
    setServiceDropdownOpen(false);
  }, [onUpdate, generateSkeleton]);

  const metadataAsKeyValue: KeyValue[] = useMemo(() =>
    request.metadata.map(m => ({ key: m.key, value: m.value, enabled: m.enabled })),
    [request.metadata]
  );

  const tabs = [
    { id: 'message', label: 'Message' },
    { id: 'metadata', label: 'Metadata', count: request.metadata.filter(m => m.enabled && m.key).length },
    { id: 'options', label: 'Options' },
    { id: 'auth', label: 'Auth', badge: undefined },
  ];

  return (
    <div className="space-y-4">
      {/* Server address + service/method selector */}
      <div className="space-y-2">
        <div className="flex gap-2">
          {/* Method type badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-bg-tertiary border border-border text-sm font-mono font-bold shrink-0"
            style={{ color: methodTypeInfo?.color || '#6b7280' }}
            title={methodTypeInfo ? `${methodTypeInfo.label} RPC` : 'Select a method'}
          >
            <MethodTypeIcon size={14} />
            <span className="text-[10px] tracking-wider uppercase">
              {methodTypeInfo?.label || 'gRPC'}
            </span>
          </div>

          {/* Server address */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={request.serverUrl}
              onChange={(e) => onUpdate({ serverUrl: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && onSend()}
              placeholder="localhost:50051"
              className="w-full px-4 py-2.5 rounded-lg bg-bg-tertiary border border-border text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            {hasVariables && (
              <div className="absolute -bottom-5 left-0 text-[10px] text-text-muted font-mono truncate max-w-full">
                {resolvedUrl}
              </div>
            )}
          </div>

          <button
            onClick={onSave}
            className="px-3 py-2.5 rounded-lg bg-bg-tertiary border border-border hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
            title="Save Request"
          >
            <Save size={16} />
          </button>

          <button
            onClick={onSend}
            disabled={loading || !request.serviceName || !request.methodName}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            <span>Invoke</span>
          </button>
        </div>

        {/* Service / Method picker */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <button
              onClick={() => setServiceDropdownOpen(!serviceDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm font-mono text-text-primary hover:bg-bg-hover transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <Server size={13} className="text-text-muted shrink-0" />
                {currentService && currentMethod ? (
                  <span className="truncate">
                    <span className="text-text-secondary">{currentService.name}</span>
                    <span className="text-text-muted mx-1">/</span>
                    <span className="text-text-primary font-medium">{currentMethod.name}</span>
                    <span className="text-text-muted text-xs ml-2">
                      ({currentMethod.inputType} → {currentMethod.outputType})
                    </span>
                  </span>
                ) : (
                  <span className="text-text-muted">Select service & method...</span>
                )}
              </div>
              <ChevronDown size={14} className="text-text-muted shrink-0" />
            </button>

            {serviceDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setServiceDropdownOpen(false)} />
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-bg-secondary border border-border rounded-lg shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
                  {services.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-xs text-text-muted mb-2">No proto loaded</p>
                      {onLoadProto && (
                        <button
                          onClick={() => { onLoadProto(); setServiceDropdownOpen(false); }}
                          className="flex items-center gap-1.5 mx-auto px-3 py-1.5 text-xs rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                        >
                          <FileUp size={12} />
                          Load .proto file
                        </button>
                      )}
                    </div>
                  ) : (
                    services.map(service => (
                      <div key={service.fullName}>
                        <div className="px-3 py-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wider bg-bg-tertiary border-b border-border">
                          {service.name}
                        </div>
                        {service.methods.map(method => {
                          const info = METHOD_TYPE_LABELS[method.methodType];
                          const Icon = info.icon;
                          const isSelected = request.serviceName === service.fullName && request.methodName === method.name;
                          return (
                            <button
                              key={method.fullName}
                              onClick={() => handleSelectMethod(service, method)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-bg-hover transition-colors ${
                                isSelected ? 'bg-accent/10 text-accent' : 'text-text-primary'
                              }`}
                            >
                              <Icon size={12} style={{ color: info.color }} />
                              <span className="font-mono font-medium">{method.name}</span>
                              <span className="text-text-muted text-[10px] ml-auto">
                                {method.inputType} → {method.outputType}
                              </span>
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ color: info.color, backgroundColor: `${info.color}15` }}
                              >
                                {info.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {onLoadProto && (
            <button
              onClick={onLoadProto}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="Load .proto file"
            >
              <FileUp size={13} />
              <span>.proto</span>
            </button>
          )}
        </div>
      </div>

      {/* Input schema hint */}
      {currentMethod && currentMethod.inputFields && currentMethod.inputFields.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/10">
          <Info size={12} className="text-accent mt-0.5 shrink-0" />
          <div className="text-[11px] text-text-secondary">
            <span className="font-mono text-accent">{currentMethod.inputType}</span>
            <span className="text-text-muted mx-1">—</span>
            {currentMethod.inputFields.map((f, i) => (
              <span key={f.name}>
                <span className="font-mono">{f.name}</span>
                <span className="text-text-muted">: {f.repeated ? `[${f.type}]` : f.type}</span>
                {i < currentMethod.inputFields!.length - 1 && <span className="text-text-muted">, </span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={`${hasVariables ? 'mt-6' : ''}`}>
        <div className="flex gap-0.5 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveRequestTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium transition-colors relative ${
                activeRequestTab === tab.id
                  ? 'text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[10px]">
                  {tab.count}
                </span>
              )}
              {activeRequestTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
              )}
            </button>
          ))}
        </div>

        <div className="pt-3">
          {activeRequestTab === 'message' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-medium">
                  Request Message (JSON)
                </label>
                {currentMethod && (
                  <button
                    onClick={() => onUpdate({ message: generateSkeleton(currentMethod) })}
                    className="text-[10px] text-accent hover:text-accent-hover transition-colors"
                  >
                    Reset to skeleton
                  </button>
                )}
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <CodeMirror
                  value={request.message}
                  onChange={(val) => onUpdate({ message: val })}
                  extensions={[json()]}
                  theme={oneDark}
                  height="240px"
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    bracketMatching: true,
                    closeBrackets: true,
                  }}
                />
              </div>
            </div>
          )}

          {activeRequestTab === 'metadata' && (
            <div className="space-y-2">
              <p className="text-xs text-text-muted">
                gRPC metadata (equivalent to HTTP headers)
              </p>
              <KeyValueEditor
                pairs={metadataAsKeyValue.length > 0 ? metadataAsKeyValue : [{ key: '', value: '', enabled: true }]}
                onChange={(pairs) => onUpdate({
                  metadata: pairs.map(p => ({ key: p.key, value: p.value, enabled: p.enabled })),
                })}
                keyPlaceholder="metadata-key"
                valuePlaceholder="value"
              />
            </div>
          )}

          {activeRequestTab === 'options' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-bg-tertiary border border-border">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-text-muted" />
                  <div>
                    <p className="text-xs text-text-primary font-medium">TLS / SSL</p>
                    <p className="text-[10px] text-text-muted">Use secure connection</p>
                  </div>
                </div>
                <button
                  onClick={() => onUpdate({ tlsEnabled: !request.tlsEnabled })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    request.tlsEnabled ? 'bg-accent' : 'bg-bg-active'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      request.tlsEnabled ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="p-3 rounded-lg bg-bg-tertiary border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-text-muted" />
                  <div>
                    <p className="text-xs text-text-primary font-medium">Deadline</p>
                    <p className="text-[10px] text-text-muted">Maximum time to wait for response (ms)</p>
                  </div>
                </div>
                <input
                  type="number"
                  value={request.deadline || ''}
                  onChange={(e) => onUpdate({ deadline: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="No deadline (wait indefinitely)"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-bg-primary border border-border font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
          )}

          {activeRequestTab === 'auth' && <AuthEditor />}
        </div>
      </div>
    </div>
  );
}
