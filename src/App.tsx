import React, { useState, useEffect } from "react";
import JSZip from "jszip";
import { 
  Upload, FolderTree, Github, FileText, CheckCircle, Settings, Layers, 
  Globe, FileCode, Terminal, History, Columns, Download, Sparkles, 
  Trash2, Clock, ExternalLink, FileDown, Eye, Settings2, Cpu, 
  Printer, ArrowLeftRight, Workflow, X, Info, FileStack, RefreshCw, AlertCircle
} from "lucide-react";
import { SourceFile, DocBuild, GeneratedDocSection, CustomDiagram, CompareSession } from "./types";
import { exportAsMarkdown, exportAsHTML, triggerDownload, computeDMPDiff } from "./utils";
import MermaidRenderer from "./components/MermaidRenderer";
import MarkdownView from "./components/MarkdownView";

export default function App() {
  // App primary States
  const [projectName, setProjectName] = useState<string>("Smart MCU Controller");
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  
  // GitHub Scraper states
  const [githubUrl, setGithubUrl] = useState<string>("");
  const [isScrapingGithub, setIsScrapingGithub] = useState<boolean>(false);

  // AI documentation generation states
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [loadingStepRef, setLoadingStepRef] = useState<string>("");
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  // Selection of targets for documentation build
  const [selectedSections, setSelectedSections] = useState<string[]>([
    "readme", "installation", "api", "component", "architecture", "circuit", "wiring", "developer", "manual", "inline"
  ]);

  // Current Documentation states
  const [currentBuild, setCurrentBuild] = useState<DocBuild | null>(null);
  const [history, setHistory] = useState<DocBuild[]>([]);
  
  // Active Workbench navigation
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"document" | "diagram" | "compare">("document");
  const [selectedDocId, setSelectedDocId] = useState<string>("readme");
  const [selectedDiagramId, setSelectedDiagramId] = useState<string>("architecture");

  // Version Comparison state
  const [compareSession, setCompareSession] = useState<CompareSession | null>(null);

  // Clean printable/IEEE template toggle
  const [isPrintLayoutMode, setIsPrintLayoutMode] = useState<boolean>(false);

  // Load custom history from server and localStorage on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        if (data.builds && data.builds.length > 0) {
          setHistory(data.builds);
          setCurrentBuild(data.builds[0]);
        }
      }
    } catch (err) {
      console.warn("Failed to contact API backend history. Loading client backup.");
      // Fallback local storage parse
      const saved = localStorage.getItem("autodoc_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        setHistory(parsed);
        if (parsed.length > 0) setCurrentBuild(parsed[0]);
      }
    }
  };

  // Safe file size converter
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Helper file info extractor
  const getFileInfo = (filepath: string): string => {
    const ext = filepath.split(".").pop()?.toLowerCase();
    if (!ext) return "other";
    
    if (["c", "cpp", "h", "hpp", "js", "jsx", "ts", "tsx", "py", "java", "rs", "go", "cs"].includes(ext)) {
      return "code";
    }
    if (ext === "ino" || ext === "pde") {
      return "code"; // Arduino is C++ code
    }
    if (["v", "sv", "vhd", "vhdl"].includes(ext)) {
      return "hdl"; // Verilog / VHDL
    }
    if (ext === "kicad_sch" || ext.includes("sch")) {
      return "schematic";
    }
    if (ext === "kicad_pcb" || ext.includes("pcb")) {
      return "board";
    }
    if (["md", "txt", "pdf", "docx"].includes(ext)) {
      return "doc";
    }
    return "other";
  };

  // Parse ZIP archive
  const handleZipFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoadingFiles(true);
    setFileLoadError(null);
    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);
      const promises: Promise<SourceFile>[] = [];

      loadedZip.forEach((relativePath, fileEntry) => {
        if (!fileEntry.dir) {
          // Reject binary artifacts & heavy bundle weights
          if (
            relativePath.includes("node_modules/") ||
            relativePath.includes(".git/") ||
            relativePath.includes("dist/") ||
            relativePath.includes(".next/") ||
            relativePath.includes("build/") ||
            relativePath.includes(".aistudio/") ||
            /\.(png|jpe?g|gif|webp|pdf|zip|tar|gz|mp3|mp4|exe|dll|so|dylib|bin|hex)$/i.test(relativePath)
          ) {
            return;
          }

          const promise = fileEntry.async("string").then((content) => {
            return {
              name: relativePath.split("/").pop() || relativePath,
              path: relativePath,
              content,
              size: content.length,
              type: getFileInfo(relativePath)
            };
          });
          promises.push(promise);
        }
      });

      const parsedFiles = await Promise.all(promises);
      if (parsedFiles.length === 0) {
        throw new Error("No readable text files extracted. Ensure repository contains code, HDL, KiCad, or config text files.");
      }
      setSourceFiles(parsedFiles);
      setSelectedFiles(parsedFiles.map(f => f.path));
      setProjectName(file.name.replace(/\.zip$/i, ""));
    } catch (err: any) {
      console.error(err);
      setFileLoadError(err.message || "Failed to process ZIP. Double check file integrity.");
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Upload flat code or KiCad schematics
  const handleFlatFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsLoadingFiles(true);
    setFileLoadError(null);

    try {
      const targetList: SourceFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Skip common binaries
        if (/\.(png|jpe?g|gif|webp|pdf|zip|tar|gz)$/i.test(file.name)) {
          continue;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string || "";
          targetList.push({
            name: file.name,
            path: file.name,
            content: content,
            size: file.size,
            type: getFileInfo(file.name)
          });
          
          if (targetList.length === files.length) {
            setSourceFiles(prev => [...prev, ...targetList]);
            setSelectedFiles(prev => [...prev, ...targetList.map(t => t.path)]);
          }
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      setFileLoadError("Failed to import individual engineering files.");
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Github Public Repo content fetcher on Client
  const handleScrapeGithub = async () => {
    if (!githubUrl || !githubUrl.includes("github.com/")) {
      setFileLoadError("Please enter a valid public GitHub URL. Example: github.com/username/repo");
      return;
    }
    
    setIsScrapingGithub(true);
    setFileLoadError(null);
    try {
      const parts = githubUrl.replace(/https?:\/\/(www\.)?github\.com\//i, "").split("/");
      if (parts.length < 2) throw new Error("Invalid schema. Enter username and project names correctly.");
      const username = parts[0];
      const repo = parts[1].replace(/\.git$/i, "");
      
      setProjectName(repo);

      // 1. Seek repo structure metadata
      const branchRes = await fetch(`https://api.github.com/repos/${username}/${repo}`);
      if (!branchRes.ok) throw new Error("Github api verification failed. Verify the public availability of this repository.");
      const repoMeta = await branchRes.json();
      const defaultBranch = repoMeta.default_branch || "main";

      // 2. Query file structure recursively
      const treeRes = await fetch(`https://api.github.com/repos/${username}/${repo}/git/trees/${defaultBranch}?recursive=1`);
      if (!treeRes.ok) throw new Error("Branch file-tree read failed. Rate limit exceeded or branch invalid.");
      const treeData = await treeRes.json();

      if (!treeData.tree || !Array.isArray(treeData.tree)) {
        throw new Error("No files discovered in repository reference.");
      }

      // Filter text files
      const textFiles = treeData.tree.filter((node: any) => {
        return node.type === "blob" && 
          !node.path.includes("node_modules/") &&
          !node.path.includes(".git/") &&
          !node.path.includes("dist/") &&
          !node.path.includes("build/") &&
          !node.path.includes(".next/") &&
          !/\.(png|jpe?g|gif|webp|pdf|zip|tar|gz|mp3|mp4|exe|dll|so|dylib|bin|hex)$/i.test(node.path);
      }).slice(0, 45); // Protect token contexts

      if (textFiles.length === 0) {
        throw new Error("No readable source files found inside the branch.");
      }

      const filePromises = textFiles.map(async (fileNode: any): Promise<SourceFile> => {
        const rawUrl = `https://raw.githubusercontent.com/${username}/${repo}/${defaultBranch}/${fileNode.path}`;
        const contentRes = await fetch(rawUrl);
        const content = contentRes.ok ? await contentRes.text() : `// Fetching error from github content: ${fileNode.path}`;
        
        return {
          name: fileNode.path.split("/").pop() || fileNode.path,
          path: fileNode.path,
          content,
          size: fileNode.size || content.length,
          type: getFileInfo(fileNode.path)
        };
      });

      const parsedSourceList = await Promise.all(filePromises);
      setSourceFiles(parsedSourceList);
      setSelectedFiles(parsedSourceList.map(p => p.path));
    } catch (err: any) {
      setFileLoadError(err.message || "Failed scraping specified Github repository.");
    } finally {
      setIsScrapingGithub(false);
    }
  };

  // Dynamic Toggle selection of individual file
  const toggleFileCheckbox = (path: string) => {
    setSelectedFiles(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleSelectAllFiles = () => {
    setSelectedFiles(sourceFiles.map(f => f.path));
  };

  const handleSelectNoneFiles = () => {
    setSelectedFiles([]);
  };

  const handleToggleDocSection = (sectionId: string) => {
    setSelectedSections(prev => 
      prev.includes(sectionId) ? prev.filter(s => s !== sectionId) : [...prev, sectionId]
    );
  };

  // Run AI analysis
  const handleAnalyzeProject = async () => {
    if (selectedFiles.length === 0) {
      setGenerationError("Choose at least one file to include in analysis workspace.");
      return;
    }

    setIsAnalyzing(true);
    setGenerationError(null);
    setLoadingStepRef("Bootstrapping firmware tokenizer...");

    // Stagger loading progress events for dynamic, realistic user engagement feedback
    const steps = [
      { text: "Scanning code symbols and dependencies...", ms: 1200 },
      { text: "Constructing physical/logical circuit netlists...", ms: 2400 },
      { text: "Formulating system pipeline representations...", ms: 3800 },
      { text: "Sending telemetry maps to Gemini AI context...", ms: 5200 },
      { text: "Structuring Mermaid topology flows...", ms: 7500 },
      { text: "Assembling final technical spec and guides...", ms: 9500 }
    ];

    steps.forEach(step => {
      setTimeout(() => {
        if (isAnalyzing) setLoadingStepRef(step.text);
      }, step.ms);
    });

    try {
      const activeFileList = sourceFiles.filter(f => selectedFiles.includes(f.path));
      
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          files: activeFileList,
          selectedSections
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Backend parsed exception.");
      }

      const data = await response.json();
      setCurrentBuild(data.build);
      setHistory(data.builds);
      
      // Save local backup sync
      localStorage.setItem("autodoc_history", JSON.stringify(data.builds));
      
      // Select the first active section
      const activeSections = data.build.sections.filter((s: any) => selectedSections.includes(s.id));
      if (activeSections.length > 0) {
        setSelectedDocId(activeSections[0].id);
      }
      
      setActiveWorkspaceTab("document");
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || "Engine timeout occurred during analysis. Try using fewer or smaller files.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch("/api/history/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.builds);
        localStorage.setItem("autodoc_history", JSON.stringify(data.builds));
        if (currentBuild?.id === id) {
          setCurrentBuild(data.builds[0] || null);
        }
      }
    } catch (err) {
      const remaining = history.filter(b => b.id !== id);
      setHistory(remaining);
      localStorage.setItem("autodoc_history", JSON.stringify(remaining));
      if (currentBuild?.id === id) {
        setCurrentBuild(remaining[0] || null);
      }
    }
  };

  // Exporters Triggers
  const triggerMarkdownDownload = () => {
    if (!currentBuild) return;
    const docText = exportAsMarkdown(currentBuild.projectName, currentBuild.sections, currentBuild.diagrams);
    triggerDownload(`${currentBuild.projectName.replace(/\s+/g, "_")}_Technical_Docs.md`, docText, "text/markdown");
  };

  const triggerHTMLDownload = () => {
    if (!currentBuild) return;
    const htmlText = exportAsHTML(currentBuild.projectName, currentBuild.sections, currentBuild.diagrams);
    triggerDownload(`${currentBuild.projectName.replace(/\s+/g, "_")}_Spec_Manual.html`, htmlText, "text/html");
  };

  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  const triggerXmlDocDownload = () => {
    if (!currentBuild) return;
    // Build standard formatted portable DOC format with matching table indices
    let xmlText = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
    xmlText += `<TechnicalManual project="${currentBuild.projectName}">\n`;
    currentBuild.sections.forEach(sec => {
      xmlText += `  <Section title="${sec.title}">\n`;
      xmlText += `    <Content>${escapeHtml(sec.content)}</Content>\n`;
      xmlText += `  </Section>\n`;
    });
    xmlText += `</TechnicalManual>`;
    triggerDownload(`${currentBuild.projectName.replace(/\s+/g, "_")}_Docx_Output.doc`, xmlText, "application/msword");
  };

  const triggerPdfPrint = () => {
    // Trigger standard browser system integrations of styled pages
    window.print();
  };

  // Quick reset simulator
  const handleResetWorkspace = () => {
    setSourceFiles([]);
    setSelectedFiles([]);
    setGithubUrl("");
    setFileLoadError(null);
  };

  // Generate beautiful file cards icons
  const getFileIcon = (type: string) => {
    switch (type) {
      case "code": return <FileCode className="w-4 h-4 text-emerald-400" />;
      case "hdl": return <Workflow className="w-4 h-4 text-purple-400" />;
      case "schematic": return <Cpu className="w-4 h-4 text-amber-400" />;
      case "board": return <Layers className="w-4 h-4 text-rose-450" />;
      case "doc": return <FileText className="w-4 h-4 text-teal-400" />;
      default: return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  // Count file categories
  const fileStats = {
    code: sourceFiles.filter(f => f.type === "code").length,
    hdl: sourceFiles.filter(f => f.type === "hdl").length,
    schematic: sourceFiles.filter(f => f.type === "schematic").length,
    board: sourceFiles.filter(f => f.type === "board").length,
    doc: sourceFiles.filter(f => f.type === "doc").length,
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 flex flex-col selection:bg-blue-600/20 selection:text-blue-800">
      
      {/* 1. Header Toolbar workspace */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur px-6 py-4 flex items-center justify-between no-print sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-lg text-white shadow-sm">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-black text-xl tracking-tight text-slate-900 uppercase">AutoDoc<span className="text-blue-600 font-extrabold">.</span>Engine</h1>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200">v1.4</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Automated Technical & Hardware Documentation Generator</p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-medium">
          {/* Status logs */}
          {process.env.GEMINI_API_KEY ? (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-250 rounded-full px-3 py-1 text-[11px] text-emerald-700 font-semibold font-mono">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span>Doc Engine Ready</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-250 rounded-full px-3 py-1 text-[11px] text-amber-700 font-semibold font-mono">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              <span>Doc Engine Ready</span>
            </div>
          )}

          {currentBuild && (
            <button
              onClick={triggerPdfPrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition text-xs border border-transparent font-bold cursor-pointer shadow-sm"
              title="Print System Manual"
              id="header-btn-print"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Spec Manual</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. Primary Layout Grid */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        
        {/* Left Hand: Controls Panel Container */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* File/Source upload dock */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
            <h2 className="font-display font-bold text-sm tracking-tight text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Upload className="w-4 h-4 text-blue-600" />
              <span>Input Sources Configurator</span>
            </h2>

            {/* Input options menu */}
            <div className="grid grid-cols-2 gap-3.5">
              
              {/* Option 1: ZIP Drag & Drop */}
              <label 
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50 p-4 rounded-lg transition-all duration-200 cursor-pointer group"
                id="label-zip-upload"
              >
                <input 
                  type="file" 
                  accept=".zip" 
                  onChange={handleZipFiles}
                  className="hidden" 
                />
                <FileStack className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition" />
                <span className="text-xs font-bold mt-1.5 text-slate-800">ZIP Repository</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Drop ZIP file</span>
              </label>

              {/* Option 2: Flat files upload */}
              <label 
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50 p-4 rounded-lg transition-all duration-200 cursor-pointer group"
                id="label-flat-upload"
              >
                <input 
                  type="file" 
                  multiple 
                  onChange={handleFlatFiles}
                  className="hidden" 
                />
                <Terminal className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition" />
                <span className="text-xs font-bold mt-1.5 text-slate-800">Individual Files</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Verilog, KiCad, Code</span>
              </label>
            </div>

            {/* GitHub Repo Puller Option */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex flex-col gap-2">
              <span className="text-[11px] font-mono text-slate-600 font-bold flex items-center gap-1.5">
                <Github className="w-3.5 h-3.5 text-slate-800" />
                <span>GitHub public URL reference</span>
              </span>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username/project"
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30 font-medium"
                  id="github-url-input"
                />
                <button
                  onClick={handleScrapeGithub}
                  disabled={isScrapingGithub || !githubUrl}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg px-3 text-xs transition cursor-pointer flex items-center gap-1"
                  id="github-scrape-btn"
                >
                  {isScrapingGithub ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <span>Scrape</span>
                  )}
                </button>
              </div>
            </div>

            {/* File load errors */}
            {fileLoadError && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
                <span>{fileLoadError}</span>
              </div>
            )}

            {/* Extracted file lists stats */}
            {sourceFiles.length > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                <span className="font-mono">{sourceFiles.length} files parsed</span>
                <span className="text-slate-300">|</span>
                <div className="flex gap-2 font-mono text-[10px]">
                  {fileStats.code > 0 && <span className="text-emerald-600">{fileStats.code} code</span>}
                  {fileStats.hdl > 0 && <span className="text-purple-600">{fileStats.hdl} HDL</span>}
                  {fileStats.schematic > 0 && <span className="text-amber-600">{fileStats.schematic} circ</span>}
                </div>
              </div>
            )}
          </section>

          {/* Repository Files Tree checklist */}
          {sourceFiles.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 max-h-[350px] overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-display font-bold text-sm tracking-tight text-slate-900 flex items-center gap-1.5">
                  <FolderTree className="w-4 h-4 text-blue-600" />
                  <span>Repository File List</span>
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={handleSelectAllFiles}
                    className="text-[10px] text-blue-600 hover:underline font-bold"
                    id="btn-select-all"
                  >
                    All
                  </button>
                  <span className="text-slate-300 text-[10px]">/</span>
                  <button 
                    onClick={handleSelectNoneFiles}
                    className="text-[10px] text-slate-500 hover:underline font-semibold"
                    id="btn-select-none"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Scrollable listing */}
              <div className="overflow-y-auto space-y-1.5 pr-2 flex-1">
                {sourceFiles.map((file, idx) => {
                  const isChecked = selectedFiles.includes(file.path);
                  return (
                    <div 
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-colors text-xs ${isChecked ? "bg-slate-50 border-slate-200" : "bg-transparent border-transparent opacity-65"}`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden mr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFileCheckbox(file.path)}
                          className="rounded border-slate-300 bg-slate-50 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                          id={`chk-file-${idx}`}
                        />
                        <span className="flex-shrink-0">{getFileIcon(file.type)}</span>
                        <span className="font-mono text-[11px] truncate text-slate-700" title={file.path}>
                          {file.path}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                        {formatSize(file.size)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px]">
                <span className="text-slate-500 font-medium">Included in analysis:</span>
                <span className="font-mono font-bold text-blue-600">{selectedFiles.length} / {sourceFiles.length} files</span>
              </div>
            </section>
          )}

          {/* Documentation Build Panel */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
            <h2 className="font-display font-bold text-sm tracking-tight text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Settings className="w-4 h-4 text-blue-600" />
              <span>Configure Target Elements</span>
            </h2>

            {/* Checklist of options to export */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: "readme", label: "README.md" },
                { id: "installation", label: "Installation Guide" },
                { id: "api", label: "API Reference" },
                { id: "component", label: "Component Spec" },
                { id: "architecture", label: "Architecture" },
                { id: "circuit", label: "Circuit Theory" },
                { id: "wiring", label: "Wiring pins" },
                { id: "developer", label: "Developer Guide" },
                { id: "manual", label: "User manual" },
                { id: "inline", label: "Inline comments" },
              ].map((section) => {
                const isActive = selectedSections.includes(section.id);
                return (
                  <button
                    key={section.id}
                    onClick={() => handleToggleDocSection(section.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors cursor-pointer ${isActive ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
                    id={`btn-target-${section.id}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-blue-600 animate-pulse" : "bg-slate-300"}`}></span>
                    <span className="truncate">{section.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Analysis triggers */}
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">Project Workspace Label</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Arduino Controller Spec, React Suite..."
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                  id="project-name-input"
                />
              </div>

              {generationError && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
                  <span>{generationError}</span>
                </div>
              )}

              <button
                onClick={handleAnalyzeProject}
                disabled={isAnalyzing || sourceFiles.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-2.5 rounded-lg text-xs transition duration-200 shadow-sm cursor-pointer text-center"
                id="btn-run-analysis"
              >
                {isAnalyzing ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span className="font-mono text-[11px] font-bold">Crunching codes...</span>
                  </div>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-blue-100" />
                    <span>Run AI Spec Compiler</span>
                  </>
                )}
              </button>

              {sourceFiles.length > 0 && (
                <button
                  onClick={handleResetWorkspace}
                  className="text-center text-[10px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer py-1"
                  id="btn-reset-workspace"
                >
                  Clear parsed repository files
                </button>
              )}
            </div>

            {/* Staggered load status card */}
            {isAnalyzing && (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 mt-1 flex flex-col gap-2 shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>Compilation Status</span>
                  <span className="animate-pulse text-blue-600 font-bold">active</span>
                </div>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                  {loadingStepRef || "Analyzing catalog files..."}
                </p>
                <div className="w-full bg-slate-100 rounded-full h-1.5 h-1.5 shadow-inner overflow-hidden">
                  <div className="bg-blue-600 h-full w-[70%] rounded-full"></div>
                </div>
              </div>
            )}
          </section>

          {/* Historic index tracking */}
          {history.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3 shadow-sm">
              <h3 className="font-display font-bold text-xs tracking-wider text-slate-500 uppercase flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <History className="w-4 h-4 text-blue-600" />
                <span>Documentation History</span>
              </h3>
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {history.map((buildItem) => {
                  const isActive = currentBuild?.id === buildItem.id;
                  return (
                    <div
                      key={buildItem.id}
                      onClick={() => setCurrentBuild(buildItem)}
                      className={`group p-2.5 rounded-lg border text-left transition cursor-pointer flex items-center justify-between ${isActive ? "bg-blue-50 border-blue-200 text-slate-900" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
                    >
                      <div className="overflow-hidden mr-2">
                        <p className="text-xs font-bold truncate text-slate-800">{buildItem.projectName}</p>
                        <span className="text-[9px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5 text-slate-400" />
                          {new Date(buildItem.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleDeleteHistory(buildItem.id, e)}
                          className="p-1 text-slate-400 hover:text-stone-900 transition"
                          title="Purge historical record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        </div>

        {/* Right Hand: Documentation Workbench view space */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Current Workspace content container */}
          {currentBuild ? (
            <div className="flex flex-col gap-6">
              
              {/* Build Meta specifications header block */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-mono bg-blue-50 uppercase font-bold">
                      {currentBuild.metadata.detectedType}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono font-medium">
                      {currentBuild.fileSummary.totalFiles} files analyzed
                    </span>
                  </div>
                  <h2 className="font-display font-black text-xl tracking-tight text-slate-900 mt-2">
                    {currentBuild.projectName} Spec Library
                  </h2>
                </div>

                {/* Badges specifications block */}
                <div className="flex gap-4 border-l border-slate-200 md:pl-6">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono uppercase block">Primary Language</span>
                    <span className="text-xs font-bold font-mono text-slate-700">{currentBuild.metadata.primaryLanguage}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono uppercase block">Estimated Complexity</span>
                    <span className="text-xs font-bold font-mono text-blue-600">{currentBuild.metadata.estimatedComplexity}</span>
                  </div>
                </div>
              </div>

              {/* Dynamic View Selector Menu */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                <div className="flex gap-4">
                  {[
                    { id: "document", label: "Spec Manual", icon: <FileText className="w-4 h-4" /> },
                    { id: "diagram", label: "Interactives / Diagrams", icon: <Layers className="w-4 h-4" /> },
                    { id: "compare", label: "Compare Versions", icon: <ArrowLeftRight className="w-4 h-4" /> },
                  ].map((tab) => {
                    const isSelected = activeWorkspaceTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveWorkspaceTab(tab.id as any)}
                        className={`flex items-center gap-1.5 pb-2.5 px-1 bg-transparent border-b-2 text-xs font-bold cursor-pointer transition ${isSelected ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-950"}`}
                        id={`btn-workspace-tab-${tab.id}`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Exporter Suite dropdown dock */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-450 font-bold hidden md:inline">Download:</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={triggerMarkdownDownload}
                      className="p-1 px-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 font-bold transition text-[11px] text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer shadow-sm"
                      title="Download as clean Markdown file"
                      id="btn-download-md"
                    >
                      <FileDown className="w-3.5 h-3.5 text-blue-600" />
                      <span>MD</span>
                    </button>
                    <button
                      onClick={triggerHTMLDownload}
                      className="p-1 px-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 font-bold transition text-[11px] text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer shadow-sm"
                      title="Download styled HTML webpage"
                      id="btn-download-html"
                    >
                      <Globe className="w-3.5 h-3.5 text-indigo-600" />
                      <span>HTML</span>
                    </button>
                    <button
                      onClick={triggerXmlDocDownload}
                      className="p-1 px-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 font-bold transition text-[11px] text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer shadow-sm"
                      title="Download DOCX layout file"
                      id="btn-download-doc"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      <span>DOCX</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* VIEW 1: Document Spec Manual */}
              {activeWorkspaceTab === "document" && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* Selector tabs left rail */}
                  <div className="md:col-span-3 flex flex-col gap-1">
                    {currentBuild.sections.map((sec) => (
                      <button
                        key={sec.id}
                        onClick={() => setSelectedDocId(sec.id)}
                        className={`text-left p-2.5 rounded-xl border text-[11px] font-bold transition-all relative truncate cursor-pointer ${selectedDocId === sec.id ? "bg-blue-50 border-blue-200 text-blue-600 pl-4 shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs"}`}
                        title={sec.description}
                        id={`btn-doc-sec-${sec.id}`}
                      >
                        {selectedDocId === sec.id && (
                          <span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-l-xl"></span>
                        )}
                        <span>{sec.title}</span>
                      </button>
                    ))}
                  </div>

                  {/* Active Document Viewer Area */}
                  <div className="md:col-span-9 bg-white border border-slate-200 p-8 doc-container rounded-xl shadow-xs min-h-[500px]">
                    {(() => {
                      const activeSec = currentBuild.sections.find(s => s.id === selectedDocId);
                      if (!activeSec) return null;
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-4 bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg justify-between">
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">
                              Section Manual
                            </span>
                            <span className="text-[10px] font-mono text-slate-450 truncate max-w-[200px] font-medium">
                              {activeSec.description}
                            </span>
                          </div>
                          
                          <MarkdownView content={activeSec.content} />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* VIEW 2: Visual Diagrams workspace */}
              {activeWorkspaceTab === "diagram" && (
                <div className="flex flex-col gap-6">
                  
                  {/* Category switcher */}
                  <div className="flex gap-2">
                    {currentBuild.diagrams.map((diag) => (
                      <button
                        key={diag.id}
                        onClick={() => setSelectedDiagramId(diag.id)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition ${selectedDiagramId === diag.id ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm"}`}
                        id={`btn-diagram-diag-${diag.id}`}
                      >
                        {diag.title}
                      </button>
                    ))}
                  </div>

                  {/* Active Mermaid canvas block */}
                  {(() => {
                    const activeDiag = currentBuild.diagrams.find(d => d.id === selectedDiagramId);
                    if (!activeDiag) return null;
                    return (
                      <div className="flex flex-col gap-3">
                        <div className="bg-slate-50 border border-slate-250 p-4 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Model Layer</span>
                            <span className="font-extrabold text-slate-900">{activeDiag.title}</span>
                          </div>
                          <p className="text-slate-600 text-right max-w-sm truncate text-[11px] font-mono font-medium">{activeDiag.description}</p>
                        </div>
                        
                        <MermaidRenderer code={activeDiag.code} id={activeDiag.id} />
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* VIEW 3: Version Comparison split diff */}
              {activeWorkspaceTab === "compare" && (
                <div className="flex flex-col gap-5">
                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-900">Interactive Line-Diff Comparator</span>
                    </div>

                    {/* Left & Right selection picks */}
                    <div className="flex gap-2 text-xs">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold font-mono text-slate-400 uppercase">Baseline Manual</span>
                        <select
                          className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 outline-none text-xs font-semibold focus:ring-1 focus:ring-blue-500/20"
                          value={compareSession?.leftBuildId || currentBuild.id}
                          onChange={(e) => setCompareSession(prev => ({
                            leftBuildId: e.target.value,
                            rightBuildId: prev?.rightBuildId || currentBuild.id,
                            selectedSectionId: prev?.selectedSectionId || "readme"
                          }))}
                          id="select-base-doc"
                        >
                          {history.map(b => (
                            <option key={b.id} value={b.id}>{b.projectName} ({new Date(b.timestamp).toLocaleDateString()})</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold font-mono text-slate-400 uppercase">Target Manual</span>
                        <select
                          className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 outline-none text-xs font-semibold focus:ring-1 focus:ring-blue-500/20"
                          value={compareSession?.rightBuildId || (history[1]?.id || currentBuild.id)}
                          onChange={(e) => setCompareSession(prev => ({
                            leftBuildId: prev?.leftBuildId || currentBuild.id,
                            rightBuildId: e.target.value,
                            selectedSectionId: prev?.selectedSectionId || "readme"
                          }))}
                          id="select-target-doc"
                        >
                          {history.map(b => (
                            <option key={b.id} value={b.id}>{b.projectName} ({new Date(b.timestamp).toLocaleDateString()})</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold font-mono text-slate-400 uppercase">Section Target</span>
                        <select
                          className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 outline-none text-xs font-semibold focus:ring-1 focus:ring-blue-500/20"
                          value={compareSession?.selectedSectionId || "readme"}
                          onChange={(e) => setCompareSession(prev => ({
                            leftBuildId: prev?.leftBuildId || currentBuild.id,
                            rightBuildId: prev?.rightBuildId || currentBuild.id,
                            selectedSectionId: e.target.value
                          }))}
                          id="select-section-target"
                        >
                          <option value="readme">README.md</option>
                          <option value="installation">Installation</option>
                          <option value="api">API Reference</option>
                          <option value="component">Component Spec</option>
                          <option value="architecture">Architecture</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Split visual columns mapping */}
                  {(() => {
                    const leftId = compareSession?.leftBuildId || currentBuild.id;
                    const rightId = compareSession?.rightBuildId || (history[1]?.id || currentBuild.id);
                    const sectionTarget = compareSession?.selectedSectionId || "readme";

                    const leftBuild = history.find(h => h.id === leftId) || currentBuild;
                    const rightBuild = history.find(h => h.id === rightId) || currentBuild;

                    const leftSec = leftBuild.sections.find(s => s.id === sectionTarget)?.content || "";
                    const rightSec = rightBuild.sections.find(s => s.id === sectionTarget)?.content || "";

                    const lineDiff = computeDMPDiff(leftSec, rightSec);

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                        
                        <div className="flex flex-col border-r border-slate-100">
                          <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 border-b border-slate-150">
                            Baseline: {leftBuild.projectName}
                          </div>
                          <div className="p-4 overflow-y-auto max-h-[550px] space-y-1 font-mono text-[11px] leading-relaxed select-text">
                            {leftSec.split("\n").map((line, idx) => (
                              <div key={idx} className="whitespace-pre truncate px-1 hover:bg-slate-50 transition-colors">
                                <span className="text-slate-400 inline-block w-6 text-right select-none pr-1.5">{idx + 1}</span>
                                <span className="text-slate-800">{line || " "}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col">
                          <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 border-b border-slate-150">
                            Updates with Line Annotations (Diff Map)
                          </div>
                          <div className="p-4 overflow-y-auto max-h-[550px] space-y-1 font-mono text-[11px] leading-relaxed select-text">
                            {lineDiff.map((item, idx) => {
                              let bgClass = "";
                              let indicator = " ";
                              if (item.type === "add") {
                                bgClass = "bg-emerald-50 border-l-2 border-emerald-500 py-0.5";
                                indicator = "+";
                              } else if (item.type === "delete") {
                                bgClass = "bg-rose-50 border-l-2 border-rose-450 py-0.5 line-through opacity-70";
                                indicator = "-";
                              }
                              return (
                                <div key={idx} className={`whitespace-pre select-text px-1 flex ${bgClass}`}>
                                  <span className="text-slate-400 inline-block w-8 text-right select-none pr-1.5 font-mono">{idx + 1}</span>
                                  <span className="mr-1.5 w-3 block text-center select-none text-slate-400 font-mono">{indicator}</span>
                                  <span className={item.type === "add" ? "text-emerald-800 font-bold" : item.type === "delete" ? "text-rose-800 font-medium" : "text-slate-800"}>
                                    {item.val || " "}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    );
                  })()}
                </div>
              )}

            </div>
          ) : (
            // Empty Workbench onboarding manual
            <div className="bg-white border border-slate-205 rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[500px] shadow-sm">
              <div className="bg-slate-50 p-4 rounded-full text-blue-600 border border-slate-150 mb-6">
                <FileCode className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="font-display font-black text-xl tracking-tight text-slate-900 mb-2 uppercase">
                Compile High-Grade Hardware & Software Spec Manuals
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-8 font-medium">
                Include files of code repositories, KiCad circuit schematics nets, FPGA Verilog models, MCU parameters, or PDFs. Choose documentation targets and compilation goals above to generate beautiful layouts.
              </p>

              {/* Quick try simulator templates */}
              <div className="border border-slate-200 p-6 rounded-xl max-w-xl w-full bg-slate-50 shadow-xs">
                <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600 font-extrabold mb-3 block">
                  Quickstart sandbox templates
                </span>
                <p className="text-[11px] text-slate-500 mb-4 font-mono font-medium">
                  Select a simulation profile if you do not have files at hand. We will populate mock file buffers for direct technical compiler demonstration:
                </p>
                
                <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                  <button
                    onClick={() => {
                      setProjectName("KiCad Controller Board");
                      setSourceFiles([
                        { name: "main.sch", path: "main.sch", content: "KICAD SCHEMATIC v4 FILE\nMCU: ATmega328P-AU\nREG: LDO SPX1117-5V\nCAP: 22pF, 0.1uF decouple\nPINS:\nMCU D2 -> Event Alert\nMCU D3 -> H-Bridge PWM A\nMCU D4 -> Speed Phase Offset\nMCU A4 -> SDA (I2C Sensor Address 0x68)\nMCU A5 -> SCL (I2C Bus Clock)", size: 400, type: "schematic" },
                        { name: "pins.h", path: "pins.h", content: "#define PIN_ALERT 2\n#define PIN_MOTOR_A 3\n#define PIN_MOTOR_B 4\n#define ADC_SENSOR 0x68", size: 100, type: "code" }
                      ]);
                      setSelectedFiles(["main.sch", "pins.h"]);
                    }}
                    className="p-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-950 rounded-lg shadow-sm font-semibold transition text-left flex flex-col gap-1 cursor-pointer"
                    id="btn-sandbox-kicad"
                  >
                    <span className="text-amber-600 font-mono text-[10px] font-bold">📟 Schematic Module</span>
                    <span>KiCad ATmega Control</span>
                  </button>

                  <button
                    onClick={() => {
                      setProjectName("FPGA Verilog ALU Core");
                      setSourceFiles([
                        { name: "alu.v", path: "alu.v", content: "module alu(input [7:0] a, b, input [1:0] op, output reg [7:0] out, output zero);\nalways @(*) begin\n  case(op)\n    2'b00: out = a + b;\n    2'b01: out = a - b;\n    default: out = 8'h00;\n  endcase\nend\nassign zero = (out == 8'h00);\nendmodule", size: 600, type: "hdl" },
                        { name: "alu_tb.v", path: "alu_tb.v", content: "module tb_alu;\nreg [7:0] a, b;\nreg [1:0] op;\nwire [7:0] out;\ninitial begin\n  a = 15; b = 10; op = 0;\n  #10 op = 1;\nend\nendmodule", size: 300, type: "hdl" }
                      ]);
                      setSelectedFiles(["alu.v", "alu_tb.v"]);
                    }}
                    className="p-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-950 rounded-lg shadow-sm font-semibold transition text-left flex flex-col gap-1 cursor-pointer"
                    id="btn-sandbox-hdl"
                  >
                    <span className="text-purple-600 font-mono text-[10px] font-bold">⚙ Hardware Description</span>
                    <span>Verilog ALU System</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* 4. Full-Screen Print Layout Model for crisp PDF Print views */}
      {isPrintLayoutMode && currentBuild && (
        <div className="absolute inset-0 bg-white text-black p-12 select-text pointer-events-auto" style={{ zIndex: 999999 }}>
          <div className="max-w-[700px] mx-auto text-black font-serif select-text">
            
            {/* Standard Cover Page with ISO structure */}
            <div className="h-screen flex flex-col justify-between border-4 border-black p-12 text-center select-text">
              <div>
                <p className="text-sm font-mono tracking-widest uppercase">INTERNATIONAL ENGINEERING SYSTEM SPECIFICATION</p>
                <div className="w-16 h-1 bg-black mx-auto my-6"></div>
              </div>

              <div>
                <h1 className="text-4xl font-bold uppercase tracking-tight font-sans text-stone-900">
                  {currentBuild.projectName}
                </h1>
                <p className="text-lg italic mt-4 text-stone-600">Complete Hardware & Software Technical Spec manual</p>
              </div>

              <div>
                <p className="text-sm font-mono uppercase">COMPILED AUTOMATICALLY BY GEOMETRIC AUTODOC SUITE</p>
                <p className="text-xs text-stone-500 mt-2">TIMESTAMP REFERENCE: {new Date(currentBuild.timestamp).toUTCString()}</p>
                
                <button 
                  onClick={() => setIsPrintLayoutMode(false)}
                  className="bg-black text-white px-4 py-2 mt-6 rounded no-print text-xs hover:bg-stone-800"
                >
                  Exit Print Preview Model
                </button>
              </div>
            </div>

            {/* Loop print compilation list */}
            {currentBuild.sections.map((sec, idx) => (
              <div key={sec.id} className="print-page-break select-text py-12 border-t-2 border-stone-100 first:border-0">
                <span className="text-[10px] font-sans text-stone-400 block tracking-wider uppercase font-semibold">
                  SECTION {idx + 1} OF {currentBuild.sections.length}
                </span>
                <h2 className="text-2xl font-bold font-sans tracking-tight text-stone-900 border-b border-stone-200 pb-2.5 mt-2 mb-6">
                  {sec.title}
                </h2>
                
                <div className="select-text whitespace-pre-wrap leading-relaxed text-sm text-stone-800 font-serif">
                  {sec.content}
                </div>
              </div>
            ))}

          </div>
        </div>
      )}

      {/* Footer credits no-print */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 no-print mt-auto shadow-sm">
        <p className="font-semibold text-slate-600">AutoDoc Technical Manual Space. Powered by Gemini Core.</p>
        <p className="flex items-center gap-1.5 mt-2 sm:mt-0 font-bold text-slate-750">
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
          <span>Online Sandbox Node stable</span>
        </p>
      </footer>

    </div>
  );
}
