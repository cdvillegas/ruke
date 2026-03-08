import { useRequestStore } from '../../stores/requestStore';
import { KeyValueEditor } from './KeyValueEditor';

export function ParamsEditor() {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const setParams = useRequestStore((s) => s.setParams);

  return (
    <KeyValueEditor
      pairs={activeRequest.params}
      onChange={setParams}
      keyPlaceholder="Parameter name"
      valuePlaceholder="Value"
    />
  );
}
