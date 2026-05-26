/**
 * Component for rendering markdown with LaTeX math support
 */
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  content: string;
  className?: string;
}

export function MathRenderer({ content, className = '' }: MathRendererProps) {
  return (
    <div className={`prose prose-slate max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // react-markdown v9 dropped the `inline` prop; in v9 fenced code
          // is wrapped in <pre> by the renderer, so we style <pre> for the
          // block case and <code> only for inline.
          pre({ children, ...props }) {
            return (
              <pre className="bg-gray-100 rounded-lg p-4 overflow-x-auto" {...props}>
                {children}
              </pre>
            );
          },
          code({ className, children, ...props }) {
            const isBlock = className?.startsWith('language-') ?? false;
            return isBlock ? (
              <code className={className} {...props}>
                {children}
              </code>
            ) : (
              <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
