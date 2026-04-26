import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

interface MarkdownProps {
  source: string
  className?: string
}

export const Markdown = ({ source, className }: MarkdownProps) => (
  <div className={className}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        h1: ({ children }) => <h1 className="my-4 text-2xl font-bold">{children}</h1>,
        h2: ({ children }) => <h2 className="my-3 text-xl font-semibold">{children}</h2>,
        h3: ({ children }) => <h3 className="my-2 text-lg font-semibold">{children}</h3>,
        p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
        code: ({ children }) => (
          <code className="rounded bg-muted px-1 font-mono text-sm">{children}</code>
        ),
        ul: ({ children }) => <ul className="my-2 list-disc pl-6">{children}</ul>,
        ol: ({ children }) => <ol className="my-2 list-decimal pl-6">{children}</ol>,
        li: ({ children }) => <li className="my-1">{children}</li>,
        a: ({ children, href }) => (
          <a className="text-primary underline-offset-4 hover:underline" href={href}>
            {children}
          </a>
        ),
      }}
    >
      {source}
    </ReactMarkdown>
  </div>
)
