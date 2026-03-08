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
    { tag: tags.string, color: '#a8c7b8' },
    { tag: tags.number, color: '#b0c4de' },
    { tag: tags.bool, color: '#c9a0a0' },
    { tag: tags.null, color: '#c9a0a0' },
    { tag: tags.propertyName, color: '#b8b0d0' },
    { tag: tags.keyword, color: '#c9a0a0' },
    { tag: tags.comment, color: '#6b7280' },
    { tag: tags.punctuation, color: 'var(--color-text-muted)' },
    { tag: tags.bracket, color: 'var(--color-text-muted)' },
    { tag: tags.separator, color: 'var(--color-text-muted)' },
    { tag: tags.variableName, color: '#c4b5a0' },
    { tag: tags.typeName, color: '#b0c4de' },
    { tag: tags.definition(tags.variableName), color: '#b8b0d0' },
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
