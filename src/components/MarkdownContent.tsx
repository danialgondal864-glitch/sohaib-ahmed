import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

export default function MarkdownContent({ source }: { source: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          img({ src, alt }) {
            return src
              ? <img src={src} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" />
              : null;
          }
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
