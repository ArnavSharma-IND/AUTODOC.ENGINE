import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Copy, Check, Eye } from "lucide-react";
import mermaid from "mermaid";

// Prevent multiple synchronous initializations
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: "neutral",
    securityLevel: "loose",
    themeVariables: {
      primaryColor: "#0f172a", // slate 900
      primaryTextColor: "#f8fafc", // slate 50
      primaryBorderColor: "#334155", // slate 700
      lineColor: "#64748b", // slate 500
      secondaryColor: "#1e293b",
      tertiaryColor: "#0f172a"
    }
  });
} catch (e) {
  console.error("Mermaid initialization failed:", e);
}

interface MermaidProps {
  code: string;
  id: string;
}

export default function MermaidRenderer({ code, id }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [copied, setCopied] = useState<boolean>(false);
  const [isRawView, setIsRawView] = useState<boolean>(false);

  // Normalize code block
  let filteredCode = code.trim();
  if (filteredCode.startsWith("```mermaid")) {
    filteredCode = filteredCode.replace(/^```mermaid\s*/, "").replace(/```$/, "");
  } else if (filteredCode.startsWith("```")) {
    filteredCode = filteredCode.replace(/^```\s*/, "").replace(/```$/, "");
  }
  filteredCode = filteredCode.trim();

  useEffect(() => {
    let active = true;
    const elementId = `mermaid-svg-${id.replace(/[^a-zA-Z0-9]/g, "-")}`;
    setSvgHtml("");
    setError(null);

    const renderDiagram = async () => {
      try {
        // Validate diagram syntax first
        const isValid = await mermaid.parse(filteredCode);
        if (!isValid) {
          throw new Error("Mermaid syntax validation failed.");
        }

        // Render to SVG
        const { svg } = await mermaid.render(elementId, filteredCode);
        if (active) {
          // Adjust inline SVG style to make it responsive
          const styledSvg = svg
            .replace(/width="100%"/g, "")
            .replace(/style="[^"]*"/g, 'style="max-width: 100%; height: auto;"');
          setSvgHtml(styledSvg);
        }
      } catch (err: any) {
        console.error("Mermaid Render Error:", err);
        if (active) {
          setError(
            err.message || 
            "The generated Mermaid syntax has structural rendering issues. Double check source tags and retry."
          );
        }
      }
    };

    renderDiagram();

    return () => {
      active = false;
    };
  }, [filteredCode, id]);

  const handleCopy = () => {
    navigator.clipboard.writeText(filteredCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.5));
  const handleZoomReset = () => setZoom(1.0);

  return (
    <div id={`wrapper-${id}`} className="flex flex-col border border-slate-700/60 rounded-xl bg-slate-900/60 overflow-hidden backdrop-blur-md">
      {/* Visual Workspace toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700/60 text-xs text-slate-300">
        <span className="font-mono text-[10px] tracking-wider text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/40 uppercase">
          Live Schematic
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsRawView(!isRawView)}
            className="p-1 px-2 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-200 transition flex items-center gap-1 cursor-pointer"
            title="Toggle code view"
            id={`btn-raw-view-${id}`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isRawView ? "View Layout" : "View Code"}</span>
          </button>
          
          {!isRawView && !error && (
            <>
              <button
                onClick={handleZoomIn}
                className="p-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-200 transition cursor-pointer"
                title="Zoom In"
                id={`btn-zoomin-${id}`}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-200 transition cursor-pointer"
                title="Zoom Out"
                id={`btn-zoomout-${id}`}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleZoomReset}
                className="p-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-200 transition cursor-pointer"
                title="Reset zoom"
                id={`btn-zoom-reset-${id}`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            onClick={handleCopy}
            className="p-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-200 transition cursor-pointer"
            title="Copy Mermaid Code"
            id={`btn-copy-${id}`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Render stage */}
      <div className="p-6 flex items-center justify-center min-h-[350px] max-h-[550px] overflow-auto bg-slate-950/80">
        {isRawView ? (
          <pre className="w-full text-slate-300 font-mono text-xs bg-slate-900 p-4 rounded-lg overflow-x-auto border border-slate-800 self-stretch">
            {filteredCode}
          </pre>
        ) : error ? (
          <div className="flex flex-col items-center justify-center text-center max-w-md p-4">
            <span className="text-pink-400 text-2xl mb-2">⚠</span>
            <p className="text-slate-300 font-medium text-xs mb-2">Diagram compiling warning</p>
            <p className="text-slate-500 font-mono text-[10px] bg-slate-900/80 p-2.5 rounded border border-slate-800/80 line-clamp-4">
              {error}
            </p>
          </div>
        ) : svgHtml ? (
          <div
            ref={containerRef}
            className="transition-transform duration-150 ease-out origin-center select-none"
            style={{ transform: `scale(${zoom})` }}
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin"></div>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider">COMPILING FLOWCHART...</span>
          </div>
        )}
      </div>
    </div>
  );
}
