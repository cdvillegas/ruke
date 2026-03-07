import { useRequestStore } from '../../stores/requestStore';
import { KeyValueEditor } from './KeyValueEditor';

export function HeadersEditor() {
  const { activeRequest, setHeaders } = useRequestStore();

  return (
    <KeyValueEditor
      pairs={activeRequest.headers}
      onChange={setHeaders}
      keyPlaceholder="Header name"
      valuePlaceholder="Value"
    />
  );
}
