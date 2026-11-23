import Image from "next/image";
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
            return typeof src === "string" && src
              ? (
                  <Image
                    src={src}
                    alt={alt ?? ""}
                    width={1200}
                    height={675}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    unoptimized
                  />
                )
              : null;
          }
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
