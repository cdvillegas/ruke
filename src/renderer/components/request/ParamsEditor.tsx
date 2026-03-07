import { useRequestStore } from '../../stores/requestStore';
import { KeyValueEditor } from './KeyValueEditor';

export function ParamsEditor() {
  const { activeRequest, setParams } = useRequestStore();

  return (
    <KeyValueEditor
      pairs={activeRequest.params}
      onChange={setParams}
      keyPlaceholder="Parameter name"
      valuePlaceholder="Value"
    />
  );
}
