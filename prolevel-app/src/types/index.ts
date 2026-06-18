export interface AddSettings {
  numFields: number;
  contents: string[];
  baseValues: number[];
  mode: 'alternative' | 'sequential' | 'continuous';
  // Optional: tags to exclude from Add insertion (e.g. ['h1','h2'])
  excludeHeadingTags?: string[];
}

export interface ReplaceSettings {
  numFind: number;
  numReplace: number;
  finds: string[];
  replaces: string[];
}

export interface ProcessedItem {
  id: number;
  title: string;
  sourceTitle: string;
  // Optional user-provided content to be used as the source for rewriting
  givenContent?: string;
  content: string;
  // Full generated HTML (kept separate so UI can show an excerpt by default)
  generatedContent?: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMsg?: string;
}

export interface GenerateRequestBody {
  prompt: string;
  apiKey?: string;
}

export interface GenerateResponseBody {
  title: string;
  content: string;
}

export interface GenerateErrorBody {
  error: string;
}

export interface StickyNote {
  id: string | number;
  title: string;
  color?: string;
  titleHistory?: string[];
  titleHistoryIndex?: number;
  // Optional UI / runtime fields used by the floating note component
  x?: number;
  y?: number;
  zIndex?: number;
  content?: string;
  // whether the note is currently shown as a floating sticky (true) or hidden (false)
  visible?: boolean;
}

export interface UrlWindow {
  id: string;
  url?: string;
}
