import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { createTheme } from '@uiw/codemirror-themes';

export const appEditorTheme = createTheme({
  theme: 'dark',
  settings: {
    background: 'transparent',
    foreground: 'var(--color-text-primary)',
    caret: 'var(--color-accent)',
    selection: 'rgba(59, 130, 246, 0.2)',
    selectionMatch: 'rgba(59, 130, 246, 0.1)',
    gutterBackground: 'transparent',
    gutterForeground: 'var(--color-text-muted)',
    gutterActiveForeground: 'var(--color-text-secondary)',
    lineHighlight: 'rgba(255, 255, 255, 0.02)',
  },
  styles: [
    { tag: tags.string, color: '#a5d6ff' },
    { tag: tags.number, color: '#79c0ff' },
    { tag: tags.bool, color: '#ff7b72' },
    { tag: tags.null, color: '#ff7b72' },
    { tag: tags.propertyName, color: '#d2a8ff' },
    { tag: tags.keyword, color: '#ff7b72' },
    { tag: tags.comment, color: '#8b949e' },
    { tag: tags.punctuation, color: 'var(--color-text-muted)' },
    { tag: tags.bracket, color: 'var(--color-text-muted)' },
    { tag: tags.separator, color: 'var(--color-text-muted)' },
    { tag: tags.variableName, color: '#ffa657' },
    { tag: tags.typeName, color: '#79c0ff' },
    { tag: tags.definition(tags.variableName), color: '#d2a8ff' },
  ],
});

export const blockEditorExtensions = EditorView.theme({
  '&': {
    fontSize: '12px',
    backgroundColor: 'transparent !important',
  },
  '.cm-content': {
    padding: '12px 0',
    fontFamily: "var(--font-mono, 'SF Mono', 'JetBrains Mono', monospace)",
  },
  '.cm-line': {
    padding: '0 12px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent',
  },
  '.cm-gutters': {
    background: 'transparent',
    border: 'none',
    paddingLeft: '4px',
  },
  '.cm-gutter.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 4px',
    minWidth: '32px',
    fontSize: '11px',
    opacity: '0.4',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    outline: 'none',
    color: 'inherit !important',
  },
  '.cm-foldGutter .cm-gutterElement': {
    opacity: '0.3',
    transition: 'opacity 0.15s',
  },
  '.cm-foldGutter .cm-gutterElement:hover': {
    opacity: '0.7',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-placeholder': {
    color: 'var(--color-text-muted)',
    opacity: '0.35',
  },
});

export const inlineEditorExtensions = EditorView.theme({
  '&': {
    fontSize: '12px',
    backgroundColor: 'transparent !important',
  },
  '.cm-content': {
    padding: '6px 10px',
    fontFamily: "var(--font-mono, 'SF Mono', 'JetBrains Mono', monospace)",
  },
  '.cm-line': {
    padding: '0',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent',
  },
  '.cm-gutters': {
    display: 'none',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    outline: 'none',
    color: 'inherit !important',
  },
  '.cm-placeholder': {
    color: 'var(--color-text-muted)',
    opacity: '0.35',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
});
