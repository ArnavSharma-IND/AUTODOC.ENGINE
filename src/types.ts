/**
 * Automated Technical Documentation Generator Domain Types
 */

export interface SourceFile {
  name: string;
  path: string;
  content: string;
  size: number;
  type: string; // 'code' | 'schematic' | 'board' | 'hdl' | 'doc' | 'other'
}

export interface ProjectMetadata {
  detectedType: string;         // e.g., "Embedded Arduino Project", "Web React App", "KiCad PCB Design"
  primaryLanguage: string;      // e.g., "C++", "TypeScript", "Verilog", "KiCad Scheme"
  estimatedComplexity: string;  // "Low" | "Medium" | "High"
  modules: Array<{
    name: string;
    description: string;
    files: string[];
  }>;
  dependencies: Array<{
    name: string;
    version?: string;
    type: 'internal' | 'external';
  }>;
}

export interface GeneratedDocSection {
  id: string;               // e.g., "readme", "installation", "api", "component", "architecture", "circuit", "wiring", "developer", "manual", "inline"
  title: string;            // Tab title
  content: string;          // Generated Markdown content
  description: string;      // Short description of this template
}

export interface CustomDiagram {
  id: string;               // e.g., "architecture", "flowchart", "dependency"
  title: string;
  type: 'architecture' | 'flowchart' | 'dependency';
  code: string;             // Mermaid diagram code
  description: string;
}

export interface DocBuild {
  id: string;
  projectName: string;
  timestamp: string;
  metadata: ProjectMetadata;
  sections: GeneratedDocSection[];
  diagrams: CustomDiagram[];
  fileSummary: {
    totalFiles: number;
    parsedFilesCount: number;
    fileTypes: Record<string, number>;
  };
}

export interface CompareSession {
  leftBuildId: string;
  rightBuildId: string;
  selectedSectionId: string;
}
