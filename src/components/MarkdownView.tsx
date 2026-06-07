import React, { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";

interface MarkdownViewProps {
  content: string;
}

export default function MarkdownView({ content }: MarkdownViewProps) {
  if (!content) {
    return <div className="text-slate-500 italic text-sm">Empty document section</div>;
  }

  // Parse markdown into sequential block elements
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  
  let keyCounter = 0;
  let codeBlockBuffer: string[] = [];
  let inCodeBlock = false;
  let codeLang = "";
  let listBuffer: { type: "ordered" | "unordered"; items: string[] } | null = null;
  let tableRowsBuffer: string[][] = [];
  let inTable = false;

  const flushList = () => {
    if (!listBuffer) return;
    const items = listBuffer.items;
    const type = listBuffer.type;
    listBuffer = null;

    const listElement = type === "ordered" ? (
      <ol key={`ol-${keyCounter++}`} className="list-decimal pl-6 my-3 hover:border-l-2 hover:border-blue-500/30 pl-6 transition-all duration-150 py-1 space-y-1.5 text-slate-700 text-sm">
        {items.map((it, idx) => (
          <li key={idx} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(it) }} />
        ))}
      </ol>
    ) : (
      <ul key={`ul-${keyCounter++}`} className="list-disc pl-6 my-3 hover:border-l-2 hover:border-blue-500/30 pl-6 transition-all duration-150 py-1 space-y-1.5 text-slate-700 text-sm">
        {items.map((it, idx) => (
          <li key={idx} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(it) }} />
        ))}
      </ul>
    );
    blocks.push(listElement);
  };

  const flushTable = () => {
    if (tableRowsBuffer.length === 0) return;
    inTable = false;
    const rows = [...tableRowsBuffer];
    tableRowsBuffer = [];

    // Filter divider rows e.g. |---|---|
    const isDivider = (r: string[]) => r.every(cell => /^:?-+:?$/.test(cell.trim()));
    const validRows = rows.filter(r => r.length > 0 && !isDivider(r));

    if (validRows.length === 0) return;

    const headers = validRows[0];
    const dataRows = validRows.slice(1);

    const tableElement = (
      <div key={`table-${keyCounter++}`} className="my-5 overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase font-mono">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-3 border-r border-slate-200 last:border-0" dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(h.trim()) }} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
            {dataRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="px-4 py-2.5 border-r border-slate-200 last:border-0 align-top" dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(cell.trim()) }} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    blocks.push(tableElement);
  };

  const parseInlineMarkdown = (txt: string): string => {
    // Escaping helper
    let result = txt
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Code highlights `code` -> <code>code</code>
    result = result.replace(/`([^`]+)`/g, '<code class="bg-slate-100 border border-slate-200 text-blue-600 font-mono text-[11px] px-1.5 py-0.5 rounded">$1</code>');

    // Bold tags **text** -> <strong>text</strong>
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');

    // Italic tags *text* -> <em>text</em>
    result = result.replace(/\*([^*]+)\*/g, '<em class="text-slate-500 italic">$1</em>');

    // Link matches [anchor](href) -> <a class="..." target="_blank">anchor</a>
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-semibold">$1</a>');

    return result;
  };

  const CodeBlockComponent = ({ code, language }: { code: string; language: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="group relative my-4 border border-slate-200 rounded-lg bg-slate-900 overflow-hidden font-mono text-xs shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800/60 text-[10px] text-slate-400 tracking-wider font-mono">
          <span className="flex items-center gap-1.5 uppercase font-bold text-blue-400">
            <Terminal className="w-3" />
            {language || "code"}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 p-1 px-2 rounded hover:bg-slate-800 hover:text-slate-200 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-blue-400" />
                <span className="text-blue-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-4 overflow-x-auto text-slate-200 leading-relaxed font-mono bg-slate-900">
          <code>{code}</code>
        </pre>
      </div>
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Markdown Code Block Start/End detection
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        // End code block
        inCodeBlock = false;
        const codeText = codeBlockBuffer.join("\n");
        const lang = codeLang;
        codeBlockBuffer = [];
        codeLang = "";
        blocks.push(
          <div key={`code-wrapper-${keyCounter++}`}>
            <CodeBlockComponent code={codeText} language={lang} />
          </div>
        );
      } else {
        // Start code block
        inCodeBlock = true;
        codeLang = line.replace("```", "").trim();
        flushList();
        flushTable();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      continue;
    }

    // 2. Markdown Table detection (| Column | Column |)
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushList();
      inTable = true;
      const cells = line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|");
      tableRowsBuffer.push(cells);
      continue;
    } else if (inTable) {
      // Any empty line or non-table line breaks table parsing
      flushTable();
    }

    // 3. Headings Matching (# Title)
    if (line.startsWith("#")) {
      flushList();
      flushTable();
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const depth = match[1].length;
        const titleText = match[2];
        const parsedTitle = parseInlineMarkdown(titleText);

        if (depth === 1) {
          blocks.push(
            <h1 key={`h1-${keyCounter++}`} className="text-2xl font-black tracking-tight text-slate-900 mt-6 mb-4 border-b border-slate-200 pb-2.5" dangerouslySetInnerHTML={{ __html: parsedTitle }} />
          );
        } else if (depth === 2) {
          blocks.push(
            <h2 key={`h2-${keyCounter++}`} className="text-xl font-bold tracking-tight text-slate-800 mt-5 mb-3" dangerouslySetInnerHTML={{ __html: parsedTitle }} />
          );
        } else if (depth === 3) {
          blocks.push(
            <h3 key={`h3-${keyCounter++}`} className="text-lg font-semibold text-slate-800 mt-4 mb-2" dangerouslySetInnerHTML={{ __html: parsedTitle }} />
          );
        } else {
          blocks.push(
            <h4 key={`h4-${keyCounter++}`} className="text-base font-semibold text-slate-700 mt-3 mb-1" dangerouslySetInnerHTML={{ __html: parsedTitle }} />
          );
        }
        continue;
      }
    }

    // 4. Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(line.trim())) {
      flushList();
      flushTable();
      blocks.push(<hr key={`hr-${keyCounter++}`} className="my-6 border-t border-slate-800/80" />);
      continue;
    }

    // 5. Blockquote Matching (> text)
    if (line.trim().startsWith(">")) {
      flushList();
      flushTable();
      const quoteText = line.replace(/^>\s*/, "");
      blocks.push(
        <blockquote key={`quote-${keyCounter++}`} className="pl-4 border-l-4 border-blue-600 bg-slate-50 py-3 px-3 my-4 rounded-r-lg text-slate-600 italic text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(quoteText) }} />
      );
      continue;
    }

    // 6. Ordered / Unordered Lists
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);

    if (ulMatch) {
      flushTable();
      const listContent = ulMatch[2];
      if (!listBuffer || listBuffer.type !== "unordered") {
        flushList();
        listBuffer = { type: "unordered", items: [] };
      }
      listBuffer.items.push(listContent);
      continue;
    } else if (olMatch) {
      flushTable();
      const listContent = olMatch[2];
      if (!listBuffer || listBuffer.type !== "ordered") {
        flushList();
        listBuffer = { type: "ordered", items: [] };
      }
      listBuffer.items.push(listContent);
      continue;
    }

    // 7. Standard Paragraph
    if (line.trim() !== "") {
      flushList();
      flushTable();
      blocks.push(
        <p key={`p-${keyCounter++}`} className="text-slate-700 text-sm leading-relaxed my-3" dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line) }} />
      );
    } else {
      // Empty lines flush current buffers
      flushList();
      flushTable();
    }
  }

  // Final flushes for trailing blocks
  flushList();
  flushTable();

  return <div className="space-y-1">{blocks}</div>;
}
