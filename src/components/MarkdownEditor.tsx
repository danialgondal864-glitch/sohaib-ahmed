"use client";

import { useRef, useState } from "react";

type MarkdownEditorProps = {
  name: string;
  initialValue?: string;
  maxLength: number;
  rows?: number;
  required?: boolean;
};

const controls = [
  { label: "Bold", prefix: "**", suffix: "**", placeholder: "bold text" },
  { label: "Italic", prefix: "*", suffix: "*", placeholder: "italic text" },
  { label: "Heading", prefix: "## ", suffix: "", placeholder: "Heading" },
  { label: "Bulleted list", prefix: "- ", suffix: "", placeholder: "List item" },
  { label: "Numbered list", prefix: "1. ", suffix: "", placeholder: "List item" },
  { label: "Block quote", prefix: "> ", suffix: "", placeholder: "Quoted text" },
  { label: "Inline code", prefix: "`", suffix: "`", placeholder: "code" },
  { label: "Code block", prefix: "```\n", suffix: "\n```", placeholder: "code" },
  { label: "Link", prefix: "[", suffix: "](https://)", placeholder: "link text" },
  { label: "Image", prefix: "![", suffix: "](https://)", placeholder: "image description" }
];

export default function MarkdownEditor({
  name,
  initialValue = "",
  maxLength,
  rows = 10,
  required = false
}: MarkdownEditorProps) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insert(prefix: string, suffix: string, placeholder: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const inserted = `${prefix}${selected || placeholder}${suffix}`;
    const nextValue = `${value.slice(0, start)}${inserted}${value.slice(end)}`;
    const selectionStart = start + prefix.length;
    const selectionEnd = selectionStart + (selected || placeholder).length;
    setValue(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function insertTable() {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const table = "| Column | Column |\n| --- | --- |\n| Value | Value |";
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = `${value.slice(0, start)}${table}${value.slice(end)}`;
    setValue(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + table.length);
    });
  }

  return (
    <div className="markdown-editor">
      <div className="markdown-toolbar" role="group" aria-label="Markdown formatting">
        {controls.map((control) => (
          <button
            key={control.label}
            className="button button-ghost"
            type="button"
            aria-label={control.label}
            onClick={() => insert(control.prefix, control.suffix, control.placeholder)}
          >
            {control.label}
          </button>
        ))}
        <button
          className="button button-ghost"
          type="button"
          aria-label="Insert table"
          onClick={insertTable}
        >
          Table
        </button>
      </div>
      <textarea
        ref={textareaRef}
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={maxLength}
        rows={rows}
        required={required}
        aria-label="Publication content in Markdown"
      />
      <p className="fine-print">Markdown is supported. Raw HTML is not rendered.</p>
    </div>
  );
}
