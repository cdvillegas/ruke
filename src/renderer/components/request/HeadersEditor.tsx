import { useRequestStore } from '../../stores/requestStore';
import { KeyValueEditor } from './KeyValueEditor';

export function HeadersEditor() {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const setHeaders = useRequestStore((s) => s.setHeaders);

  return (
    <KeyValueEditor
      pairs={activeRequest.headers}
      onChange={setHeaders}
      keyPlaceholder="Header name"
      valuePlaceholder="Value"
    />
  );
}
