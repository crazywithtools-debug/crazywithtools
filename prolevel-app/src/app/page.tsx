"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  Trash2,
  Download,
  Clipboard,
} from 'lucide-react';
// jsPDF is dynamically imported where needed to avoid bundling cost
import { applyAddOperation, applyReplaceOperation, cleanOutputHtml } from '@/lib/text-processor';
import Sidebar from '@/components/Sidebar';
import RightPanel from '@/components/RightPanel';
import MainEditor from '@/components/MainEditor';
import StickyNote from '@/components/StickyNote';
import type { AddSettings, ReplaceSettings, StickyNote as StickyNoteType } from '@/types';
import dynamic from 'next/dynamic';
import { BUTTON_BG_COLOR, BUTTON_TEXT_COLOR, THEME_COLOR } from '@/lib/utils';

const AdPlaceholder = dynamic(() => import('@/components/AdPlaceholder'), { ssr: false });
const AIContentGenerator = dynamic(() => import('@/components/AIContentGenerator'), { ssr: false });

export default function HomePage(): JSX.Element {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState('');
  const [editorHtml, setEditorHtml] = useState('');
  const [processedOutputHtml, setProcessedOutputHtml] = useState('');

  const [isAddEnabled, setIsAddEnabled] = useState(false);
  const [isReplaceEnabled, setIsReplaceEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<'success' | 'error' | 'info'>('info');

  const [addSettings, setAddSettings] = useState<AddSettings>({
    numFields: 1,
    contents: [''],
    baseValues: [16],
    mode: 'alternative',
  });

  const [replaceSettings, setReplaceSettings] = useState<ReplaceSettings>({
    numFind: 1,
    numReplace: 1,
    finds: [''],
    replaces: [''],
  });

  const updateReplaceRowCount = (count: number) => {
    const c = Math.max(1, isNaN(count) ? 1 : count);
    setReplaceSettings((prev) => {
      const finds = prev.finds.slice(0, c);
      while (finds.length < c) finds.push('');
      const replaces = prev.replaces.slice(0, c);
      while (replaces.length < c) replaces.push('');
      return { ...prev, numFind: c, numReplace: c, finds, replaces };
    });
  };
  ;

  // Sidebar active tools (allow multiple selections)
  const [activeTools, setActiveTools] = useState<{ add?: boolean; replace?: boolean; ai?: boolean; sticky?: boolean; edit?: boolean }>({ add: false, replace: false, ai: false, sticky: false, edit: false });
  const [stickyNotes, setStickyNotes] = useState<StickyNoteType[]>([]);
  const [highestZIndex, setHighestZIndex] = useState<number>(1000);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false);

  // Local storage keys
  const LS_KEYS = {
    ACTIVE_TOOLS: 'home_active_tools',
    ADD_SETTINGS: 'home_add_settings',
    REPLACE_SETTINGS: 'home_replace_settings',
    TITLE: 'home_title',
    STICKY_NOTES: 'home_sticky_notes',
    SIDEBAR_COLLAPSED: 'home_sidebar_collapsed',
    EDITOR_CONTENT: 'home_editor_content',
  } as const;

  // Load persisted state on mount
  useEffect(() => {
    try {
      const savedActive = localStorage.getItem(LS_KEYS.ACTIVE_TOOLS);
      if (savedActive) setActiveTools(JSON.parse(savedActive));

      const savedAdd = localStorage.getItem(LS_KEYS.ADD_SETTINGS);
      if (savedAdd) {
        const parsed = JSON.parse(savedAdd);
        // Ensure loaded addSettings conform to mode rules: when loading, if mode === 'alternative' ensure baseValues is single-element
        setAddSettings((prev) => {
          const merged = { ...prev, ...parsed } as AddSettings;
          if (merged.mode === 'alternative' || merged.numFields === 1) {
            merged.baseValues = [merged.baseValues?.[0] ?? 16];
          } else if (merged.mode === 'sequential') {
            merged.baseValues = (merged.baseValues || []).slice(0, merged.numFields);
            while (merged.baseValues.length < merged.numFields) merged.baseValues.push(merged.baseValues[merged.baseValues.length - 1] ?? 16);
          }
          return merged;
        });
      }

      const savedReplace = localStorage.getItem(LS_KEYS.REPLACE_SETTINGS);
      if (savedReplace) {
        const parsed = JSON.parse(savedReplace);
        setReplaceSettings((prev) => ({ ...prev, ...parsed }));
      }

      const savedTitle = localStorage.getItem(LS_KEYS.TITLE);
      if (savedTitle) setTitle(savedTitle);

      const savedNotes = localStorage.getItem(LS_KEYS.STICKY_NOTES);
      if (savedNotes) {
        try {
          const parsed = JSON.parse(savedNotes);
          if (Array.isArray(parsed)) {
            if (parsed.length === 0) {
              setStickyNotes([]);
            } else if (typeof parsed[0] === 'string') {
              const notes = parsed.map((s: string, i: number) => ({ id: `note_${i}_${Date.now()}`, title: s, color: '#f59e0b', titleHistory: [s], titleHistoryIndex: 0, x: 60 + i * 24, y: 80 + i * 24, zIndex: 1000 + i, content: '', visible: true }));
              setStickyNotes(notes);
              setHighestZIndex(notes.reduce((m, n) => Math.max(m, n.zIndex || 0), 1000));
            } else {
              // Ensure any persisted notes have runtime fields
              const notes = parsed.map((n: any, i: number) => ({ x: n.x ?? 60 + i * 24, y: n.y ?? 80 + i * 24, zIndex: typeof n.zIndex === 'number' ? n.zIndex : 1000 + i, content: n.content ?? '', visible: typeof n.visible === 'boolean' ? n.visible : true, ...n }));
              setStickyNotes(notes);
              setHighestZIndex(notes.reduce((m, n) => Math.max(m, n.zIndex || 0), 1000));
            }
          }
        } catch (e) {
          // ignore
        }
      }

      const savedCollapsed = localStorage.getItem(LS_KEYS.SIDEBAR_COLLAPSED);
      if (savedCollapsed) {
        try { setSidebarCollapsed(JSON.parse(savedCollapsed)); } catch {}
      }

      // url windows removed

      const savedEditor = localStorage.getItem(LS_KEYS.EDITOR_CONTENT);
      if (savedEditor && editorRef.current) {
        editorRef.current.innerHTML = savedEditor;
        setEditorHtml(savedEditor);
      }
    } catch (err) {
      // ignore localStorage errors
      // logging via logger; swallow noisy console in production
      // console.warn(err);
    }
  }, []);

  // Persist relevant pieces of state
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.ACTIVE_TOOLS, JSON.stringify(activeTools));
    } catch {}
  }, [activeTools]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.ADD_SETTINGS, JSON.stringify(addSettings));
    } catch {}
  }, [addSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.REPLACE_SETTINGS, JSON.stringify(replaceSettings));
    } catch {}
  }, [replaceSettings]);

  useEffect(() => {
    try {
      if (title) localStorage.setItem(LS_KEYS.TITLE, title);
      else localStorage.removeItem(LS_KEYS.TITLE);
    } catch {}
  }, [title]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.STICKY_NOTES, JSON.stringify(stickyNotes));
    } catch {}
  }, [stickyNotes]);

  // Ensure sticky notes and editor content are persisted on page unload/visibility change
  useEffect(() => {
    const persistNow = () => {
      try {
        localStorage.setItem(LS_KEYS.STICKY_NOTES, JSON.stringify(stickyNotes));
        localStorage.setItem(LS_KEYS.EDITOR_CONTENT, editorHtml || '');
        if (title) localStorage.setItem(LS_KEYS.TITLE, title);
      } catch (e) {
        /* ignore */
      }
    };

    window.addEventListener('beforeunload', persistNow);
    window.addEventListener('pagehide', persistNow);

    return () => {
      window.removeEventListener('beforeunload', persistNow);
      window.removeEventListener('pagehide', persistNow);
    };
  }, [stickyNotes, editorHtml, title]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.EDITOR_CONTENT, editorHtml || '');
    } catch {}
  }, [editorHtml]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.SIDEBAR_COLLAPSED, JSON.stringify(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);

  // url windows removed

  // Sync editor DOM to state only when they differ to avoid caret/selection jumps
  useEffect(() => {
    if (!editorRef.current) return;
    const desired = editorHtml || '';
    if (editorRef.current.innerHTML !== desired) {
      editorRef.current.innerHTML = desired;
    }
  }, [editorHtml]);

  const generateId = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

  const pickColor = () => {
    const palette = ['#ef4444','#f97316','#f59e0b','#10b981','#3b82f6','#8b5cf6'];
    return palette[Math.floor(Math.random() * palette.length)];
  };

  // Convert plain text (newlines) to simple HTML paragraphs preserving line breaks.
  const plainTextToHtml = (input: string) => {
    if (!input) return '';
    // If content already looks like HTML, return as-is
    if (/<[a-z][\s\S]*>/i.test(input)) return input;
    return input
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  };

  const handleToolToggle = (tool: string) => {
    setActiveTools((prev) => {
      switch (tool) {
        case 'replace': return { ...prev, replace: !prev.replace };
        case 'add': return { ...prev, add: !prev.add };
        case 'edit': return { ...prev, edit: !prev.edit };
        case 'aiContent': return { ...prev, ai: !prev.ai };
        case 'stickyNotes': return { ...prev, sticky: !prev.sticky };
        default: return prev;
      }
    });
    // Close mobile toolbar after selecting a tool on small screens
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileToolbarOpen(false);
    }
  };

  const handleAddNote = () => {
    const newNote: StickyNoteType = { id: generateId('note'), title: 'New note', color: pickColor(), titleHistory: ['New note'], titleHistoryIndex: 0, x: 80, y: 80, zIndex: highestZIndex + 1, content: '', visible: true };
    setStickyNotes((prev) => [newNote, ...prev]);
    setHighestZIndex((h) => h + 1);
    flashStatus('Note added', 1200, 'success');
  };

  const handleClearAllNotes = () => {
    setStickyNotes([]);
    flashStatus('All notes cleared', 1200, 'info');
  };

  const handleOpenNote = (id: string | number) => {
    const note = stickyNotes.find((n) => n.id === id);
    if (!note) return;
    // ensure the note is visible and brought to front
    setStickyNotes((prev) => {
      const nextZ = highestZIndex + 1;
      const updated = prev.map((n) => n.id === id ? { ...n, visible: true, zIndex: nextZ } : n);
      setHighestZIndex(nextZ);
      return updated;
    });
    setTitle(note.title);
    if (editorRef.current) {
      editorRef.current.innerHTML = note.title;
      setEditorHtml(note.title);
    }
  };

  // Close (hide) a floating sticky note — do not delete it from storage
  const handleCloseNote = (id: string | number) => {
    setStickyNotes((prev) => prev.map((n) => (n.id === id ? { ...n, visible: false } : n)));
    flashStatus('Note closed', 700, 'info');
  };

  const handleDeleteNote = (id: string | number) => {
    setStickyNotes((prev) => prev.filter((n) => n.id !== id));
    flashStatus('Note deleted', 1000, 'info');
  };

  const handleUpdateNote = (id: string | number, patch: Partial<StickyNoteType>) => {
    setStickyNotes((prev) => prev.map((n) => n.id === id ? { ...n, ...patch } : n));
  };

  const handleBringToFront = (id: string | number) => {
    setHighestZIndex((prev) => {
      const next = prev + 1;
      setStickyNotes((notes) => notes.map((n) => n.id === id ? { ...n, zIndex: next } : n));
      return next;
    });
  };

  const handleRenameNote = (id: string | number, newTitle: string) => {
    setStickyNotes((prev) => prev.map((n) => {
      if (n.id !== id) return n;
      const prevHistory = n.titleHistory ? n.titleHistory.slice(0, (n.titleHistoryIndex ?? 0) + 1) : [n.title];
      const newHistory = [...prevHistory, newTitle];
      const newIndex = newHistory.length - 1;
      return { ...n, title: newTitle, titleHistory: newHistory, titleHistoryIndex: newIndex };
    }));
    flashStatus('Note renamed', 900, 'info');
  };

  const handleUndoRename = (id: string | number) => {
    setStickyNotes((prev) => prev.map((n) => {
      if (n.id !== id) return n;
      const idx = n.titleHistoryIndex ?? (n.titleHistory?.length ?? 1) - 1;
      if (!n.titleHistory || idx <= 0) return n;
      const newIndex = Math.max(0, idx - 1);
      return { ...n, title: n.titleHistory[newIndex], titleHistoryIndex: newIndex };
    }));
  };

  const handleRedoRename = (id: string | number) => {
    setStickyNotes((prev) => prev.map((n) => {
      if (n.id !== id) return n;
      const idx = n.titleHistoryIndex ?? (n.titleHistory?.length ?? 1) - 1;
      if (!n.titleHistory || idx >= n.titleHistory.length - 1) return n;
      const newIndex = Math.min(n.titleHistory.length - 1, idx + 1);
      return { ...n, title: n.titleHistory[newIndex], titleHistoryIndex: newIndex };
    }));
  };

  // Add settings helpers
  const handleAddNewField = () => {
    setAddSettings((prev) => {
      const num = prev.numFields + 1;
      const contents = [...prev.contents, ''];
      let baseValues: number[] = [];
      if (prev.mode === 'sequential') {
        baseValues = [...(prev.baseValues || []), prev.baseValues?.[prev.baseValues.length - 1] ?? 16];
      } else if (prev.mode === 'alternative') {
        baseValues = [prev.baseValues?.[0] ?? 16];
      } else {
        baseValues = [];
      }
      return { ...prev, numFields: num, contents, baseValues };
    });
  };

  const handleRemoveNewField = (index: number) => {
    if (addSettings.numFields <= 1) return;
    setAddSettings((prev) => {
      const contents = prev.contents.filter((_, i) => i !== index);
      let baseValues: number[] = [];
      if (prev.mode === 'sequential') {
        baseValues = prev.baseValues.filter((_, i) => i !== index);
      } else if (prev.mode === 'alternative') {
        baseValues = [prev.baseValues?.[0] ?? 16];
      } else {
        baseValues = [];
      }
      return { ...prev, numFields: prev.numFields - 1, contents, baseValues };
    });
  };

  const handleContentChange = (index: number, value: string) => {
    setAddSettings((prev) => {
      const next = [...prev.contents];
      next[index] = value;
      return { ...prev, contents: next };
    });
  };

  const handleBaseValueChange = (index: number, value: string) => {
    setAddSettings((prev) => {
      const parsed = parseInt(value, 10);
      const val = isNaN(parsed) ? 1 : parsed;
      if (prev.mode === 'alternative' || prev.numFields === 1) {
        return { ...prev, baseValues: [val] };
      }
      const next = [...(prev.baseValues || [])];
      next[index] = val;
      return { ...prev, baseValues: next };
    });
  };

  const updateAddFieldCount = (count: number) => {
    const c = Math.max(1, isNaN(count) ? 1 : count);
    setAddSettings((prev) => {
      const contents = prev.contents.slice(0, c);
      while (contents.length < c) contents.push('');
      let baseValues: number[] = [];
      if (prev.mode === 'sequential') {
        baseValues = (prev.baseValues || []).slice(0, c);
        while (baseValues.length < c) baseValues.push(baseValues[baseValues.length - 1] ?? 16);
      } else if (prev.mode === 'alternative' || c === 1) {
        baseValues = [prev.baseValues?.[0] ?? 16];
      } else {
        baseValues = [];
      }
      return { ...prev, numFields: c, contents, baseValues };
    });
  };

  // Replace settings helpers
  const handleAddReplaceRow = () => {
    setReplaceSettings((prev) => ({
      ...prev,
      numFind: prev.numFind + 1,
      numReplace: prev.numReplace + 1,
      finds: [...prev.finds, ''],
      replaces: [...prev.replaces, ''],
    }));
  };

  const handleRemoveReplaceRow = (index: number) => {
    if (replaceSettings.numFind <= 1) return;
    setReplaceSettings((prev) => ({
      ...prev,
      numFind: prev.numFind - 1,
      numReplace: prev.numReplace - 1,
      finds: prev.finds.filter((_, i) => i !== index),
      replaces: prev.replaces.filter((_, i) => i !== index),
    }));
  };

  const handleFindChange = (index: number, value: string) => {
    setReplaceSettings((prev) => {
      const next = [...prev.finds];
      next[index] = value;
      return { ...prev, finds: next };
    });
  };

  const handleReplaceChange = (index: number, value: string) => {
    setReplaceSettings((prev) => {
      const next = [...prev.replaces];
      next[index] = value;
      return { ...prev, replaces: next };
    });
  };

  const handleApplyAdd = () => {
    const current = editorRef.current ? editorRef.current.innerHTML : '';
    if (!current) return flashStatus('No content to apply Add operation to.', 2000, 'error');
    const result = applyAddOperation(current, addSettings);
    if (editorRef.current) editorRef.current.innerHTML = result;
    setEditorHtml(result);
    flashStatus('Inserted configured snippets into the document.', 2000, 'success');
  };

  const handleApplyReplace = () => {
    const current = editorRef.current ? editorRef.current.innerHTML : '';
    if (!current) return flashStatus('No content to apply Replace operation to.', 2000, 'error');
    const result = applyReplaceOperation(current, replaceSettings);
    if (editorRef.current) editorRef.current.innerHTML = result;
    setEditorHtml(result);
    flashStatus('Find & Replace applied to the document.', 2000, 'success');
  };

  // Simple formatting for the editable region
  const handleFormat = (cmd: 'bold' | 'italic' | 'underline') => {
    try {
      document.execCommand(cmd);
      flashStatus('Format applied.', 900, 'info');
    } catch (e) {
      import('@/lib/logger').then(({ error: logError }) => logError(e)).catch(() => {});
      flashStatus('Formatting failed.', 1200, 'error');
    }
  };

  const flashStatus = (msg: string, ms = 3000, type: 'success' | 'error' | 'info' = 'info') => {
    setTriggerStatus(msg);
    setTriggerType(type);
    setTimeout(() => setTriggerStatus(null), ms);
  };

  const handleToggleAddEnabled = (val: boolean) => {
    setIsAddEnabled(val);
    // Do not auto-close panels when toggling pipeline enable; user controls selection explicitly
    flashStatus(val ? 'Add pipeline enabled' : 'Add pipeline disabled', 1600, 'info');
  };

  const handleToggleReplaceEnabled = (val: boolean) => {
    setIsReplaceEnabled(val);
    // Do not auto-close panels when toggling pipeline enable; user controls selection explicitly
    flashStatus(val ? 'Replace pipeline enabled' : 'Replace pipeline disabled', 1600, 'info');
  };

  // Sync pipeline enabled state with whether the tool is active in the sidebar
  React.useEffect(() => {
    setIsAddEnabled(!!activeTools.add);
  }, [activeTools.add]);

  React.useEffect(() => {
    setIsReplaceEnabled(!!activeTools.replace);
  }, [activeTools.replace]);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleAddSettingsPatch = (patch: Partial<AddSettings>) => {
    setAddSettings((prev) => {
      const merged = { ...prev, ...patch } as AddSettings;
      // Ensure numFields is defined
      merged.numFields = merged.numFields ?? prev.numFields;
      // Normalize contents length
      merged.contents = (merged.contents || prev.contents || []).slice(0, merged.numFields);
      while (merged.contents.length < merged.numFields) merged.contents.push('');

      // Normalize baseValues according to mode
      if (merged.mode === 'alternative' || merged.numFields === 1) {
        merged.baseValues = [merged.baseValues?.[0] ?? prev.baseValues?.[0] ?? 16];
      } else if (merged.mode === 'sequential') {
        merged.baseValues = (merged.baseValues || prev.baseValues || []).slice(0, merged.numFields);
        while (merged.baseValues.length < merged.numFields) merged.baseValues.push(merged.baseValues[merged.baseValues.length - 1] ?? 16);
      } else {
        merged.baseValues = (merged.baseValues || prev.baseValues || []).slice(0, merged.numFields);
      }

      return merged;
    });
  };

  const handleReplaceSettingsPatch = (patch: Partial<ReplaceSettings>) => {
    setReplaceSettings((prev) => {
      const merged = { ...prev, ...patch } as ReplaceSettings;
      // Normalize numFind
      let numFind = Math.max(1, merged.numFind ?? prev.numFind ?? 1);
      // Normalize finds array
      let finds = (merged.finds ?? prev.finds ?? []).slice(0, numFind);
      while (finds.length < numFind) finds.push('');

      // Normalize numReplace and cap to numFind
      let numReplace = merged.numReplace ?? prev.numReplace ?? numFind;
      numReplace = Math.max(1, Math.min(numFind, numReplace));
      let replaces = (merged.replaces ?? prev.replaces ?? []).slice(0, numReplace);
      while (replaces.length < numReplace) replaces.push('');

      return { ...merged, numFind, numReplace, finds, replaces } as ReplaceSettings;
    });
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const name = file.name || '';
    const ext = name.split('.').pop()?.toLowerCase() || '';

    try {
      if (ext === 'txt' || file.type === 'text/plain') {
        const txt = await file.text();
        const html = `<p>${txt.split(/\r?\n/).map((l) => l || '<br/>').join('</p><p>')}</p>`;
        if (editorRef.current) editorRef.current.innerHTML = html;
        setEditorHtml(html);
        flashStatus('Text file imported.', 2000, 'success');
      } else if (ext === 'html' || ext === 'htm') {
        const html = await file.text();
        if (editorRef.current) editorRef.current.innerHTML = html;
        setEditorHtml(html);
        flashStatus('HTML file imported.', 2000, 'success');
      } else {
        flashStatus('Unsupported import type (PDF/DOCX not supported).', 3200, 'error');
      }
    } catch (err) {
      try { const { error: logError } = await import('@/lib/logger'); logError(err); } catch {}
      flashStatus('Failed to import file.', 3000, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleProcessData = () => {
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : editorHtml;
    const hasContent = !!(currentHtml && currentHtml.trim().length > 0);
    // Allow processing when either content exists OR a title is provided
    if (!hasContent && !(title && title.trim())) {
      flashStatus('Please enter content to process.', 2500, 'error');
      return;
    }

    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    setIsLoading(true);
    try {
      // Apply transformations to content
      let processedContent = currentHtml;
      if (isAddEnabled) processedContent = applyAddOperation(processedContent, addSettings);
      if (isReplaceEnabled) processedContent = applyReplaceOperation(processedContent, replaceSettings);
      processedContent = cleanOutputHtml(processedContent);

      // Merge title and content ONLY in output section
      const titleHtml = title && title.trim() ? `<h2 style="font-size: 1.25rem; font-weight: bold; margin-bottom: 1rem;">${escapeHtml(title)}</h2>` : '';
      const merged = `${titleHtml}${processedContent}`;

      // Set only the output section - keep editor content unchanged
      setProcessedOutputHtml(merged);

      flashStatus('Processing complete.', 1800, 'success');
    } catch (err) {
      import('@/lib/logger').then(({ error: logError }) => logError(err)).catch(() => {});
      flashStatus('Processing failed.', 3000, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = () => {
    // Clear main content
    setEditorHtml('');
    if (editorRef.current) editorRef.current.innerHTML = '';
    setProcessedOutputHtml('');
    setTitle('');

    // Reset add/replace settings to defaults
    setAddSettings({ numFields: 1, contents: [''], baseValues: [16], mode: 'alternative' });
    setReplaceSettings({ numFind: 1, numReplace: 1, finds: [''], replaces: [''] });

    // Clear sidebar selections and related state
    setActiveTools({ add: false, replace: false, ai: false, sticky: false, edit: false });
    setStickyNotes([]);
    setSidebarCollapsed(false);

    // Remove persisted localStorage keys for home page
    try {
      localStorage.removeItem(LS_KEYS.EDITOR_CONTENT);
      localStorage.removeItem(LS_KEYS.TITLE);
      localStorage.removeItem(LS_KEYS.ADD_SETTINGS);
      localStorage.removeItem(LS_KEYS.REPLACE_SETTINGS);
      localStorage.removeItem(LS_KEYS.ACTIVE_TOOLS);
      localStorage.removeItem(LS_KEYS.STICKY_NOTES);
      localStorage.removeItem(LS_KEYS.SIDEBAR_COLLAPSED);
    } catch {}

    flashStatus('Cleared editor, settings, and sidebar selections.', 1500, 'info');
  };

  const handleCopyOutput = async () => {
    try {
      const html = processedOutputHtml || '';
      const plain = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

      // Try to write HTML to clipboard (preserve formatting) with fallback to plain text
      if ((navigator as any).clipboard && (navigator as any).clipboard.write) {
        try {
          const blobHtml = new Blob([html], { type: 'text/html' });
          const blobText = new Blob([plain], { type: 'text/plain' });
          const item = new (window as any).ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText });
          await (navigator as any).clipboard.write([item]);
          flashStatus('Formatted output copied to clipboard.', 1400, 'success');
          return;
        } catch (e) {
          // fallthrough to text-only copy
        }
      }

      await navigator.clipboard.writeText(plain);
      flashStatus('Output copied to clipboard.', 1400, 'success');
    } catch (err) {
      try { const { error: logError } = await import('@/lib/logger'); logError(err); } catch {}
      flashStatus('Copy failed.', 2000, 'error');
    }
  };

  const handleEditOutput = () => {
    if (!processedOutputHtml) {
      flashStatus('No processed output to edit.', 1400, 'info');
      return;
    }
    setEditorHtml(processedOutputHtml);
    if (editorRef.current) editorRef.current.innerHTML = processedOutputHtml;
    flashStatus('Loaded processed output into editor.', 1400, 'info');
  };

  const handleDownloadPDF = () => {
    const html = processedOutputHtml || (editorRef.current ? editorRef.current.innerHTML : '');
    const plain = html.replace(/<\/p>/gi, '\n\n').replace(/<br\s*\/?/gi, '\n').replace(/<[^>]+>/g, '').trim();
    if (!plain) {
      flashStatus('No content to download.', 1800, 'error');
      return;
    }

    // Dynamically import jsPDF to avoid bundling it in the main bundle
    (async () => {
      try {
        const mod = await import('jspdf');
        const PDF = mod.jsPDF || mod.default || mod;
        const doc = new PDF();
        let y = 20;

        doc.setFontSize(12);
        const lines = doc.splitTextToSize(plain, 180);
        for (let i = 0; i < lines.length; i++) {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(lines[i], 15, y);
          y += 7;
        }
        const fileName = (title || 'document').replace(/[^a-z0-9_\-]/gi, '_') + '.pdf';
        doc.save(fileName);
        flashStatus('PDF downloaded.', 1800, 'success');
      } catch (err) {
        try { const { error: logError } = await import('@/lib/logger'); logError('Failed to load jspdf', err); } catch {}
        flashStatus('Failed to generate PDF.', 2000, 'error');
      }
    })();
  };

  // URL fetcher removed

  const StickyNotes: React.FC<{ notes: string[]; onAdd: (n: string) => void; onRemove: (i: number) => void }> = ({ notes, onAdd, onRemove }) => {
    const [val, setVal] = useState('');
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="New note" className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-2 text-xs" />
          <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(''); } }} className="py-2 px-3 bg-white/5 rounded">Add</button>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
          {notes.length === 0 && <div className="text-xs text-white/40">No notes yet.</div>}
          {notes.map((n, i) => (
            <div key={i} className="p-2 bg-white/5 rounded flex items-start justify-between">
              <div className="text-xs">{n}</div>
              <button onClick={() => onRemove(i)} className="ml-2 text-red-400">×</button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="home-page-container">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

      <div className="home-layout">
        {/* Left Sidebar */}
        <Sidebar
          activeTools={activeTools}
          onToolToggle={handleToolToggle}
          onImportClick={handleImportClick}
          stickyNotes={stickyNotes}
          onOpenNote={(id) => handleOpenNote(id as string)}
          onDeleteNote={(id) => handleDeleteNote(id as string)}
          onRenameNote={(id, title) => handleRenameNote(id as string, title)}
          onUndoRename={(id) => handleUndoRename(id as string)}
          onRedoRename={(id) => handleRedoRename(id as string)}
          onAddNote={handleAddNote}
          onClearAllNotes={handleClearAllNotes}
          collapsed={sidebarCollapsed}
          onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Editor */}
        <div className="home-editor-section">
          {/* AI Content Section - Above Title (when selected) */}
          {activeTools.ai && (
            <div className="home-ai-section">
              <AIContentGenerator 
                onGenerated={(generatedTitle, generatedContent) => {
                  // Insert generated content into editor
                  const currentHtml = editorRef.current ? editorRef.current.innerHTML : editorHtml;
                  const newContent = currentHtml ? `${currentHtml}\n${generatedContent}` : generatedContent;
                  if (editorRef.current) editorRef.current.innerHTML = newContent;
                  setEditorHtml(newContent);
                  // Also set title if empty
                  if (!title && generatedTitle) setTitle(generatedTitle);
                  flashStatus('AI content generated and inserted', 1800, 'success');
                }}
                onClose={() => {
                  setActiveTools((prev) => ({ ...prev, ai: false }));
                  flashStatus('AI Content Generator closed', 1000, 'info');
                }}
              />
            </div>
          )}

          {/* Title Section - Fixed */}
          <div className="home-editor-title-section">
            <MainEditor
              title={title}
              onTitleChange={setTitle}
              content={editorHtml}
              onContentChange={setEditorHtml}
              showToolbar={true}
              editorRefProp={editorRef}
            />
          </div>

          {/* Content Scrollable Area */}
          <div className="home-editor-content-scroll">
            {/* Processing Buttons */}
            <div className="home-button-group">
            <button
              className="btn-process"
              onClick={handleProcessData}
              disabled={isLoading}
              style={{
                backgroundColor: BUTTON_BG_COLOR,
                color: BUTTON_TEXT_COLOR,
              }}
            >
              {isLoading ? 'PROCESSING...' : 'PROCESS DATA'}
            </button>
            <button
              className="btn-clear"
              onClick={handleClearAll}
              style={{
                backgroundColor: 'transparent',
                color: THEME_COLOR,
                border: `1px solid ${THEME_COLOR}`,
              }}
            >
              CLEAR ALL
            </button>
          </div>
          </div>
        </div>

        {/* Right Panel */}
        <RightPanel
          activeTools={{ add: activeTools.add, replace: activeTools.replace }}
          addSettings={addSettings}
          onAddSettingsChange={handleAddSettingsPatch}
          replaceSettings={replaceSettings}
          onReplaceSettingsChange={handleReplaceSettingsPatch}
        />
      </div>

      {/* Output Section - Below Main Layout */}
      {processedOutputHtml && (
        <div className="home-output-container">
          <div className="home-output-section">
            <h4 className="output-title">Processed Output</h4>
            <div
              className="output-content"
              dangerouslySetInnerHTML={{ __html: cleanOutputHtml(processedOutputHtml) }}
              style={{ color: THEME_COLOR }}
            />
          </div>
        </div>
      )}

      {/* Status Notification */}
      {triggerStatus && (
        <div
          className="status-notification"
          style={{
            backgroundColor:
              triggerType === 'success'
                ? 'rgba(34, 197, 94, 0.9)'
                : triggerType === 'error'
                  ? 'rgba(239, 68, 68, 0.9)'
                  : 'rgba(59, 130, 246, 0.9)',
          }}
        >
          {triggerStatus}
        </div>
      )}

      {/* Floating Sticky Notes */}
      {stickyNotes
        .filter((n) => n.visible !== false)
        .map((n) => (
          <StickyNote
            key={n.id}
            note={n as any}
            onUpdate={(id, patch) => handleUpdateNote(id as string, patch)}
            onClose={(id) => handleCloseNote(id as string)}
            onBringToFront={(id) => handleBringToFront(id as string)}
          />
        ))}
    </div>
  );
}
