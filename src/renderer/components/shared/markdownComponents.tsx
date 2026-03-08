import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const markdownComponents: Record<string, React.ComponentType<any>> = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic text-text-secondary">{children}</em>,
  h1: ({ children }) => <h1 className="text-lg font-bold text-text-primary mt-4 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold text-text-primary mt-3 mb-1.5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-text-primary mt-2.5 mb-1 first:mt-0">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc list-outside pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="text-sm text-text-primary pl-0.5">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="text-[13px] font-mono text-text-primary" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-bg-tertiary px-1.5 py-0.5 rounded text-[13px] font-mono text-accent" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-bg-tertiary rounded-lg p-3 text-xs font-mono overflow-x-auto mb-2 border border-border/40">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent/40 pl-3 text-text-secondary italic mb-2">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border my-3" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2 rounded-lg border border-border/60">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-bg-tertiary/60">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left px-3 py-1.5 text-text-secondary font-medium border-b border-border/40">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-text-primary border-b border-border/20">{children}</td>
  ),
};

export function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="text-sm text-text-primary leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

const tooltipMarkdownComponents: Record<string, React.ComponentType<any>> = {
  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-outside pl-4 mb-1 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-4 mb-1 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return <code className="text-[10px] font-mono text-text-primary" {...props}>{children}</code>;
    }
    return (
      <code className="bg-bg-tertiary px-1 py-px rounded text-[10px] font-mono text-accent" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-bg-tertiary rounded p-2 text-[10px] font-mono overflow-x-auto mb-1 border border-border/40">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent/40 pl-2 italic mb-1">{children}</blockquote>
  ),
  hr: () => <hr className="border-border my-1.5" />,
};

export function TooltipMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={tooltipMarkdownComponents}>
      {content.length > 500 ? content.slice(0, 500) + '...' : content}
    </ReactMarkdown>
  );
}
