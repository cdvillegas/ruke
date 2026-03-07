import { useRequestStore } from '../../stores/requestStore';
import { KeyValueEditor } from './KeyValueEditor';
import type { BodyType } from '@shared/types';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';

const BODY_TYPES: { id: BodyType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'json', label: 'JSON' },
  { id: 'form-data', label: 'Form Data' },
  { id: 'x-www-form-urlencoded', label: 'URL Encoded' },
  { id: 'raw', label: 'Raw' },
];

export function BodyEditor() {
  const { activeRequest, setBody } = useRequestStore();
  const body = activeRequest.body;

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {BODY_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setBody({ ...body, type: t.id })}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              body.type === t.id
                ? 'bg-accent text-white'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {body.type === 'none' && (
        <p className="text-xs text-text-muted py-4 text-center">
          This request does not have a body
        </p>
      )}

      {(body.type === 'json' || body.type === 'raw') && (
        <div className="rounded-lg border border-border overflow-hidden">
          <CodeMirror
            value={body.raw || ''}
            onChange={(val) => setBody({ ...body, raw: val })}
            extensions={body.type === 'json' ? [json()] : []}
            theme={oneDark}
            height="200px"
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              bracketMatching: true,
              closeBrackets: true,
            }}
          />
        </div>
      )}

      {body.type === 'form-data' && (
        <KeyValueEditor
          pairs={body.formData || [{ key: '', value: '', enabled: true }]}
          onChange={(formData) => setBody({ ...body, formData })}
          keyPlaceholder="Field name"
          valuePlaceholder="Value"
        />
      )}

      {body.type === 'x-www-form-urlencoded' && (
        <KeyValueEditor
          pairs={body.urlEncoded || [{ key: '', value: '', enabled: true }]}
          onChange={(urlEncoded) => setBody({ ...body, urlEncoded })}
          keyPlaceholder="Field name"
          valuePlaceholder="Value"
        />
      )}
    </div>
  );
}
