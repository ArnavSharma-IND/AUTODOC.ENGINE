import { GeneratedDocSection, CustomDiagram } from "./types";

/**
 * Technical Documentation Exporter Suite
 */

// Helper to escape HTML tags
function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Export full documentation build as formatted Markdown
 */
export function exportAsMarkdown(projectName: string, sections: GeneratedDocSection[], diagrams: CustomDiagram[]): string {
  let output = `# ${projectName} - Complete Technical Documentation\n`;
  output += `*Generated automatically on ${new Date().toLocaleDateString()}*\n\n`;
  output += `***\n\n`;

  // Append Diagrams
  if (diagrams && diagrams.length > 0) {
    output += `## SYSTEM DIAGRAMS & FLOWCHARTS\n\n`;
    diagrams.forEach(diag => {
      output += `### ${diag.title}\n`;
      output += `*${diag.description}*\n\n`;
      output += `\`\`\`mermaid\n${diag.code.trim()}\n\`\`\`\n\n`;
    });
    output += `***\n\n`;
  }

  // Append individual markdown blocks
  sections.forEach(sec => {
    output += `## ${sec.title}\n\n`;
    output += `${sec.content.trim()}\n\n`;
    output += `***\n\n`;
  });

  return output;
}

/**
 * Export full documentation build as styled portable HTML webpage
 */
export function exportAsHTML(projectName: string, sections: GeneratedDocSection[], diagrams: CustomDiagram[]): string {
  let sectionListHtml = sections.map(sec => `
    <article class="doc-section" id="sec-${sec.id}">
      <h2>${sec.title}</h2>
      <div class="content">${sec.content.replace(/\n/g, "<br>")}</div>
    </article>
  `).join("\n");

  let diagramListHtml = diagrams.map(diag => `
    <div class="diagram-block">
      <h3>${diag.title}</h3>
      <p class="description"><em>${diag.description}</em></p>
      <pre><code>${escapeHtml(diag.code)}</code></pre>
    </div>
  `).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - Technical Documentation Hub</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --font-sans: 'Inter', system-ui, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
      --bg-color: #0f172a;
      --text-color: #f1f5f9;
      --primary: #2dd4bf;
      --border-color: #334155;
    }
    body {
      font-family: var(--font-sans);
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.7;
      margin: 0;
      padding: 0;
    }
    header {
      background: linear-gradient(135deg, #1e293b, #0f172a);
      padding: 3rem 2rem;
      border-bottom: 1px solid var(--border-color);
      text-align: center;
    }
    header h1 {
      margin: 0;
      font-size: 2.2rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: white;
    }
    header p {
      color: #94a3b8;
      margin-top: 0.5rem;
      font-size: 1rem;
    }
    .wrapper {
      max-width: 900px;
      margin: 2rem auto;
      padding: 0 1.5rem;
    }
    .badge {
      background-color: rgba(45, 212, 191, 0.1);
      color: var(--primary);
      border: 1px solid rgba(45, 212, 191, 0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .doc-section {
      background: #1e293b;
      border: 1px solid var(--border-color);
      padding: 2.5rem;
      border-radius: 12px;
      margin-bottom: 2rem;
    }
    .doc-section h2 {
      margin-top: 0;
      color: white;
      font-size: 1.5rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.75rem;
    }
    p, li {
      color: #cbd5e1;
    }
    pre {
      background-color: #020617;
      border: 1px solid var(--border-color);
      padding: 1.25rem;
      border-radius: 8px;
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 0.85rem;
    }
    code {
      font-family: var(--font-mono);
      background: #020617;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: #fca5a5;
    }
    pre code {
      background: none;
      padding: 0;
      color: #f1f5f9;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
    }
    th, td {
      border: 1px solid var(--border-color);
      padding: 0.75rem 1rem;
      text-align: left;
    }
    th {
      background-color: #0f172a;
      color: white;
    }
    .diagram-block {
      background-color: #111827;
      border: 1px dashed var(--border-color);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .diagram-block h3 {
      margin-top: 0;
      color: white;
    }
    .description {
      color: #94a3b8;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <header>
    <div style="margin-bottom: 1rem;"><span class="badge">Official Technical Spec</span></div>
    <h1>${projectName} Documentation Portal</h1>
    <p>Automated Hardware/Software System Analysis Guide</p>
  </header>
  <div class="wrapper">
    <section class="doc-section">
      <h2>Interactive System Diagrams</h2>
      ${diagramListHtml}
    </section>
    ${sectionListHtml}
  </div>
</body>
</html>`;
}

/**
 * Download a file helper
 */
export function triggerDownload(filename: string, text: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate standard C-style vs refactored document diff matching
 */
export function computeDMPDiff(original: string, updated: string): Array<{ type: "add" | "delete" | "same"; val: string }> {
  const leftLines = original.split("\n");
  const rightLines = updated.split("\n");
  const result: Array<{ type: "add" | "delete" | "same"; val: string }> = [];

  let i = 0;
  let j = 0;

  while (i < leftLines.length || j < rightLines.length) {
    if (i < leftLines.length && j < rightLines.length) {
      if (leftLines[i].trim() === rightLines[j].trim()) {
        result.push({ type: "same", val: leftLines[i] });
        i++;
        j++;
      } else {
        // Simple lookahead matching to check line shifting
        let isMatchAhead = false;
        for (let k = 1; k < 4; k++) {
          if (j + k < rightLines.length && leftLines[i].trim() === rightLines[j + k].trim()) {
            isMatchAhead = true;
            break;
          }
        }
        if (isMatchAhead) {
          result.push({ type: "add", val: rightLines[j] });
          j++;
        } else {
          result.push({ type: "delete", val: leftLines[i] });
          i++;
        }
      }
    } else if (i < leftLines.length) {
      result.push({ type: "delete", val: leftLines[i] });
      i++;
    } else {
      result.push({ type: "add", val: rightLines[j] });
      j++;
    }
  }

  return result;
}
