"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Award,
  Loader2,
  Send,
  Download,
  Plus,
  Key,
  Replace,
  Trash2,
  Copy,
  RefreshCw,
  CheckCircle2,
  FileText,
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
// jsPDF is dynamically imported where needed to avoid bundling cost
import {
  applyAddOperation,
  applyReplaceOperation,
  cleanOutputHtml,
} from "@/lib/text-processor";
import { generateContent, sanitizeUserContent, postHistory } from "@/lib/api";
import { getSessionId } from "@/lib/session";
import type { ProcessedItem, AddSettings, ReplaceSettings } from "@/types";
// Avoid dynamic import for small client component to prevent ChunkLoadError
import {
  THEME_COLOR,
  ACTIVE_COLOR,
  BUTTON_BG_COLOR,
  BUTTON_TEXT_COLOR,
} from "@/lib/utils";
import RightPanel from "@/components/RightPanel";
import { error as logError } from "@/lib/logger";
// OutputSection removed for ProLevel page per UI update request

const DEFAULT_DAILY_LIMIT = 20;

export default function ProLevelPage() {
  // Inputs
  const [titlesText, setTitlesText] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");

  // States
  const [items, setItems] = useState<ProcessedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  // track per-item 'selected/active' highlight separate from the active editor index
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [limitLeft, setLimitLeft] = useState<number>(DEFAULT_DAILY_LIMIT);
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<"success" | "error" | "info">(
    "info",
  );
  const [sessionId, setSessionId] = useState<string>("");

  // Advertising removed: placeholder state removed

  // Checkbox pipeline selectors
  const [isAddEnabled, setIsAddEnabled] = useState(false);
  const [isReplaceEnabled, setIsReplaceEnabled] = useState(false);

  // Visual editor vs Raw HTML toggle
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef<boolean>(true);
  const prevHasUserKeyRef = useRef<boolean>(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const suppressedRef = useRef<{
    suppressed: boolean;
    lastTitles?: string;
    lastPrompt?: string;
  }>({ suppressed: false });
  const [showApiKeyList, setShowApiKeyList] = useState(false);
  const [savedApiKeys, setSavedApiKeys] = useState<string[]>([]);
  const saveKeyTimerRef = useRef<number | null>(null);
  const [selectedSavedKey, setSelectedSavedKey] = useState<string>("");
  const [showApiKeyDeletePicker, setShowApiKeyDeletePicker] = useState(false);
  // support multi-select deletion: map of key->selected
  const [apiKeysToDelete, setApiKeysToDelete] = useState<Record<string, boolean>>({});
  const [showFirstClickTooltip, setShowFirstClickTooltip] = useState(false);
  const [undoMap, setUndoMap] = useState<Record<number, string>>({});
  const apiKeyListRef = useRef<HTMLDivElement | null>(null);
  const apiKeyContainerRef = useRef<HTMLDivElement | null>(null);
  const apiKeyButtonRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  // Add settings
  const [addSettings, setAddSettings] = useState<AddSettings>({
    numFields: 1,
    contents: [""],
    baseValues: [16],
    mode: "alternative",
    excludeHeadingTags: [],
  });

  // Generation mode: parallel (true) or sequential/line-by-line (false)
  const [useParallelGeneration, setUseParallelGeneration] =
    useState<boolean>(false);

  // PDF / copy font size defaults (fixed)
  const TITLE_FONT_SIZE = 24;
  const CONTENT_FONT_SIZE = 14;

  // Default target length & structure for generated content (words)
  const TARGET_WORDS_MIN = 500;
  const TARGET_WORDS_MAX = 4000;
  const LENGTH_INSTRUCTION = `Target length: approximately ${TARGET_WORDS_MIN}-${TARGET_WORDS_MAX} words.`;
  const CONTENT_STRUCTURE_INSTRUCTIONS = `Return content as clean HTML using <p>, <ul>, <li>, <strong>, <h2>, <h3> tags. Structure: 1 short intro paragraph, 2-3 benefit-focused paragraphs, a short bullet list if relevant, and a one-sentence call-to-action at the end. Avoid scripts, styles, or metadata. Return ONLY valid JSON with "title" and "content" keys.`;

  // Editor options menu (three-dot) to configure exclusions like headings
  const [showEditorMenu, setShowEditorMenu] = useState(false);
  const editorMenuRef = useRef<HTMLDivElement | null>(null);

  // Batch PDF filename options
  const [showBatchNameModal, setShowBatchNameModal] = useState(false);
  const [batchNameWordCount, setBatchNameWordCount] = useState("");

  useEffect(() => {
    if (!showEditorMenu) return;
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (editorMenuRef.current && !editorMenuRef.current.contains(target))
        setShowEditorMenu(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [showEditorMenu]);

  // Initialize suppression state from localStorage so the reminder can persist
  // across quick reloads during a session if desired.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pro_missing_key_suppress");
      if (raw) {
        const parsed = JSON.parse(raw);
        suppressedRef.current = {
          suppressed: !!parsed.suppressed,
          lastTitles: parsed.lastTitles || "",
          lastPrompt: parsed.lastPrompt || "",
        };
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  // Clear suppression when the Titles or Prompt change from the suppressed
  // values. This ensures the modal reappears when the user edits inputs.
  useEffect(() => {
    try {
      const s = suppressedRef.current;
      if (
        s.suppressed &&
        (s.lastTitles !== (titlesText || "") || s.lastPrompt !== (customPrompt || ""))
      ) {
        suppressedRef.current.suppressed = false;
        try {
          localStorage.removeItem("pro_missing_key_suppress");
        } catch (e) {
          /* ignore */
        }
      }
    } catch (e) {
      /* ignore */
    }
  }, [titlesText, customPrompt]);

  // Replace settings
  const [replaceSettings, setReplaceSettings] = useState<ReplaceSettings>({
    numFind: 1,
    numReplace: 1,
    finds: [""],
    replaces: [""],
  });

  // ---------------------------------------------------------------------
  // Persistence: load on mount
  // ---------------------------------------------------------------------
  useEffect(() => {
    const sid = getSessionId();
    setSessionId(sid);

    try {
      const storedItems = localStorage.getItem("pro_level_items");
      if (storedItems) {
        const parsedRaw: ProcessedItem[] = JSON.parse(storedItems);
        // Normalize any unexpected 'processing' status to 'pending' so resume works reliably
        const normalizedItems = parsedRaw.map((it) => ({
          ...it,
          status: it.status === "processing" ? "pending" : it.status,
        }));

        // Sanitize any items that may contain raw/huge JSON error blobs or
        // extremely long content from older runs so the editor doesn't render
        // unwieldy text. Replace displayed content with a short error summary
        // and preserve the full payload in `generatedContent` if present.
        const sanitize = (it: ProcessedItem): ProcessedItem => {
          try {
            const copy = { ...it } as ProcessedItem;
            const raw = String(copy.errorMsg ?? copy.content ?? "").trim();
            const looksHuge = raw.length > 1500 || /^\s*[\[{]/.test(raw);
            // Only collapse content when the item actually indicates an error.
            // Previously very large generated payloads were treated as errors
            // and replaced with a short summary. For Pro Level we want to show
            // the full generated content by default, so only convert to the
            // compact error view when the item explicitly has an error status.
            if (copy.status === "error") {
              // Try to extract a concise message from JSON-like payloads
              let msg = raw;
              try {
                if (/^[\[{]/.test(msg)) {
                  const p = JSON.parse(msg);
                  if (p && typeof p.message === "string") msg = p.message;
                  else msg = JSON.stringify(p);
                } else {
                  const m = msg.match(/\"message\"\s*:\s*\"([^\"]{10,})\"/i);
                  if (m && m[1]) msg = m[1];
                  else {
                    const m2 = msg.match(
                      /message\W*[:=]\s*\"?([^\n\r\"]{10,})/i,
                    );
                    if (m2 && m2[1]) msg = m2[1];
                  }
                }
              } catch (e) {
                // ignore parse errors
              }
              msg = msg.replace(/\s+/g, " ").trim();
              if (msg.length > 120) msg = msg.slice(0, 117) + "...";
              copy.errorMsg = msg;
              copy.content = `<div class=\"rounded-md p-3 text-sm bg-red-900/60 border border-red-700 text-red-100\"><strong class=\"font-bold block mb-1\">Error</strong><div>${msg}</div></div>`;
            }
            return copy;
          } catch (e) {
            return it;
          }
        };

        const sanitizedItems = normalizedItems.map(sanitize);
        setItems(sanitizedItems);
        // restore active index if previously stored and valid
        try {
          const savedActive = localStorage.getItem("pro_active_index");
          if (savedActive !== null) {
            const idx = parseInt(savedActive, 10);
            if (!isNaN(idx) && idx >= 0 && idx < normalizedItems.length) {
              setActiveIndex(idx);
            } else if (normalizedItems.length > 0) {
              setActiveIndex(0);
            }
          } else if (normalizedItems.length > 0) {
            setActiveIndex(0);
          }
        } catch (e) {
          if (normalizedItems.length > 0) setActiveIndex(0);
        }
      }

      // Load saved API keys from previous saves and site customization
      try {
        const keysSet = new Set<string>();
        const saved = localStorage.getItem("saved_api_keys");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              parsed.forEach((k) => {
                if (typeof k === "string" && k.trim()) keysSet.add(k.trim());
              });
            }
          } catch (e) {}
        }
        const siteCust = localStorage.getItem("site_customization");
        if (siteCust) {
          try {
            const parsed = JSON.parse(siteCust);
            if (
              parsed &&
              typeof parsed.apiKey === "string" &&
              parsed.apiKey.trim()
            )
              keysSet.add(parsed.apiKey.trim());
          } catch (e) {}
        }
        const proSaved = localStorage.getItem("pro_api_key");
        if (proSaved && proSaved.trim()) keysSet.add(proSaved.trim());
        const arr = Array.from(keysSet);
        setSavedApiKeys(arr);
        // persist merged list back to storage for future use
        if (arr.length > 0)
          localStorage.setItem("saved_api_keys", JSON.stringify(arr));
        // restore selected saved key if any
        try {
          const sel = localStorage.getItem("pro_selected_saved_key");
          if (sel) setSelectedSavedKey(sel);
        } catch (e) {
          /* ignore */
        }
      } catch (e) {
        // ignore
      }

      const savedAddEnabled = localStorage.getItem("pro_pipeline_add_enabled");
      const savedReplaceEnabled = localStorage.getItem(
        "pro_pipeline_replace_enabled",
      );
      if (savedAddEnabled !== null) setIsAddEnabled(savedAddEnabled === "true");
      if (savedReplaceEnabled !== null)
        setIsReplaceEnabled(savedReplaceEnabled === "true");

      const savedPrompt = localStorage.getItem("pro_custom_prompt");
      if (savedPrompt !== null) setCustomPrompt(savedPrompt);

      const savedApiKey = localStorage.getItem("pro_api_key");
      if (savedApiKey !== null) setApiKey(savedApiKey);

      // restore view mode if present
      try {
        const savedHtml = localStorage.getItem("pro_is_html_mode");
        if (savedHtml !== null) setIsHtmlMode(savedHtml === "true");
      } catch (e) {
        /* ignore */
      }

      const savedAddSettings = localStorage.getItem("pro_add_settings");
      if (savedAddSettings) {
        try {
          setAddSettings(JSON.parse(savedAddSettings));
        } catch (e) {
          logError(e);
        }
      }

      // Restore generation mode and font-size preferences
      try {
        const savedParallel = localStorage.getItem(
          "pro_use_parallel_generation",
        );
        if (savedParallel !== null)
          setUseParallelGeneration(savedParallel === "true");
      } catch (e) {}
      // Note: fixed PDF font-size defaults are used; no per-item controls persisted.

      const savedReplaceSettings = localStorage.getItem("pro_replace_settings");
      if (savedReplaceSettings) {
        try {
          setReplaceSettings(JSON.parse(savedReplaceSettings));
        } catch (e) {
          logError(e);
        }
      }

      // Daily 1:00 AM limit reset
      const savedLimit = localStorage.getItem("pro_limit_left");
      const lastResetStr = localStorage.getItem("pro_limit_last_reset");
      const now = new Date();
      const today1Am = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        1,
        0,
        0,
        0,
      );

      if (savedLimit) {
        if (lastResetStr) {
          const lastReset = parseInt(lastResetStr, 10);
          if (
            lastReset < today1Am.getTime() &&
            now.getTime() >= today1Am.getTime()
          ) {
            localStorage.setItem("pro_limit_left", String(DEFAULT_DAILY_LIMIT));
            localStorage.setItem(
              "pro_limit_last_reset",
              now.getTime().toString(),
            );
            setLimitLeft(DEFAULT_DAILY_LIMIT);
          } else {
            setLimitLeft(parseInt(savedLimit, 10));
          }
        } else {
          localStorage.setItem(
            "pro_limit_last_reset",
            now.getTime().toString(),
          );
          setLimitLeft(parseInt(savedLimit, 10));
        }
      } else {
        localStorage.setItem("pro_limit_left", String(DEFAULT_DAILY_LIMIT));
        localStorage.setItem("pro_limit_last_reset", now.getTime().toString());
        setLimitLeft(DEFAULT_DAILY_LIMIT);
      }
    } catch (e) {
      logError("Error loading pro level storage", e);
    } finally {
      // Mark initial load complete so subsequent apiKey changes are user-driven
      isInitialLoadRef.current = false;
      // Restore previously-entered titles text if present (do not force-clear on mount)
      try {
        const persistedTitles = localStorage.getItem("pro_titles_text");
        if (persistedTitles !== null) setTitlesText(persistedTitles);
      } catch (e) {
        /* ignore */
      }
    }
  }, []);

  // Persist titles text so navigation away/back preserves user input
  useEffect(() => {
    try {
      if (titlesText && titlesText.length > 0)
        localStorage.setItem("pro_titles_text", titlesText);
      else localStorage.removeItem("pro_titles_text");
    } catch (e) {
      /* ignore */
    }
  }, [titlesText]);

  // Close API key dropdown when clicking outside
  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!showApiKeyList) return;
      const target = ev.target as Node;
      // close when click is outside both the container (button/input) and the dropdown
      const insideDropdown = apiKeyListRef.current
        ? apiKeyListRef.current.contains(target)
        : false;
      const insideContainer = apiKeyContainerRef.current
        ? apiKeyContainerRef.current.contains(target)
        : false;
      if (!insideDropdown && !insideContainer) setShowApiKeyList(false);
      if (!insideDropdown && !insideContainer) setShowApiKeyDeletePicker(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [showApiKeyList]);

  // Keep the API-key dropdown anchored to the key button while visible.
  // Recalculate position on scroll/resize and when the button/container resizes.
  useEffect(() => {
    if (!showApiKeyList) return;
    if (typeof window === "undefined") return;

    const updatePosition = () => {
      try {
        const rect =
          apiKeyButtonRef.current?.getBoundingClientRect() ??
          apiKeyContainerRef.current?.getBoundingClientRect();
        if (rect) {
          const desiredWidth = Math.min(520, Math.max(220, rect.width || 40));
          const viewportLeft = rect.left;
          const viewportLeftMin = 8;
          const viewportLeftMax = window.innerWidth - desiredWidth - 8;
          const clampedLeft = Math.min(
            Math.max(viewportLeft, viewportLeftMin),
            Math.max(viewportLeftMin, viewportLeftMax),
          );
          const desiredTop = rect.bottom + 6; // small gap under button (viewport coordinates)
          setDropdownPosition({
            left: clampedLeft,
            top: desiredTop,
            width: desiredWidth,
          });
        } else {
          setDropdownPosition(null);
        }
      } catch (e) {
        setDropdownPosition(null);
      }
    };

    // initial position
    updatePosition();

    // update on scroll (capture phase to catch scrolls on any ancestor), and resize
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    // also observe size changes of the button/container
    let ro: ResizeObserver | null = null;
    try {
      if ((window as any).ResizeObserver) {
        ro = new (window as any).ResizeObserver(() => updatePosition());
        if (ro) {
          if (apiKeyButtonRef.current) ro.observe(apiKeyButtonRef.current);
          if (apiKeyContainerRef.current)
            ro.observe(apiKeyContainerRef.current);
        }
      }
    } catch (e) {
      ro = null;
    }

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      if (ro) ro.disconnect();
    };
  }, [showApiKeyList]);

  // Persist customizations
  useEffect(() => {
    localStorage.setItem("pro_custom_prompt", customPrompt);
  }, [customPrompt]);

  useEffect(() => {
    localStorage.setItem("pro_api_key", apiKey);
  }, [apiKey]);

  // Ensure pro-level inputs persist on unload/visibility change (covers fast navigations)
  useEffect(() => {
    const persistNow = () => {
      try {
        if (customPrompt !== undefined)
          localStorage.setItem("pro_custom_prompt", customPrompt || "");
        if (apiKey !== undefined)
          localStorage.setItem("pro_api_key", apiKey || "");
        if (titlesText !== undefined) {
          if (titlesText && titlesText.length > 0)
            localStorage.setItem("pro_titles_text", titlesText);
          else localStorage.removeItem("pro_titles_text");
        }
        // Persist items to ensure current edits are saved before unload
        try {
          if (items && items.length > 0)
            localStorage.setItem("pro_level_items", JSON.stringify(items));
        } catch (e) {
          /* ignore */
        }
      } catch (e) {
        /* ignore */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") persistNow();
    };

    window.addEventListener("beforeunload", persistNow);
    window.addEventListener("pagehide", persistNow);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("beforeunload", persistNow);
      window.removeEventListener("pagehide", persistNow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [customPrompt, apiKey, titlesText]);

  // Auto-save newly entered API keys to saved list (skip during initial load)
  useEffect(() => {
    try {
      // skip during initial load
      if (isInitialLoadRef.current) return;

      // clear any existing timer when the key changes
      if (saveKeyTimerRef.current) {
        try {
          window.clearTimeout(saveKeyTimerRef.current);
        } catch (e) {
          /* ignore */
        }
        saveKeyTimerRef.current = null;
      }

      const key = (apiKey || "").trim();
      if (!key) return;

      // schedule a delayed save after 10s of idle
      const id = window.setTimeout(() => {
        try {
          setSavedApiKeys((prev) => {
            if (prev.includes(key)) return prev;
            const arr = [...prev, key];
            try {
              localStorage.setItem("saved_api_keys", JSON.stringify(arr));
            } catch (e) {
              /* ignore */
            }
            flashStatus("API key saved to picker.", 1400, "success");
            return arr;
          });
        } catch (e) {
          /* ignore */
        }
        saveKeyTimerRef.current = null;
      }, 10000);

      saveKeyTimerRef.current = id as unknown as number;
    } catch (e) {
      // ignore
    }

    return () => {
      // clear timer on cleanup/unmount or when apiKey changes
      if (saveKeyTimerRef.current) {
        try {
          window.clearTimeout(saveKeyTimerRef.current);
        } catch (e) {
          /* ignore */
        }
        saveKeyTimerRef.current = null;
      }
    };
  }, [apiKey]);

  const saveCurrentApiKey = () => {
    const key = (apiKey || "").trim();
    if (!key) return flashStatus("No API key to save.", 1400, "info");
    try {
      const existing = localStorage.getItem("saved_api_keys");
      let arr: string[] = [];
      if (existing) {
        try {
          arr = JSON.parse(existing);
        } catch {
          arr = [];
        }
      }
      if (!arr.includes(key)) arr.push(key);
      localStorage.setItem("saved_api_keys", JSON.stringify(arr));
      setSavedApiKeys(arr);
      flashStatus("Saved API key locally.", 1400, "success");
    } catch (e) {
      logError(e);
      flashStatus("Failed to save API key.", 1400, "error");
    }
  };

  // Regenerate content for the active item only
  const handleRegenerateActive = async () => {
    if (isRegenerating) return;
    if (activeIndex === -1 || !items[activeIndex])
      return flashStatus(
        "No active item selected to regenerate.",
        1600,
        "info",
      );

    if (limitLeft <= 0 && !hasUserKey) {
      return flashStatus(
        "Process limit reached (0 remaining). Provide your API key to continue.",
        5000,
        "error",
      );
    }

    setIsRegenerating(true);

    const item = items[activeIndex];
    const previousContent = item.content || "";

    // Save undo
    try {
      setUndoMap((prev) => ({ ...prev, [activeIndex]: previousContent }));
    } catch (e) {
      /* ignore */
    }

    // mark pending visually
    updateItemAtomic(activeIndex, {
      status: "pending",
      content: makeContentHtml("pending", "Regenerating new content..."),
    });

    try {
      // Ask user for optional guidance to ensure unique output
      let userInstr = "";
      try {
        const promptText = window.prompt(
          "Optional: add a short direction for regeneration (leave blank for a fresh alternative)",
        );
        if (typeof promptText === "string") userInstr = promptText.trim();
      } catch (e) {
        userInstr = "";
      }

      const basePrompt = (customPrompt || "").trim();
      let payloadPrompt = basePrompt ? `${basePrompt}\n\n` : "";
      if (userInstr) payloadPrompt += `User instruction: ${userInstr}\n\n`;
      payloadPrompt += `${LENGTH_INSTRUCTION}\n${CONTENT_STRUCTURE_INSTRUCTIONS}\n\nReturn a JSON object with keys \"title\" (string) and \"content\" (string with HTML). Do not include any additional commentary.\n\nGenerate a NEW, UNIQUE alternative version of the campaign content for the title: "${item.title}". Avoid repeating or paraphrasing the previous output below; produce original wording, structure, and examples.\n\nPrevious content:\n${previousContent}`;

      const genRes = await generateContent(
        { prompt: payloadPrompt, apiKey: apiKey.trim() },
        30000,
      );

      if (!genRes.ok) {
        const friendly =
          (genRes as any).friendly || genRes.error || genRes.body?.error || "Server error generating content.";
        updateItemAtomic(activeIndex, {
          status: "error",
          errorMsg: genRes.error || friendly,
          content: makeContentHtml("error", friendly),
        });
        flashStatus(friendly, 4000, "error");
        return;
      }

      const data: { title: string; content: string } = genRes.data as any;
      let finalContent = cleanOutputHtml(
        data.content || "<p>No content returned.</p>",
      );

      // If the returned content begins with a heading, move it to the title
      const normalized = extractLeadingHeading(
        data.title || item.title || "",
        finalContent,
      );
      const finalTitle = normalized.title || data.title || item.title;
      finalContent = normalized.html;

      if (isAddEnabled)
        finalContent = applyAddOperation(finalContent, addSettings);
      if (isReplaceEnabled)
        finalContent = applyReplaceOperation(finalContent, replaceSettings);

      // Store full generated HTML and display it directly in the content
      // slot so the Pro Level content section shows the complete generated
      // output rather than a truncated excerpt.
      updateItemAtomic(activeIndex, {
        title: finalTitle,
        generatedContent: finalContent,
        content: finalContent,
        status: "success",
      });

      // decrement limit when using server default key
      if (!hasUserKey) {
        const newLimit = Math.max(
          0,
          (parseInt(
            localStorage.getItem("pro_limit_left") || String(limitLeft),
            10,
          ) || 0) - 1,
        );
        setLimitLeft(newLimit);
        localStorage.setItem("pro_limit_left", String(newLimit));
      }

      flashStatus("Regenerated content for active item.", 2200, "success");
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Unknown error");
      logError("Regeneration failed", e);
      updateItemAtomic(activeIndex, {
        status: "error",
        errorMsg: e.message || "Regeneration failed.",
        content: makeContentHtml(
          "error",
          `Regeneration failed: ${e.message || "Server error"}`,
        ),
      });
      flashStatus("Failed to regenerate content.", 3000, "error");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSelectApiKey = (k: string) => {
    if (showApiKeyDeletePicker) {
      // clicking a key in delete mode toggles selection
      setApiKeysToDelete((prev) => ({ ...prev, [k]: !prev[k] }));
      return;
    }

    setApiKey(k);
    setSelectedSavedKey(k);
    try {
      localStorage.setItem("pro_selected_saved_key", k);
    } catch (e) {
      /* ignore */
    }
    setShowApiKeyList(false);
    setShowApiKeyDeletePicker(false);
    setApiKeysToDelete({});
    flashStatus("API key selected.", 1200, "success");
  };

  const handleOpenApiKeyDeletePicker = () => {
    setApiKeysToDelete({});
    setShowApiKeyDeletePicker(true);
  };

  const handleCancelApiKeyDelete = () => {
    setApiKeysToDelete({});
    setShowApiKeyDeletePicker(false);
  };

  const handleCleanTestData = () => {
    try {
      const keyPattern = /(AUTOSAVE_|DUMMY_|TEST_|TESTKEY_|TEST-)/i;
      const saved = savedApiKeys || [];
      const keysToRemove = saved.filter((k) => keyPattern.test(k) || /AUTOSAVE|DUMMY|TEST/i.test(k));

      const rawItems = localStorage.getItem("pro_level_items");
      const parsedItems: ProcessedItem[] = rawItems ? JSON.parse(rawItems) : [];
      const itemsToRemove = (parsedItems || []).filter((it) => {
        const t = String(it.title || "");
        const id = String(it.id || "");
        if (keyPattern.test(t) || keyPattern.test(id)) return true;
        if (/\btest\b/i.test(t)) return true;
        if (String(it.generatedContent || "").includes("DUMMY_") || String(it.generatedContent || "").includes("AUTOSAVE_")) return true;
        return false;
      });

      if (keysToRemove.length === 0 && itemsToRemove.length === 0)
        return flashStatus("No test keys or items found to clean.", 2000, "info");

      const confirmMsg = `Remove ${keysToRemove.length} saved API key(s) and ${itemsToRemove.length} item(s) created by tests? This cannot be undone.`;
      // eslint-disable-next-line no-restricted-globals
      if (!confirm(confirmMsg)) return;

      // Remove keys
      const nextKeys = saved.filter((k) => !keysToRemove.includes(k));
      setSavedApiKeys(nextKeys);
      try {
        if (nextKeys.length > 0) localStorage.setItem("saved_api_keys", JSON.stringify(nextKeys));
        else localStorage.removeItem("saved_api_keys");
      } catch (e) {
        /* ignore */
      }

      // Remove items
      const remainingItems = (parsedItems || []).filter((it) => !itemsToRemove.includes(it));
      saveItems(remainingItems);

      // Remove test pro_api_key if present
      try {
        const cur = localStorage.getItem("pro_api_key");
        if (cur && keyPattern.test(cur)) {
          localStorage.removeItem("pro_api_key");
          setApiKey("");
        }
      } catch (e) {}

      flashStatus(`Removed ${keysToRemove.length} keys and ${itemsToRemove.length} items.`, 2500, "success");
    } catch (e) {
      logError(e);
      flashStatus("Failed to clean test data.", 2000, "error");
    }
  };

  const handleConfirmDeleteApiKey = () => {
    try {
      const toRemove = Object.keys(apiKeysToDelete).filter((k) => apiKeysToDelete[k]);
      if (toRemove.length === 0)
        return flashStatus("No API key selected for deletion.", 1500, "info");

      const next = savedApiKeys.filter((k) => !toRemove.includes(k));
      setSavedApiKeys(next);
      try {
        if (next.length > 0) localStorage.setItem("saved_api_keys", JSON.stringify(next));
        else localStorage.removeItem("saved_api_keys");
      } catch (e) {
        /* ignore */
      }

      // If any removed keys match the currently stored pro_api_key, remove it
      try {
        const cur = localStorage.getItem("pro_api_key");
        if (cur && toRemove.includes(cur)) {
          localStorage.removeItem("pro_api_key");
          setApiKey("");
        }
      } catch (e) {}

      // If any removed keys were the selected saved key, clear that selection
      if (toRemove.includes(selectedSavedKey)) {
        setSelectedSavedKey("");
        try {
          localStorage.removeItem("pro_selected_saved_key");
        } catch (e) {}
      }

      setApiKeysToDelete({});
      setShowApiKeyDeletePicker(false);
      flashStatus(`Deleted ${toRemove.length} saved API key(s).`, 1800, "success");
    } catch (e) {
      logError(e);
      flashStatus("Failed to delete API key(s).", 2000, "error");
    }
  };

  useEffect(() => {
    localStorage.setItem("pro_add_settings", JSON.stringify(addSettings));
  }, [addSettings]);

  useEffect(() => {
    localStorage.setItem(
      "pro_replace_settings",
      JSON.stringify(replaceSettings),
    );
  }, [replaceSettings]);

  // Persist active item index so selection survives navigation
  useEffect(() => {
    try {
      localStorage.setItem("pro_active_index", String(activeIndex));
    } catch (e) {
      /* ignore */
    }
  }, [activeIndex]);

  // Persist HTML view mode
  useEffect(() => {
    try {
      localStorage.setItem("pro_is_html_mode", String(isHtmlMode));
    } catch (e) {
      /* ignore */
    }
  }, [isHtmlMode]);

  // Persist selected saved API key
  useEffect(() => {
    try {
      if (selectedSavedKey)
        localStorage.setItem("pro_selected_saved_key", selectedSavedKey);
      else localStorage.removeItem("pro_selected_saved_key");
    } catch (e) {
      /* ignore */
    }
  }, [selectedSavedKey]);

  // Reset daily limit when user adds their own API key (ignore initial load)
  useEffect(() => {
    const hasKeyNow = apiKey.trim().length > 0;
    if (!isInitialLoadRef.current && hasKeyNow && !prevHasUserKeyRef.current) {
      const now = Date.now();
      setLimitLeft(DEFAULT_DAILY_LIMIT);
      localStorage.setItem("pro_limit_left", String(DEFAULT_DAILY_LIMIT));
      localStorage.setItem("pro_limit_last_reset", now.toString());
      flashStatus(
        `API key provided — daily limit reset to ${DEFAULT_DAILY_LIMIT}`,
        3500,
        "success",
      );
    }
    prevHasUserKeyRef.current = hasKeyNow;
  }, [apiKey]);

  // Sync visual body editor content
  useEffect(() => {
    if (
      !isHtmlMode &&
      editorRef.current &&
      activeIndex !== -1 &&
      items[activeIndex]
    ) {
      const el = editorRef.current;
      const activeContent = items[activeIndex].content || "";
      try {
        // If editor (or a child) currently has focus, avoid overwriting
        // innerHTML which resets the caret/selection to the start.
        const activeEl = document.activeElement as Node | null;
        if (activeEl && el.contains(activeEl as Node)) return;
      } catch (e) {
        /* ignore */
      }
      if (el.innerHTML !== activeContent) {
        el.innerHTML = activeContent;
      }
    }
  }, [activeIndex, isHtmlMode, items]);

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  const flashStatus = (
    msg: string,
    ms = 3000,
    type: "success" | "error" | "info" = "info",
  ) => {
    setTriggerStatus(msg);
    setTriggerType(type);
    setTimeout(() => setTriggerStatus(null), ms);
  };

  const saveItems = (updatedItems: ProcessedItem[]) => {
    setItems(updatedItems);
    localStorage.setItem("pro_level_items", JSON.stringify(updatedItems));

    // Best-effort sync to optional persistent history (non-blocking, ignores failures)
    if (sessionId) {
      postHistory({ sessionId, items: updatedItems, customPrompt }).catch(
        () => {
          /* offline / persistent store not configured - ignore */
        },
      );
    }
  };

  // If generated content begins with an H1..H6, move that heading into the
  // item's title and remove it from the content so the content never starts
  // with a heading (title belongs in the title field only).
  const extractLeadingHeading = (
    incomingTitle: string | undefined,
    html: string,
  ) => {
    if (typeof document === "undefined") return { title: incomingTitle, html };
    try {
      const container = document.createElement("div");
      container.innerHTML = html || "";

      // find first non-empty node
      let node: ChildNode | null = container.firstChild;
      while (
        node &&
        node.nodeType === Node.TEXT_NODE &&
        (node.textContent || "").trim().length === 0
      ) {
        node = node.nextSibling;
      }

      if (node && node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();
        if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
          const headingText = (el.textContent || "").trim();
          // remove the heading node from the content
          el.remove();
          // remove any leading whitespace text nodes left behind
          while (
            container.firstChild &&
            container.firstChild.nodeType === Node.TEXT_NODE &&
            (container.firstChild.textContent || "").trim().length === 0
          ) {
            container.removeChild(container.firstChild);
          }
          const newTitle =
            incomingTitle && incomingTitle.trim().length > 0
              ? incomingTitle
              : headingText;
          const newHtml =
            (container.innerHTML || "").trim() || "<p>No content returned.</p>";
          return { title: newTitle, html: newHtml };
        }
      }
    } catch (e) {
      // ignore and return original
    }
    return { title: incomingTitle, html };
  };

  // Get a short excerpt HTML from a larger HTML string to avoid writing full
  // generated content into the editor by default. Prefer the first paragraph
  // or list; fallback to a truncated text-only paragraph.
  const getExcerptFromHtml = (html: string, maxChars = 500) => {
    if (typeof document === "undefined") return html;
    try {
      const container = document.createElement("div");
      container.innerHTML = html || "";

      // Prefer first paragraph, then first list, then first block element
      const firstP = container.querySelector("p");
      if (firstP && (firstP.textContent || "").trim().length > 0)
        return firstP.outerHTML;
      const firstList = container.querySelector("ul, ol");
      if (firstList) return firstList.outerHTML;
      // fallback to first non-empty block element
      const children = Array.from(container.childNodes || []);
      for (const ch of children) {
        if (ch.nodeType === Node.ELEMENT_NODE) {
          const el = ch as Element;
          if ((el.textContent || "").trim().length > 0) return el.outerHTML;
        } else if (
          ch.nodeType === Node.TEXT_NODE &&
          (ch.textContent || "").trim().length > 0
        ) {
          const text = (ch.textContent || "").trim();
          return `<p>${text.length > maxChars ? text.slice(0, maxChars).trim() + "…" : text}</p>`;
        }
      }

      // last resort: full text truncated
      const txt = (container.textContent || "").trim();
      if (txt.length === 0) return "<p>No content returned.</p>";
      return `<p>${txt.length > maxChars ? txt.slice(0, maxChars).trim() + "…" : txt}</p>`;
    } catch (e) {
      return html;
    }
  };

  // Escape HTML for safe insertion into content slots
  const escapeHtml = (s: string | undefined) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");

  // Build a small, consistently-styled HTML block for informational / pending / error messages
  const makeContentHtml = (
    type: "info" | "pending" | "error",
    message: string,
  ) => {
    const title =
      type === "error" ? "Error" : type === "pending" ? "Pending" : "Info";
    const base = "rounded-md p-3 text-sm";
    const style =
      type === "error"
        ? "bg-red-900/60 border border-red-700 text-red-100"
        : type === "pending"
          ? "bg-amber-900/40 border border-amber-500 text-amber-100"
          : "bg-sky-900/30 border border-sky-500 text-sky-100";

    // Summarize long messages into a short 1-2 line text to avoid overflow
    const summarize = (s: string | undefined, max = 120) => {
      let txt = String(s || "").trim();
      if (!txt) return "";
      // Try to extract a JSON "message" field if the payload looks like JSON
      try {
        if (/^[\[{]/.test(txt)) {
          const parsed = JSON.parse(txt);
          const findMsg = (obj: any): string | null => {
            if (!obj || typeof obj !== "object") return null;
            if (typeof obj.message === "string") return obj.message;
            if (obj.error && typeof obj.error.message === "string")
              return obj.error.message;
            for (const k of Object.keys(obj)) {
              try {
                const v = obj[k];
                const res = findMsg(v);
                if (res) return res;
              } catch (e) {
                /* ignore */
              }
            }
            return null;
          };
          const extracted = findMsg(parsed);
          if (extracted) txt = extracted;
          else {
            // fallback to stringified but will be truncated below
            txt = JSON.stringify(parsed);
          }
        } else {
          // try regex for embedded message fields
          const m = txt.match(/"message"\s*:\s*"([^"]{10,})"/i);
          if (m && m[1]) txt = m[1];
          else {
            const m2 = txt.match(/message\W*[:=]\s*\"?([^\n\r\"]{10,})/i);
            if (m2 && m2[1]) txt = m2[1];
          }
        }
      } catch (e) {
        // ignore parse errors
      }

      txt = txt.replace(/\s+/g, " ").trim();
      if (txt.length <= max) return txt;
      return txt.slice(0, max - 3).trim() + "...";
    };

    const summary = summarize(message, 120);

    // Build HTML with wrapping rules to avoid overflow; include a details block
    const wrapperStart = `<div class=\"${base} ${style}\" style=\"overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap;\">`;
    const details =
      String(message || "").trim().length > summary.length
        ? `<details style=\"margin-top:8px;\"><summary style=\"cursor:pointer;color:inherit;opacity:0.9;font-weight:600;\">Details</summary><pre style=\"white-space:pre-wrap;overflow:auto;max-height:220px;margin-top:8px;background:rgba(255,255,255,0.02);padding:8px;border-radius:6px\">${escapeHtml(String(message))}</pre></details>`
        : "";

    return `${wrapperStart}<strong class=\"font-bold block mb-1\">${escapeHtml(title)}</strong><div>${escapeHtml(summary)}</div>${details}</div>`;
  };

  // Migrate persisted error messages in localStorage to friendlier summaries.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pro_level_items");
      if (!raw) return;
      const parsed = JSON.parse(raw) as ProcessedItem[] | null;
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      const patterns: { regex: RegExp; friendly: string }[] = [
        {
          regex: /api[_\s-]*key not valid|api_key_invalid|invalid api key/i,
          friendly:
            "Sorry — I cannot generate content (reason: invalid API key). Please check your API key configuration.",
        },
        {
          regex: /no ai api key configured|no ai api key/i,
          friendly:
            "Sorry — I cannot generate content (reason: no API key found or API key quota exceeded).",
        },
        {
          regex: /quota|limit|rate limit|quota exceeded/i,
          friendly:
            "Sorry — I cannot generate content (reason: API key quota exceeded). Try again later or use a different API key.",
        },
        {
          regex: /timeout/i,
          friendly:
            "Sorry — the request timed out while generating content. Please try again.",
        },
        {
          regex: /generation failed|failed to generate content|server error/i,
          friendly: "Sorry — the server failed to generate content. Try again later.",
        },
      ];

      let changed = false;
      const next = parsed.map((it) => {
        try {
          if (!it || it.status !== "error" || !it.errorMsg) return it;
          const found = patterns.find((p) => p.regex.test(it.errorMsg || ""));
          if (!found) return it;
          const friendly = found.friendly;
          changed = true;
          return {
            ...it,
            errorMsg: friendly,
            content: makeContentHtml("error", friendly),
          } as ProcessedItem;
        } catch (e) {
          return it;
        }
      });

      if (changed) {
        try {
          localStorage.setItem("pro_level_items", JSON.stringify(next));
        } catch (e) {
          /* ignore */
        }
        setItems(next);
        flashStatus("Migrated persisted error messages to friendlier text.", 2600, "info");
      }
    } catch (e) {
      /* ignore migration failures */
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modal handlers for missing API key reminder
  const handleCloseApiKeyModal = () => {
    // Suppress future reminders until Titles or Prompt change
    suppressedRef.current = {
      suppressed: true,
      lastTitles: titlesText || "",
      lastPrompt: customPrompt || "",
    };
    try {
      localStorage.setItem(
        "pro_missing_key_suppress",
        JSON.stringify(suppressedRef.current),
      );
    } catch (e) {
      /* ignore */
    }
    setShowApiKeyModal(false);
    flashStatus("Reminder suppressed until Titles or Prompt change.", 2000, "info");
  };

  const handleOpenApiKeyFromModal = () => {
    try {
      window.open("https://aistudio.google.com/api-keys", "_blank");
    } catch (e) {
      /* ignore */
    }
    setShowApiKeyModal(false);
  };

  const computeFileBaseFromTitle = (
    title: string | undefined,
    idx: number,
    wordLimit?: number | undefined,
  ) => {
    const raw = (title || "").trim();
    let used = raw;
    if (wordLimit && wordLimit > 0) {
      const parts = raw.split(/\s+/).filter(Boolean);
      used = parts.slice(0, wordLimit).join(" ");
    }
    const clean = (used || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .join("_");
    return clean.length > 0 ? clean : `document_${idx + 1}`;
  };

  // Atomically update a single item in React state + persist to localStorage
  const updateItemAtomic = (idx: number, newItem: Partial<ProcessedItem>) => {
    setItems((prev) => {
      const copy = [...prev];
      const existing =
        copy[idx] ||
        ({
          id: Date.now() + idx,
          title: "",
          sourceTitle: "",
          givenContent: undefined,
          content: "<p>Pending generative completion...</p>",
          status: "pending",
        } as ProcessedItem);
      const merged = { ...existing, ...newItem } as ProcessedItem;
      copy[idx] = merged;
      try {
        localStorage.setItem("pro_level_items", JSON.stringify(copy));
      } catch (e) {
        /* ignore */
      }
      // Best-effort sync to optional persistent history (non-blocking)
      if (sessionId) {
        postHistory({ sessionId, items: copy, customPrompt }).catch(() => {});
      }
      return copy;
    });
  };

  const handleToggleAddEnabled = (val: boolean) => {
    setIsAddEnabled(val);
    localStorage.setItem("pro_pipeline_add_enabled", String(val));
    flashStatus(
      val
        ? "Enabled Auto keyword insertion pipeline"
        : "Disabled Auto keyword insertion pipeline",
      2500,
    );
  };

  const handleToggleReplaceEnabled = (val: boolean) => {
    setIsReplaceEnabled(val);
    localStorage.setItem("pro_pipeline_replace_enabled", String(val));
    flashStatus(
      val
        ? "Enabled Auto text replace pipeline"
        : "Disabled Auto text replace pipeline",
      2500,
    );
  };

  // Add settings helpers
  const handleAddNewField = () => {
    setAddSettings((prev) => {
      const num = prev.numFields + 1;
      const contents = [...prev.contents, ""];
      let baseValues: number[] = [];
      if (prev.mode === "sequential") {
        baseValues = [
          ...(prev.baseValues || []),
          prev.baseValues?.[prev.baseValues.length - 1] ?? 16,
        ];
      } else if (prev.mode === "alternative") {
        baseValues = [prev.baseValues?.[0] ?? 16];
      } else {
        baseValues = [];
      }
      return { ...prev, numFields: num, contents, baseValues };
    });
  };

  const handleSetAddMode = (mode: AddSettings["mode"]) => {
    setAddSettings((prev) => {
      const merged = { ...prev, mode } as AddSettings;
      if (mode === "alternative" || merged.numFields === 1) {
        merged.baseValues = [merged.baseValues?.[0] ?? 16];
      } else if (mode === "sequential") {
        merged.baseValues = (merged.baseValues || []).slice(
          0,
          merged.numFields,
        );
        while (merged.baseValues.length < merged.numFields)
          merged.baseValues.push(
            merged.baseValues[merged.baseValues.length - 1] ?? 16,
          );
      }
      return merged;
    });
  };

  const handleRemoveNewField = (index: number) => {
    if (addSettings.numFields <= 1) return;
    setAddSettings((prev) => {
      const contents = prev.contents.filter((_, i) => i !== index);
      let baseValues: number[] = [];
      if (prev.mode === "sequential") {
        baseValues = prev.baseValues.filter((_, i) => i !== index);
      } else if (prev.mode === "alternative") {
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
      if (prev.mode === "alternative" || prev.numFields === 1) {
        return { ...prev, baseValues: [val] };
      }
      const next = [...prev.baseValues];
      next[index] = val;
      return { ...prev, baseValues: next };
    });
  };

  // Replace settings helpers
  const handleAddReplaceRow = () => {
    setReplaceSettings((prev) => ({
      ...prev,
      numFind: prev.numFind + 1,
      numReplace: prev.numReplace + 1,
      finds: [...prev.finds, ""],
      replaces: [...prev.replaces, ""],
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

  // ---------------------------------------------------------------------
  // Core: process campaigns sequentially against /api/generate
  // ---------------------------------------------------------------------
  const handleProcessCampaigns = async () => {
    // Parse titles input into entries that may optionally include user-provided
    // content using the delimiter `||` or `|` like: "Title || some content to rewrite"
    const rawEntries: { title: string; givenContent?: string }[] = [];
    titlesText.split(/\r?\n/).forEach((line) => {
      line.split(",").forEach((part) => {
        const trimmed = part.trim();
        if (!trimmed) return;
        let title = trimmed;
        let givenContent: string | undefined = undefined;
        if (trimmed.includes("||")) {
          const [t, ...rest] = trimmed.split("||");
          title = (t || "").trim();
          givenContent = rest.join("||").trim();
        } else if (trimmed.includes("|")) {
          const [t, ...rest] = trimmed.split("|");
          title = (t || "").trim();
          givenContent = rest.join("|").trim();
        }
        // Sanitize any user-pasted or freeform content to make it safe and
        // well-formed before sending to the generation endpoint.
        if (givenContent && givenContent.trim().length > 0) {
          givenContent = sanitizeUserContent(givenContent);
        }
        if (title.length > 0) rawEntries.push({ title, givenContent });
      });
    });

    if (rawEntries.length === 0) {
      flashStatus(
        "⚠ Please enter at least one title to process.",
        2000,
        "info",
      );
      return;
    }

    // If user has not provided their own API key, optionally show a one-time
    // reminder modal asking them to add it. The user can close the modal to
    // suppress it until they change Titles or Prompt.
    const hasUserKeyLocal = (apiKey || "").trim().length > 0;
    try {
      // suppressedRef holds suppression state and the last values when suppressed
      if (!hasUserKeyLocal) {
        if (!suppressedRef.current.suppressed) {
          setShowApiKeyModal(true);
          return;
        } else {
          // if suppressed, only allow bypass when Titles and Prompt are unchanged
          const sameTitles = (suppressedRef.current.lastTitles || "") === (titlesText || "");
          const samePrompt = (suppressedRef.current.lastPrompt || "") === (customPrompt || "");
          if (!sameTitles || !samePrompt) {
            // values changed since suppression — show modal again
            suppressedRef.current.suppressed = false;
            setShowApiKeyModal(true);
            return;
          }
          // otherwise continue without showing modal
        }
      }
    } catch (e) {
      /* ignore modal check failures */
    }

    if (limitLeft <= 0 && !hasUserKey) {
      flashStatus(
        "Process limit reached (0 remaining). Provide your own API key to continue.",
        5000,
        "error",
      );
      return;
    }

    const processCount = Math.min(
      rawEntries.length,
      hasUserKey ? rawEntries.length : limitLeft,
    );
    const entriesToRun = rawEntries.slice(0, processCount);

    setIsLoading(true);
    const genMode = useParallelGeneration ? "🚀 Parallel" : "📝 Sequential";
    flashStatus(
      `${genMode} generation started for ${entriesToRun.length} campaign items...`,
      60000,
    );

    const initialItems: ProcessedItem[] = entriesToRun.map((entry, index) => ({
      id: Date.now() + index,
      title: entry.title,
      sourceTitle: entry.title,
      givenContent: entry.givenContent,
      content: "<p>⏳ Pending generative completion...</p>",
      status: "pending",
    }));

    saveItems(initialItems);
    setActiveIndex(0);

    const updatedItems = [...initialItems];
    let successfulRequests = 0;
    let failedRequests = 0;

    // Concurrency control: parallel mode uses 5 workers, sequential uses 1
    const concurrency = useParallelGeneration
      ? Math.min(entriesToRun.length, 5)
      : 1;
    let pointer = 0;

    const processSingle = async (idx: number) => {
      const entry = updatedItems[idx];
      let attempts = 0;
      let success = false;
      let lastError: Error | null = null;

      while (attempts < 2 && !success) {
        attempts++;
        try {
          const basePrompt = (customPrompt || "").trim();
          let payloadPrompt = basePrompt ? `${basePrompt}\n\n` : "";
          if (entry.givenContent) {
            payloadPrompt += `${LENGTH_INSTRUCTION}\n${CONTENT_STRUCTURE_INSTRUCTIONS}\n\nReturn a JSON object with keys \"title\" (string) and \"content\" (string with HTML). Do not include any additional commentary.\n\nRewrite the following content for the campaign titled: "${entry.title}". Keep a persuasive, promotional tone and retain factual details.\n\nContent:\n${entry.givenContent}`;
          } else {
            payloadPrompt += `${LENGTH_INSTRUCTION}\n${CONTENT_STRUCTURE_INSTRUCTIONS}\n\nReturn a JSON object with keys \"title\" (string) and \"content\" (string with HTML). Do not include any additional commentary.\n\nTarget Campaign Product/Topic: "${entry.title}"`;
          }

          const genRes = await generateContent({
            prompt: payloadPrompt,
            apiKey: apiKey.trim(),
          });

          if (!genRes.ok) {
            const friendly =
              (genRes as any).friendly || genRes.error || genRes.body?.error || "Server error generating content.";
            try {
              updateItemAtomic(idx, {
                status: "error",
                errorMsg: genRes.error || friendly,
                content: makeContentHtml("error", friendly),
              });
            } catch (e) {}
            lastError = new Error(genRes.error || friendly);
            break;
          }

          const data: { title: string; content: string } = genRes.data as any;
          let finalContent = cleanOutputHtml(
            data.content || "<p>No content returned.</p>",
          );

          // Move any leading heading into the title and strip it from content
          const normalized = extractLeadingHeading(
            data.title || entry.title || "",
            finalContent,
          );
          const finalTitle = normalized.title || data.title || entry.title;
          finalContent = normalized.html;

          if (isAddEnabled)
            finalContent = applyAddOperation(finalContent, addSettings);
          if (isReplaceEnabled)
            finalContent = applyReplaceOperation(finalContent, replaceSettings);

          // Show full generated HTML in the Pro Level content area by default.
          updateItemAtomic(idx, {
            title: finalTitle,
            generatedContent: finalContent,
            content: finalContent,
            status: "success",
          });
          successfulRequests++;
          success = true;
        } catch (err) {
          const e = err instanceof Error ? err : new Error("Unknown error");
          logError(
            `Pro level generator error on attempt ${attempts} for item ${idx + 1}:`,
            e,
          );
          lastError = e;

          if (attempts < 2) {
            updateItemAtomic(idx, {
              status: "pending",
              content: makeContentHtml(
                "pending",
                `Failed once (${e.message}). Retrying automatically (Attempt 2 of 2)...`,
              ),
            });
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }
      }
      if (!success) {
        updateItemAtomic(idx, {
          status: "error",
          errorMsg: lastError?.message || "AI request failed.",
          content: makeContentHtml(
            "error",
            `Failed to generate content after 2 attempts: ${lastError?.message || "Server connection timed out."}`,
          ),
        });
      }
    };

    // worker pool to process items in parallel with limited concurrency
    const workers = new Array(Math.min(concurrency, entriesToRun.length))
      .fill(null)
      .map(async () => {
        while (true) {
          const current = pointer++;
          if (current >= entriesToRun.length) break;
          // eslint-disable-next-line no-await-in-loop
          await processSingle(current);
        }
      });

    await Promise.all(workers);

    if (!hasUserKey) {
      const newLimit = Math.max(0, limitLeft - successfulRequests);
      setLimitLeft(newLimit);
      localStorage.setItem("pro_limit_left", newLimit.toString());
    }

    setIsLoading(false);

    const summary =
      failedRequests > 0
        ? `✓ Completed: ${successfulRequests}/${entriesToRun.length} generated. ${failedRequests} failed.`
        : `✓ Success! All ${successfulRequests} campaigns generated.`;
    flashStatus(
      summary,
      4000,
      successfulRequests === entriesToRun.length ? "success" : "info",
    );
  };

  // Resume any pending items that were left incomplete (e.g. user navigated away)
  const resumePendingItems = useCallback(
    async (existingItems?: ProcessedItem[]) => {
      if (isLoading) return;
      const localList = existingItems ?? items;
      if (!localList || localList.length === 0) return;

      // Normalize unexpected statuses (e.g., 'processing') to 'pending' so they will be resumed
      const normalized = localList.map((it) => ({
        ...it,
        status: it.status === "processing" ? "pending" : it.status,
      }));
      if (JSON.stringify(normalized) !== JSON.stringify(localList)) {
        saveItems(normalized);
      }

      const pendingIndexes = normalized
        .map((it, idx) => ({ it, idx }))
        .filter((x) => x.it.status === "pending")
        .map((x) => x.idx);
      if (pendingIndexes.length === 0) return;

      setIsLoading(true);
      flashStatus("Resuming pending generation...", 60000);

      // read persisted settings directly to avoid relying on setState timing
      const persistedCustomPrompt =
        localStorage.getItem("pro_custom_prompt") ?? customPrompt;
      const persistedApiKey = (
        (localStorage.getItem("pro_api_key") ?? apiKey) ||
        ""
      ).trim();
      let persistedAddSettings: AddSettings = addSettings;
      let persistedReplaceSettings: ReplaceSettings = replaceSettings;
      try {
        const s = localStorage.getItem("pro_add_settings");
        if (s) persistedAddSettings = JSON.parse(s);
      } catch (e) {}
      try {
        const s = localStorage.getItem("pro_replace_settings");
        if (s) persistedReplaceSettings = JSON.parse(s);
      } catch (e) {}
      const persistedIsAddEnabled =
        localStorage.getItem("pro_pipeline_add_enabled") === "true" ||
        isAddEnabled;
      const persistedIsReplaceEnabled =
        localStorage.getItem("pro_pipeline_replace_enabled") === "true" ||
        isReplaceEnabled;

      const updatedItems = [...localList];
      let successfulRequests = 0;

      let pointer = 0;

      const processIndex = async (idx: number) => {
        const item = updatedItems[idx];
        const currentTitle = item.title || item.sourceTitle || "Untitled";
        let attempts = 0;
        let success = false;
        let lastError: Error | null = null;

        while (attempts < 2 && !success) {
          attempts++;
          try {
            const basePrompt = (persistedCustomPrompt || "").trim();
            let payloadPrompt = basePrompt ? `${basePrompt}\n\n` : "";
            if (item.givenContent) {
              payloadPrompt += `${LENGTH_INSTRUCTION}\n${CONTENT_STRUCTURE_INSTRUCTIONS}\n\nReturn a JSON object with keys \"title\" (string) and \"content\" (string with HTML). Do not include any additional commentary.\n\nRewrite the following content for the campaign titled: "${currentTitle}". Keep a persuasive, promotional tone and retain factual details.\n\nContent:\n${item.givenContent}`;
            } else {
              payloadPrompt += `${LENGTH_INSTRUCTION}\n${CONTENT_STRUCTURE_INSTRUCTIONS}\n\nReturn a JSON object with keys \"title\" (string) and \"content\" (string with HTML). Do not include any additional commentary.\n\nTarget Campaign Product/Topic: "${currentTitle}"`;
            }

            // Ensure givenContent is normalized before sending it to the server
            if (item.givenContent && item.givenContent.trim().length > 0) {
              item.givenContent = sanitizeUserContent(item.givenContent);
            }

            const genRes = await generateContent({
              prompt: payloadPrompt,
              apiKey: persistedApiKey,
            });

            if (!genRes.ok) {
              const friendly =
                (genRes as any).friendly || genRes.error || genRes.body?.error || "Server error generating content.";
              try {
                updateItemAtomic(idx, {
                  status: "error",
                  errorMsg: genRes.error || friendly,
                  content: makeContentHtml("error", friendly),
                });
              } catch (e) {}
              lastError = new Error(genRes.error || friendly);
              break;
            }

            const data: { title: string; content: string } = genRes.data as any;
            let finalContent = cleanOutputHtml(
              data.content || "<p>No content returned.</p>",
            );

            // Move any leading heading into the title and strip it from content
            const normalized = extractLeadingHeading(
              data.title || currentTitle || "",
              finalContent,
            );
            const finalTitle = normalized.title || data.title || currentTitle;
            finalContent = normalized.html;

            if (persistedIsAddEnabled)
              finalContent = applyAddOperation(
                finalContent,
                persistedAddSettings,
              );
            if (persistedIsReplaceEnabled)
              finalContent = applyReplaceOperation(
                finalContent,
                persistedReplaceSettings,
              );
            // Show full generated HTML in the Pro Level content area by default.
            updateItemAtomic(idx, {
              title: finalTitle,
              generatedContent: finalContent,
              content: finalContent,
              status: "success",
            });
            successfulRequests++;
            success = true;
          } catch (err) {
            const e = err instanceof Error ? err : new Error("Unknown error");
            logError(
              `Pro level resume error on attempt ${attempts} for item ${idx + 1}:`,
              e,
            );
            lastError = e;

            if (attempts < 2) {
              updateItemAtomic(idx, {
                status: "pending",
                content: makeContentHtml(
                  "pending",
                  `Failed once (${e.message}). Retrying automatically (Attempt 2 of 2)...`,
                ),
              });
              await new Promise((resolve) => setTimeout(resolve, 800));
            }
          }
        }
        if (!success) {
          updateItemAtomic(idx, {
            status: "error",
            errorMsg: lastError?.message || "AI request failed.",
            content: makeContentHtml(
              "error",
              `Failed to generate content after 2 attempts: ${lastError?.message || "Server connection timed out."}`,
            ),
          });
        }
      };

      // Build a list of pending indexes and process them with limited concurrency
      const pendingList = pendingIndexes;
      const concurrency = useParallelGeneration ? pendingList.length : 1;
      const workers = new Array(Math.min(concurrency, pendingList.length))
        .fill(null)
        .map(async () => {
          while (true) {
            const p = pointer++;
            if (p >= pendingList.length) break;
            const idx = pendingList[p];
            // eslint-disable-next-line no-await-in-loop
            await processIndex(idx);
          }
        });

      await Promise.all(workers);

      if (!persistedApiKey) {
        const newLimit = Math.max(
          0,
          (parseInt(
            localStorage.getItem("pro_limit_left") || String(limitLeft),
            10,
          ) || 0) - successfulRequests,
        );
        setLimitLeft(newLimit);
        localStorage.setItem("pro_limit_left", String(newLimit));
      }

      setIsLoading(false);
      flashStatus(
        `Resumed processing. Successfully processed ${successfulRequests} campaigns.`,
        5000,
        "success",
      );
    },
    [isLoading, items],
  );

  // Auto-run resume on mount (after restoring items) and whenever resumePendingItems function updates
  useEffect(() => {
    resumePendingItems(items);
  }, [resumePendingItems]);

  // Also resume when the tab regains focus or becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") resumePendingItems();
    };
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [resumePendingItems]);

  // ---------------------------------------------------------------------
  // Active item editing
  // ---------------------------------------------------------------------
  const handleUpdateItemContent = (updatedContent: string) => {
    if (activeIndex === -1 || !items[activeIndex]) return;
    const nextItems = [...items];
    nextItems[activeIndex] = {
      ...nextItems[activeIndex],
      content: updatedContent,
    };
    saveItems(nextItems);
  };

  const handleUpdateItemTitle = (updatedTitle: string) => {
    if (activeIndex === -1 || !items[activeIndex]) return;
    const nextItems = [...items];
    nextItems[activeIndex] = { ...nextItems[activeIndex], title: updatedTitle };
    saveItems(nextItems);
  };

  const handleApplyAdd = () => {
    if (activeIndex === -1 || !items[activeIndex]) return;
    const current = items[activeIndex];
    // save current content to undo map (one-level undo per active index)
    try {
      setUndoMap((prev) => ({ ...prev, [activeIndex]: current.content }));
    } catch (e) {
      /* ignore */
    }
    const result = applyAddOperation(current.content, addSettings);
    handleUpdateItemContent(result);
    flashStatus(
      "Successfully applied keyword insertions to active campaign content.",
    );
  };

  // Toggle a heading tag exclusion (h1..h6)
  const handleToggleHeadingTag = (tag: string) => {
    setAddSettings((prev) => {
      const prevArr = Array.isArray(prev.excludeHeadingTags)
        ? [...prev.excludeHeadingTags]
        : [];
      const idx = prevArr.indexOf(tag);
      if (idx >= 0) prevArr.splice(idx, 1);
      else prevArr.push(tag);
      return { ...prev, excludeHeadingTags: prevArr } as AddSettings;
    });
  };

  const handleApplyReplace = () => {
    if (activeIndex === -1 || !items[activeIndex]) return;
    const current = items[activeIndex];
    // save current content to undo map (one-level undo per active index)
    try {
      setUndoMap((prev) => ({ ...prev, [activeIndex]: current.content }));
    } catch (e) {
      /* ignore */
    }
    const result = applyReplaceOperation(current.content, replaceSettings);
    handleUpdateItemContent(result);
    flashStatus("Applied regex override replacement successfully.");
  };

  const handleUndoActive = () => {
    if (activeIndex === -1 || !items[activeIndex]) return;
    const prev = undoMap[activeIndex];
    if (!prev) {
      flashStatus("Nothing to undo for the active item.", 1600, "info");
      return;
    }
    handleUpdateItemContent(prev);
    setUndoMap((prevMap) => {
      const copy = { ...prevMap } as Record<number, string>;
      delete copy[activeIndex];
      return copy;
    });
    flashStatus("Reverted last change on active item.", 2000, "success");
  };

  const handleClearAll = () => {
    // when clearing all, ads removed
    saveItems([]);
    setUndoMap({});
    setActiveIndex(-1);
    setTitlesText("");
    flashStatus("Cleared all processed campaigns.", 2500);
  };

  const handleClearInputs = () => {
    // Clear user-entered input fields but preserve saved API keys
    try {
      setTitlesText("");
      // reset add/replace settings to safe defaults
      setAddSettings({
        numFields: 1,
        contents: [""],
        baseValues: [16],
        mode: "alternative",
      });
      setReplaceSettings({
        numFind: 1,
        numReplace: 1,
        finds: [""],
        replaces: [""],
      });

      // remove related persisted keys
      try {
        localStorage.removeItem("pro_add_settings");
      } catch (e) {}
      try {
        localStorage.removeItem("pro_replace_settings");
      } catch (e) {}
      try {
        localStorage.removeItem("pro_is_html_mode");
      } catch (e) {}

      flashStatus(
        "Cleared input fields (Generative prompt & API keys preserved).",
        2500,
        "success",
      );
    } catch (e) {
      logError("Failed to clear inputs", e);
      flashStatus("Failed to clear inputs.", 2000, "error");
    }
  };

  // Remove titles from the `titlesText` input that have already been successfully generated
  const handleRemoveSuccessfulTitles = () => {
    try {
      if (!titlesText || titlesText.trim().length === 0)
        return flashStatus("No titles to process.", 1600, "info");
      const successSet = new Set(
        items
          .filter((it) => it.status === "success")
          .flatMap((it) => [
            String(it.sourceTitle || it.title || "")
              .trim()
              .toLowerCase(),
            String(it.title || it.sourceTitle || "")
              .trim()
              .toLowerCase(),
          ]),
      );

      const entries: string[] = [];
      titlesText.split(/\r?\n/).forEach((line) => {
        line.split(",").forEach((part) => {
          const trimmed = (part || "").trim();
          if (!trimmed) return;
          entries.push(trimmed);
        });
      });

      const remaining = entries.filter((entry) => {
        let title = entry;
        if (entry.includes("||")) title = entry.split("||")[0].trim();
        else if (entry.includes("|")) title = entry.split("|")[0].trim();
        return !successSet.has(title.toLowerCase());
      });

      const removed = entries.length - remaining.length;
      if (removed <= 0)
        return flashStatus(
          "No matching successful titles found to remove.",
          1800,
          "info",
        );
      const nextText = remaining.join("\n");
      setTitlesText(nextText);
      try {
        localStorage.setItem("pro_titles_text", nextText);
      } catch (e) {
        /* ignore */
      }
      flashStatus(
        `${removed} successful title(s) removed from input.`,
        2000,
        "success",
      );
    } catch (e) {
      logError("Failed to remove successful titles", e);
      flashStatus("Failed to remove successful titles.", 2000, "error");
    }
  };

  // ---------------------------------------------------------------------
  // Batch PDF download
  // ---------------------------------------------------------------------
  // Open batch-name modal before starting batch download
  const handleBatchDownloadPDFs = () => {
    setShowBatchNameModal(true);
  };

  // Run the batch download; if wordLimit is provided, filenames will be truncated
  // to the first `wordLimit` words.
  const runBatchDownloadPDFs = async (wordLimit?: number) => {
    const successItems = items.filter((itm) => itm.status === "success");
    if (successItems.length === 0) {
      flashStatus(
        "No successfully processed campaign items located for PDF output.",
      );
      return;
    }

    flashStatus(
      `Initializing batch download of ${successItems.length} campaign PDFs...`,
      6000,
    );

    let jsPDFCtor: any = null;
    try {
      const mod = await import("jspdf");
      jsPDFCtor = mod.jsPDF || mod.default || mod;
    } catch (err) {
      logError("Failed to load jspdf dynamically", err);
      flashStatus("Failed to load PDF generator library.", 3500, "error");
      return;
    }

    (async () => {
      for (let i = 0; i < successItems.length; i++) {
        const itm = successItems[i];
        try {
          const doc = new jsPDFCtor();

          // If this item failed to generate, produce a concise text-only PDF
          if (itm.status === "error" || itm.errorMsg) {
            const fileBase = computeFileBaseFromTitle(itm.title, i, wordLimit);
            try {
              doc.setFont("helvetica", "bold");
            } catch (e) {}
            doc.setFontSize(16);
            const titleText = (itm.title || "Untitled").toString();
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 14;
            const textStartY = 24;
            const reason = itm.errorMsg
              ? String(itm.errorMsg).replace(/\s+/g, " ").trim()
              : "Failed to generate content.";
            const short =
              reason.length > 120 ? reason.slice(0, 117) + "..." : reason;
            const titleLines = doc.splitTextToSize(
              titleText,
              pageWidth - margin * 2,
            );
            doc.text(titleLines, margin, textStartY);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            const bodyLines = doc.splitTextToSize(
              short,
              pageWidth - margin * 2,
            );
            doc.text(bodyLines, margin, textStartY + titleLines.length * 8 + 8);
            doc.save(`${fileBase}.pdf`);
            // cleanup and move to next
            continue;
          }

          // Helper to escape title text for safe insertion into HTML
          const esc = (s: string | undefined) =>
            String(s || "")
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;");

          const container = document.createElement("div");
          container.className =
            "w-full rounded-2xl p-4 text-sm leading-relaxed prose-visual-editor";
          container.style.position = "absolute";
          // Place the container off-screen (visible) so html2canvas can capture it reliably
          container.style.left = "0px";
          container.style.top = "-9999px";
          container.style.width = "800px";
          container.style.zIndex = "99999";
          container.style.pointerEvents = "none";
          container.style.background = "#ffffff";
          container.style.color = "#000000";
          container.style.opacity = "1";

          const pdfOverrideCss = `
            .prose-visual-editor, .prose-visual-editor * { background: transparent !important; color: #000 !important; fill: #000 !important; box-shadow: none !important; text-shadow: none !important; }
            .prose-visual-editor a { color: #1a0dab !important; text-decoration: underline !important; }
            .prose-visual-editor h1, .prose-visual-editor h2, .prose-visual-editor h3, .prose-visual-editor h4, .prose-visual-editor h5, .prose-visual-editor h6 { color: #000 !important; }
            .prose-visual-editor ul, .prose-visual-editor ol, .prose-visual-editor li { color: #000 !important; }
            .prose-visual-editor img { max-width: 100% !important; height: auto !important; }
          `;

          const htmlContent = itm.generatedContent || itm.content || "";
          container.innerHTML = `<style>${pdfOverrideCss}</style><div style="padding:12px"><h1 style=\"font-size:${TITLE_FONT_SIZE}px;margin-bottom:8px;color:#000;\">${esc(itm.title)}</h1><div style=\"font-size:${CONTENT_FONT_SIZE}px;\">${htmlContent}</div></div>`;
          document.body.appendChild(container);

          // If the rendered HTML content is extremely tall, skip image rendering
          // and fallback to a concise text-only PDF to avoid overflow/overlap issues.
          try {
            const contentHeight =
              container.scrollHeight || container.offsetHeight || 0;
            const hasEmoji = /\p{Extended_Pictographic}/u.test(htmlContent || "");
            // If content is extremely tall and doesn't contain emoji, fallback
            // to a concise text-only PDF to avoid memory issues. If it contains
            // emoji, prefer image-based rendering (html2canvas) so emoji are
            // preserved in the PDF.
            if (contentHeight > 30000 && !hasEmoji) {
              const fileBase = computeFileBaseFromTitle(
                itm.title,
                i,
                wordLimit,
              );
              const plain = (itm.content || "")
                .replace(/<[^>]+>/g, "")
                .replace(/\s+/g, " ")
                .trim();
              try {
                doc.setFont("helvetica", "bold");
              } catch (e) {}
              doc.setFontSize(16);
              doc.text((itm.title || "Untitled").toString(), 14, 20);
              doc.setFont("helvetica", "normal");
              doc.setFontSize(12);
              const shortPlain =
                plain.length > 120
                  ? plain.slice(0, 117) + "..."
                  : plain || "Content too large to render.";
              const lines = doc.splitTextToSize(
                shortPlain,
                doc.internal.pageSize.getWidth() - 28,
              );
              doc.text(lines, 14, 36);
              doc.save(`${fileBase}.pdf`);
              try {
                document.body.removeChild(container);
              } catch (e) {}
              continue;
            }
          } catch (e) {
            // ignore measurement failures and proceed with rendering
          }

          // Try explicit html2canvas rendering first (more reliable across themes/overlays)
          let usedHtml2Canvas = false;
          try {
            const html2canvasMod = await import("html2canvas");
            const html2canvas = (html2canvasMod &&
              (html2canvasMod.default || html2canvasMod)) as any;
            if (typeof html2canvas === "function") {
              usedHtml2Canvas = true;
              // Render the container to canvas
              const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
              });
              // guard against extremely large/invalid canvases which can produce
              // broken PDF images (overflow/overlap). If canvas dims are huge,
              // treat as a failure so we fallback to a safe text PDF.
              if (canvas.width > 8000 || canvas.height > 80000) {
                throw new Error("Rendered content too large for PDF renderer");
              }
              const imgData = canvas.toDataURL("image/png");
              const imgProps = (doc as any).getImageProperties
                ? doc.getImageProperties(imgData)
                : { width: canvas.width, height: canvas.height };
              const pdfWidth = doc.internal.pageSize.getWidth();
              const pdfHeight = doc.internal.pageSize.getHeight();
              const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

              // To avoid characters being visually cut between PDF pages when
              // slicing a long raster image, add a small overlap between
              // consecutive page slices and round positions to integer values.
              const overlapPx = 8; // overlap in canvas pixels
              const scalePdfPerPx = imgProps.width ? pdfWidth / imgProps.width : 1;
              const overlapPdf = overlapPx * scalePdfPerPx;

              let heightLeft = imgHeight;
              let position = 0;
              doc.addImage(imgData, "PNG", 0, Math.round(position), pdfWidth, imgHeight);
              // subtract one page height minus overlap so next slice overlaps slightly
              heightLeft -= pdfHeight - overlapPdf;
              let loops = 0;
              while (heightLeft > 0 && loops < 2000) {
                position -= pdfHeight - overlapPdf;
                doc.addPage();
                doc.addImage(imgData, "PNG", 0, Math.round(position), pdfWidth, imgHeight);
                heightLeft -= pdfHeight - overlapPdf;
                loops += 1;
              }

              const fileBase = computeFileBaseFromTitle(
                itm.title,
                i,
                wordLimit,
              );
              doc.save(`${fileBase}.pdf`);
            }
          } catch (e) {
            // fall through to jsPDF.html fallback
            usedHtml2Canvas = false;
            logError(
              "html2canvas render failed, falling back to jsPDF.html",
              e,
            );
          }

          if (!usedHtml2Canvas) {
            if (typeof (doc as any).html === "function") {
              await new Promise<void>((resolve, reject) => {
                try {
                  (doc as any).html(container, {
                    callback: (docInstance: any) => {
                      try {
                        const fileBase = computeFileBaseFromTitle(
                          itm.title,
                          i,
                          wordLimit,
                        );
                        docInstance.save(`${fileBase}.pdf`);
                        resolve();
                      } catch (err) {
                        reject(err);
                      }
                    },
                    x: 10,
                    y: 10,
                    html2canvas: {
                      scale: 1.5,
                      useCORS: true,
                      backgroundColor: "#ffffff",
                    },
                  });
                } catch (err) {
                  reject(err);
                }
              });
            } else {
              const fileBase = computeFileBaseFromTitle(
                itm.title,
                i,
                wordLimit,
              );
              const bodyText = (itm.content || "")
                .replace(/<[^>]+>/g, "")
                .trim();
              doc.text(bodyText, 15, 20);
              doc.save(`${fileBase}.pdf`);
            }
          }

          try {
            document.body.removeChild(container);
          } catch (e) {}
        } catch (e) {
          logError("Failed generating batch PDF for item", e);
        }
        // throttle
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 300));
      }

      flashStatus("Batch campaigns successfully built & downloaded.", 4000);
    })();
  };

  const activeItem = activeIndex !== -1 ? items[activeIndex] : null;

  // Download a single item's PDF with improved formatting
  const handleDownloadPdfForItem = async (itm: ProcessedItem, idx: number) => {
    if (!itm) return flashStatus("No item to download.", 1800, "info");

    flashStatus("Preparing PDF for download...", 1400, "info");

    let jsPDFCtor: any = null;
    try {
      const mod = await import("jspdf");
      jsPDFCtor = mod.jsPDF || mod.default || mod;
    } catch (err) {
      logError("Failed to load jspdf dynamically", err);
      flashStatus("Failed to load PDF generator library.", 3500, "error");
      return;
    }

    try {
      const doc = new jsPDFCtor();

      // Helper to escape title text for safe insertion into HTML
      const esc = (s: string | undefined) =>
        String(s || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

      // Prepare content - prefer the editor's live content for the active
      // item so that any inserted keys or manual edits are reflected in the
      // downloaded PDF. Fall back to stored/generated content otherwise.
      let htmlContent = itm.generatedContent || itm.content || "";
      if (idx === activeIndex && !isHtmlMode && editorRef.current) {
        htmlContent = (editorRef.current.innerHTML as string) || htmlContent;
      }

      // If this item failed to generate, produce a concise error PDF
      if (itm.status === "error" || itm.errorMsg) {
        const cleanFileName = computeFileBaseFromTitle(itm.title, idx);
        try {
          doc.setFont("helvetica", "bold");
        } catch (e) {}
        doc.setFontSize(16);
        const titleLines = doc.splitTextToSize(
          itm.title || "Untitled",
          doc.internal.pageSize.getWidth() - 28,
        );
        doc.text(titleLines, 14, 20);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        const reason = itm.errorMsg
          ? String(itm.errorMsg).replace(/\s+/g, " ").trim()
          : "Failed to generate content.";
        const short =
          reason.length > 250 ? reason.slice(0, 247) + "..." : reason;
        const bodyLines = doc.splitTextToSize(
          short,
          doc.internal.pageSize.getWidth() - 28,
        );
        doc.text(bodyLines, 14, 36 + titleLines.length * 6);
        doc.save(`${cleanFileName}.pdf`);
        flashStatus("✓ Error PDF downloaded.", 1800, "success");
        return;
      }

      // Create an offscreen container that mirrors editor styling with light theme override for PDF
      const container = document.createElement("div");
      container.className =
        "w-full rounded-2xl p-4 text-sm leading-relaxed prose-visual-editor";
      container.style.position = "absolute";
      container.style.left = "0px";
      container.style.top = "-9999px";
      container.style.width = "800px";
      container.style.zIndex = "99999";
      container.style.pointerEvents = "none";
      container.style.background = "#ffffff";
      container.style.color = "#000000";
      container.style.opacity = "1";

      // Enhanced PDF styling with better formatting
      const pdfOverrideCss = `
        .prose-visual-editor, .prose-visual-editor * { 
          background: transparent !important; 
          color: #000 !important; 
          fill: #000 !important; 
          box-shadow: none !important; 
          text-shadow: none !important;
          page-break-inside: avoid !important;
        }
        .prose-visual-editor a { color: #0066cc !important; text-decoration: underline !important; }
        .prose-visual-editor h1, .prose-visual-editor h2, .prose-visual-editor h3, 
        .prose-visual-editor h4, .prose-visual-editor h5, .prose-visual-editor h6 { 
          color: #000 !important; font-weight: 600 !important; margin: 12px 0 6px 0 !important;
        }
        .prose-visual-editor h1 { font-size: 24px !important; }
        .prose-visual-editor h2 { font-size: 20px !important; }
        .prose-visual-editor h3 { font-size: 16px !important; }
        .prose-visual-editor p { color: #000 !important; margin: 6px 0 !important; line-height: 1.6 !important; }
        .prose-visual-editor ul, .prose-visual-editor ol { 
          color: #000 !important; 
          margin: 8px 0 !important; 
          padding-left: 24px !important;
        }
        .prose-visual-editor li { color: #000 !important; margin: 4px 0 !important; }
        .prose-visual-editor strong { font-weight: 600 !important; color: #000 !important; }
        .prose-visual-editor em { font-style: italic !important; color: #000 !important; }
        .prose-visual-editor img { max-width: 100% !important; height: auto !important; display: block !important; }
      `;

      // Format content with proper structure
      const titleFormatted = esc(itm.title || "Untitled");
      container.innerHTML = `<style>${pdfOverrideCss}</style><div style="padding:12px"><h1 style="font-size:${TITLE_FONT_SIZE}px;margin-bottom:12px;color:#000;font-weight:700;">${titleFormatted}</h1><div style="font-size:${CONTENT_FONT_SIZE}px;color:#000;line-height:1.6;">${htmlContent}</div></div>`;
      document.body.appendChild(container);

      // Check if content is too large and fallback to text-only PDF
      try {
        const contentHeight =
          container.scrollHeight || container.offsetHeight || 0;
        const hasEmoji = /\p{Extended_Pictographic}/u.test(htmlContent || "");
        if (contentHeight > 30000 && !hasEmoji) {
          const cleanFileName = computeFileBaseFromTitle(itm.title, idx);
          const plain = (htmlContent || "")
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();
          try {
            doc.setFont("helvetica", "bold");
          } catch (e) {}
          doc.setFontSize(16);
          doc.text(String(itm.title || "Untitled"), 14, 20);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(12);
          const shortPlain =
            plain.length > 250
              ? plain.slice(0, 247) + "..."
              : plain || "Content too large to render.";
          const lines = doc.splitTextToSize(
            shortPlain,
            doc.internal.pageSize.getWidth() - 28,
          );
          doc.text(lines, 14, 36);
          doc.save(`${cleanFileName}.pdf`);
          try {
            document.body.removeChild(container);
          } catch (e) {}
          flashStatus(
            "✓ Large content PDF downloaded (text-only).",
            2000,
            "success",
          );
          return;
        }
      } catch (e) {
        // ignore measurement failures and proceed with rendering
      }

      // Try explicit html2canvas rendering first for better visual fidelity
      let usedHtml2Canvas = false;
      try {
        const html2canvasMod = await import("html2canvas");
        const html2canvas = (html2canvasMod &&
          (html2canvasMod.default || html2canvasMod)) as any;
        if (typeof html2canvas === "function") {
          usedHtml2Canvas = true;
          const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
          });

          // Guard against extremely large/invalid canvases
          if (canvas.width > 8000 || canvas.height > 80000) {
            throw new Error("Rendered content too large for PDF renderer");
          }

          const imgData = canvas.toDataURL("image/png");
          const imgProps = (doc as any).getImageProperties
            ? doc.getImageProperties(imgData)
            : { width: canvas.width, height: canvas.height };
          const pdfWidth = doc.internal.pageSize.getWidth();
          const pdfHeight = doc.internal.pageSize.getHeight();
          const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

          // To avoid cutting characters between pages, add a small overlap
          // and round positions to integer values to prevent fractional-pixel
          // rendering artifacts that can split glyphs across pages.
          const overlapPx = 12; // canvas pixels to overlap between pages
          const scalePdfPerPx = imgProps.width ? pdfWidth / imgProps.width : 1;
          const overlapPdf = overlapPx * scalePdfPerPx;

          let heightLeft = Math.round(imgHeight);
          let position = 0;
          const imgHeightRounded = Math.round(imgHeight);
          doc.addImage(imgData, "PNG", 0, Math.round(position), pdfWidth, imgHeightRounded);
          // subtract one page height minus overlap so next slice overlaps slightly
          heightLeft -= pdfHeight - overlapPdf;
          let loops = 0;
          while (heightLeft > 0 && loops < 2000) {
            position -= pdfHeight - overlapPdf;
            doc.addPage();
            doc.addImage(imgData, "PNG", 0, Math.round(position), pdfWidth, imgHeightRounded);
            heightLeft -= pdfHeight - overlapPdf;
            loops += 1;
          }

          const cleanFileName = computeFileBaseFromTitle(itm.title, idx);
          doc.save(`${cleanFileName}.pdf`);
          flashStatus("✓ PDF downloaded with formatted content.", 1800, "success");
        }
      } catch (e) {
        usedHtml2Canvas = false;
        logError("html2canvas render failed, falling back to jsPDF.html", e);
      }

      // Fallback to jsPDF.html or text-only
      if (!usedHtml2Canvas) {
        if (typeof (doc as any).html === "function") {
          await new Promise<void>((resolve, reject) => {
            try {
              (doc as any).html(container, {
                callback: (docInstance: any) => {
                  try {
                    const cleanFileName = computeFileBaseFromTitle(
                      itm.title,
                      idx,
                    );
                    docInstance.save(`${cleanFileName}.pdf`);
                    flashStatus("✓ PDF downloaded.", 1800, "success");
                    resolve();
                  } catch (err) {
                    reject(err);
                  }
                },
                x: 10,
                y: 10,
                html2canvas: {
                  scale: 1.5,
                  useCORS: true,
                  backgroundColor: "#ffffff",
                },
              });
            } catch (err) {
              reject(err);
            }
          });
        } else {
          // Fallback: text-only PDF with better formatting
          const cleanFileName = computeFileBaseFromTitle(itm.title, idx);
          const bodyText = (htmlContent || "").replace(/<[^>]+>/g, "").trim();

          try {
            doc.setFont("helvetica", "bold");
          } catch (e) {}
          doc.setFontSize(16);
          const titleLines = doc.splitTextToSize(
            itm.title || "Untitled",
            doc.internal.pageSize.getWidth() - 28,
          );
          doc.text(titleLines, 14, 20);

          try {
            doc.setFont("helvetica", "normal");
          } catch (e) {}
          doc.setFontSize(12);
          const bodyLines = doc.splitTextToSize(
            bodyText,
            doc.internal.pageSize.getWidth() - 28,
          );
          let currentY = 35 + titleLines.length * 6;
          const pageHeight = 277;
          const bottomMargin = 14;

          for (let i = 0; i < bodyLines.length; i++) {
            if (currentY > pageHeight - bottomMargin) {
              doc.addPage();
              currentY = 14;
            }
            doc.text(bodyLines[i], 14, currentY);
            currentY += 6;
          }

          doc.save(`${cleanFileName}.pdf`);
          flashStatus("✓ Text PDF downloaded.", 1800, "success");
        }
      }

      try {
        document.body.removeChild(container);
      } catch (e) {}
    } catch (e) {
      logError("Failed generating item PDF", e);
      flashStatus("✗ Failed to generate PDF. Please try again.", 3000, "error");
    }
  };

  const hasUserKey = apiKey && apiKey.trim().length > 0;

  // Copy the currently active item's title and document body with proper formatting
  const handleCopyActive = async () => {
    if (!activeItem)
      return flashStatus("No active item to copy.", 1600, "info");
    try {
      // Prefer the editor's current content (what the user sees/edited).
      // Fall back to the stored `content` or `generatedContent` otherwise.
      let rawHtml = "";
      if (!isHtmlMode && editorRef.current) {
        rawHtml =
          (editorRef.current.innerHTML as string) ||
          activeItem.content ||
          activeItem.generatedContent ||
          "";
      } else {
        rawHtml = activeItem.content || activeItem.generatedContent || "";
      }

      // Ensure proper HTML formatting with line breaks and structure
      rawHtml = rawHtml
        .replace(/<\/p>/g, "</p>\n\n")
        .replace(/<\/li>/g, "</li>\n")
        .replace(/<\/div>/g, "</div>\n")
        .trim();

      // Build HTML and plain-text payloads with proper structure
      const esc = (s: string) =>
        String(s || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br/>");

      const titleEscaped = esc(activeItem.title || "Untitled");
      const titleHtml = `<h1 style="font-weight:700;margin:0 0 16px 0;font-size:28px;line-height:1.4;">${titleEscaped}</h1>`;
      const contentHtml = `<div style="font-size:14px;line-height:1.6;color:#333;">${rawHtml}</div>`;

      // Create comprehensive HTML document with styling
      const htmlPayload = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
    h1, h2, h3, h4, h5, h6 { margin: 16px 0 8px 0; line-height: 1.4; }
    p { margin: 8px 0; }
    ul, ol { margin: 8px 0; padding-left: 24px; }
    li { margin: 4px 0; }
    strong { font-weight: 600; }
    em { font-style: italic; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  ${titleHtml}
  ${contentHtml}
</body>
</html>`;

      // Extract plain text with proper formatting
      const tmp = document.createElement("div");
      tmp.innerHTML = `${titleEscaped}\n\n${rawHtml}`;
      const plain = (tmp.textContent || tmp.innerText || "").trim();

      // Use the asynchronous Clipboard API to write both HTML and plain text
      if (navigator.clipboard && (navigator.clipboard as any).write) {
        try {
          const blobHtml = new Blob([htmlPayload], { type: "text/html" });
          const blobText = new Blob([plain], { type: "text/plain" });
          // @ts-ignore - ClipboardItem may not be present in all TS libs
          const item = new ClipboardItem({
            "text/html": blobHtml,
            "text/plain": blobText,
          });
          await (navigator.clipboard as any).write([item]);
          flashStatus(
            "✓ Copied formatted content with title & styling to clipboard.",
            2000,
            "success",
          );
        } catch (e) {
          // Fallback to plain text only
          await navigator.clipboard.writeText(plain);
          flashStatus(
            "✓ Copied plain text to clipboard (formatting unavailable).",
            2000,
            "info",
          );
        }
      } else {
        await navigator.clipboard.writeText(plain);
        flashStatus("✓ Copied content to clipboard.", 2000, "success");
      }
    } catch (e) {
      logError("Copy failed", e);
      flashStatus("✗ Failed to copy content. Please try again.", 2000, "error");
    }
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 md:p-8 flex flex-col items-center font-sans">
      <div className="w-full max-w-7xl flex flex-col gap-6 relative z-10">
        {/* Floating status alert */}
        {triggerStatus && (
          <div
            className={`fixed top-6 right-6 z-50 px-4 py-3 backdrop-blur-md rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xl transition duration-300 max-w-sm ${
              triggerType === "success"
                ? "bg-[#10b981]/25 border border-[#10b981]/50 text-[#10b981]"
                : triggerType === "error"
                  ? "bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444]"
                  : "bg-white/5 border border-white/10 text-white/80"
            }`}
          >
            {isLoading ? (
              <Loader2 size={15} className="animate-spin shrink-0" />
            ) : triggerType === "error" ? (
              <Trash2 size={15} className="shrink-0" />
            ) : (
              <CheckCircle2 size={15} className="shrink-0" />
            )}
            <span>{triggerStatus}</span>
          </div>
        )}

        {/* Missing API Key modal (portal) */}
        {showApiKeyModal &&
          createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/70"
                onClick={() => setShowApiKeyModal(false)}
              />
              <div className="relative z-60 bg-[#0b1220] border border-white/10 rounded-3xl p-6 w-[min(720px,90%)] text-left">
                <h3 className="text-lg font-bold mb-2">API Key Required</h3>
                <p className="text-sm text-zinc-300 mb-4">
                  Please provide your API key to continue generating content. You
                  can manage API keys on the AI Studio page.
                </p>
                <div className="flex items-center gap-3 justify-end">
                  <button
                    type="button"
                    onClick={handleOpenApiKeyFromModal}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-extrabold uppercase tracking-widest text-sky-400 transition"
                  >
                    API Key
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseApiKeyModal}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            typeof document !== "undefined" && document.body
              ? document.body
              : document.createElement("div"),
          )}

        {/* Ambient background glows */}
        <div className="absolute top-0 right-[20%] w-[300px] h-[300px] bg-sky-500/10 rounded-full filter blur-[100px] pointer-events-none" />
        <div className="absolute bottom-10 left-[10%] w-[400px] h-[400px] bg-purple-500/5 rounded-full filter blur-[120px] pointer-events-none" />

        {/* TOP COMPONENT: CAMPAIGN MANAGER */}
        <div className="bg-[#18181b]/50 border border-white/10 rounded-3xl p-5 md:p-8 backdrop-blur-xl relative overflow-hidden text-left">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 border border-sky-400/20 text-sky-400 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">
                PRO CAMPAIGN INTERACTIVE PORTAL
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight flex items-center gap-2 text-white">
                <Award className="text-sky-400 shrink-0" size={28} /> PRO LEVEL
                CAMPAIGN GENERATOR
              </h1>
              <p className="text-xs text-white/50 uppercase tracking-wider mt-1">
                Process multiple campaigns at once (comma or line split),
                monitor process limits, inject targeted text modifiers and
                output high-converting PDF deliverables.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-[#27272a]/80 p-3 rounded-2xl border border-white/10 self-stretch md:self-auto justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 block">
                  Processed Limit Left
                </span>
                <span className="text-xl font-black text-sky-400">
                  {limitLeft}{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    / {hasUserKey ? "Unlimited" : DEFAULT_DAILY_LIMIT + " left"}
                  </span>
                </span>
              </div>
              {/* Indicator: green when usable, red when exhausted and no user key */}
              <div
                className={`h-2 w-2 rounded-full shrink-0 ${
                  hasUserKey || limitLeft > 0
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-red-500"
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Multiple Title Ideas (split by commas or lines)
                </label>
                <button
                  type="button"
                  onClick={handleRemoveSuccessfulTitles}
                  disabled={
                    isLoading ||
                    items.filter((it) => it.status === "success").length === 0
                  }
                  title="Remove titles that were successfully generated"
                  className="ml-3 text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-2xl font-bold text-black"
                >
                  Remove Successful Titles
                </button>
              </div>
              <textarea
                value={titlesText}
                onChange={(e) => setTitlesText(e.target.value)}
                placeholder="E.g. Summer Discounts, Black Friday, Cyber Monday Deals..."
                rows={4}
                className="w-full rounded-2xl bg-black/40 border border-white/10 p-4 text-xs font-mono text-white outline-none focus:border-sky-400 placeholder-zinc-600 leading-relaxed resize-none"
              />

              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-2">
                AI API Key (optional — uses server default if blank)
              </label>
              <div
                ref={apiKeyContainerRef}
                className="flex items-center gap-2 mt-1 relative"
              >
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onBlur={() => saveCurrentApiKey()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveCurrentApiKey();
                    }
                  }}
                  placeholder="Enter your Gemini API key..."
                  className="flex-1 rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-xs text-white outline-none focus:border-sky-400 font-mono"
                />
                <button
                  ref={apiKeyButtonRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // anchor to the key button when available, fallback to container
                    try {
                      const rect =
                        apiKeyButtonRef.current?.getBoundingClientRect() ??
                        apiKeyContainerRef.current?.getBoundingClientRect();
                      if (rect) {
                        const desiredWidth = Math.min(
                          520,
                          Math.max(220, rect.width || 40),
                        );
                        const viewportLeft = rect.left;
                        const clampedLeft = Math.min(
                          Math.max(viewportLeft, 8),
                          Math.max(8, window.innerWidth - desiredWidth - 8),
                        );
                        setDropdownPosition({
                          left: clampedLeft,
                          top: rect.bottom + 6,
                          width: desiredWidth,
                        });
                      } else {
                        setDropdownPosition(null);
                      }
                    } catch (err) {
                      setDropdownPosition(null);
                    }
                    // If there are no saved keys, show a one-time tooltip to guide the user
                    if (!savedApiKeys || savedApiKeys.length === 0) {
                      setShowFirstClickTooltip(true);
                      window.setTimeout(
                        () => setShowFirstClickTooltip(false),
                        2200,
                      );
                    }
                    setShowApiKeyList((s) => !s);
                  }}
                  title="Select saved API key"
                  aria-expanded={showApiKeyList}
                  className={`px-3 py-2 border rounded-2xl transition-colors ${showApiKeyList ? "bg-white/10 border-white/20 text-white" : "bg-white/5 hover:bg-white/10 border-white/10 text-sky-400"}`}
                >
                  <Key size={16} />
                </button>
                {showFirstClickTooltip && (
                  <div className="absolute -top-10 right-12 z-50 px-3 py-1 bg-black/80 text-xs rounded-md border border-white/10">
                    No API key found — enter a key to save it
                  </div>
                )}
                <a
                  href="https://aistudio.google.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-extrabold uppercase tracking-widest text-sky-400 transition"
                  title="Open API key settings"
                >
                  API Key
                </a>

                {showApiKeyList &&
                  createPortal(
                    <div
                      ref={apiKeyListRef}
                      style={
                        dropdownPosition
                          ? {
                              position: "fixed",
                              left: dropdownPosition.left,
                              top: dropdownPosition.top,
                              width: dropdownPosition.width,
                              zIndex: 9999,
                            }
                          : {
                              position: "absolute",
                              right: 0,
                              top: "100%",
                              marginTop: 8,
                            }
                      }
                      className="z-50"
                    >
                      <div
                        className="flex flex-col items-center"
                        style={{ pointerEvents: "auto" }}
                      >
                        {/* top header button (blue) to match provided design */}
                        <div
                          className="bg-sky-300/75 text-black px-4 py-2 rounded-md shadow-md flex items-center justify-between w-full mb-2"
                          style={{ borderRadius: 10 }}
                        >
                          <div className="flex items-center gap-2 font-bold text-sm">
                            <Key size={16} />
                            <span className="text-sm">Saved API Keys</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenApiKeyDeletePicker();
                              }}
                              title="Delete saved API key"
                              className="text-black/60 hover:text-black/80 p-1 rounded-md"
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCleanTestData();
                              }}
                              title="Clean test keys & items"
                              className="text-black/60 hover:text-black/80 p-1 rounded-md"
                            >
                              <RefreshCw size={14} />
                            </button>
                            <div className="text-black/60">
                              <ChevronDown size={14} />
                            </div>
                          </div>
                        </div>

                        {/* Delete picker overlay (shows when user clicked delete in header) */}
                        {showApiKeyDeletePicker && (
                          <div className="bg-white rounded-md border border-white/10 shadow-lg w-full p-3 mb-2">
                            <div className="flex items-center justify-between">
                              <div className="font-bold text-sm text-black">
                                Select API key(s) to delete
                              </div>
                              <div className="text-xs text-black/50">
                                Select multiple keys then press Delete Selected
                              </div>
                            </div>
                            <div className="mt-2 max-h-48 overflow-y-auto custom-scrollbar">
                              {savedApiKeys.length === 0 ? (
                                <div className="text-sm text-zinc-700 p-2">
                                  No saved API keys.
                                </div>
                              ) : (
                                <div className="flex flex-col divide-y divide-gray-200">
                                  {savedApiKeys.map((k, idx) => (
                                    <label
                                      key={`del-${k}-${idx}`}
                                      className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-100 ${apiKeysToDelete[k] ? "bg-red-50 border-l-4 border-red-400" : ""}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={!!apiKeysToDelete[k]}
                                        onChange={() => {
                                          setApiKeysToDelete((prev) => ({
                                            ...prev,
                                            [k]: !prev[k],
                                          }));
                                        }}
                                        className="mr-2"
                                      />
                                      <span className="text-sm text-black font-mono break-all">
                                        {k}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setApiKeysToDelete({});
                                  handleCancelApiKeyDelete();
                                }}
                                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-xs font-bold"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleConfirmDeleteApiKey}
                                className="px-3 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-md text-xs font-bold text-white"
                              >
                                Delete Selected
                              </button>
                            </div>
                          </div>
                        )}

                        {/* list container */}
                        <div className="bg-white rounded-xl border border-white/10 shadow-lg w-full overflow-hidden">
                          {savedApiKeys.length === 0 ? (
                            <div className="text-sm text-zinc-700 p-4">
                              No saved API keys.
                            </div>
                          ) : (
                            <div className="flex flex-col divide-y divide-gray-200 max-h-56 overflow-y-auto">
                              {savedApiKeys.map((k, idx) => (
                                <button
                                  key={`${k}-${idx}`}
                                  onClick={() => handleSelectApiKey(k)}
                                  className={`text-left px-4 py-4 hover:bg-gray-50 flex items-center gap-3 ${apiKey === k || selectedSavedKey === k ? "bg-gray-100" : ""}`}
                                >
                                  <span className="text-sm text-black font-mono break-all">
                                    {k}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>,
                    typeof document !== "undefined" && document.body
                      ? document.body
                      : document.createElement("div"),
                  )}
              </div>
            </div>

            <div className="flex flex-col gap-3 justify-between">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Generative Direct Prompt
                </label>
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="write prompt here...."
                  className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-xs text-white outline-none focus:border-sky-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 py-2 px-3 bg-white/5 border border-white/5 rounded-2xl">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-400">
                  Auto-Apply Pipeline:
                </span>
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={isAddEnabled}
                    onChange={(e) => handleToggleAddEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-black/40 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-[#18181b] cursor-pointer"
                  />
                  <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Add Insertion
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={isReplaceEnabled}
                    onChange={(e) =>
                      handleToggleReplaceEnabled(e.target.checked)
                    }
                    className="w-4 h-4 rounded border-white/10 bg-black/40 text-sky-400 focus:ring-sky-400 focus:ring-offset-[#18181b] cursor-pointer"
                  />
                  <span className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors">
                    Find &amp; Replace
                  </span>
                </label>
              </div>

              <div className="flex gap-2 mt-2 items-center">
                <button
                  type="button"
                  onClick={handleProcessCampaigns}
                  disabled={isLoading || !titlesText.trim()}
                  className="flex-1 py-3 px-6 bg-sky-500 hover:bg-sky-600 disabled:bg-zinc-800 disabled:opacity-40 rounded-2xl text-xs font-extrabold uppercase tracking-widest text-black transition-all hover:scale-[1.01] active:translate-y-0.5 flex items-center justify-center gap-2 select-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-black" />
                      {useParallelGeneration
                        ? "Parallel Processing..."
                        : "Sequential Processing..."}
                    </>
                  ) : (
                    <>
                      <Send size={14} className="text-black" />
                      Process Campaigns
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2 pl-2">
                  <label className="text-xs flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={useParallelGeneration}
                      onChange={(e) => {
                        setUseParallelGeneration(e.target.checked);
                        localStorage.setItem(
                          "pro_use_parallel_generation",
                          String(e.target.checked),
                        );
                      }}
                    />
                    <span className="text-[10px] font-bold">
                      Parallel Generation
                    </span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleClearInputs}
                  disabled={isLoading}
                  title="Clear form input fields (preserves saved API keys)"
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 rounded-2xl text-xs font-bold transition-all"
                >
                  <FileText size={14} />
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isLoading || items.length === 0}
                  title="Clear all processed items"
                  className="px-4 py-3 bg-white/5 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30 border border-white/10 rounded-2xl text-xs font-bold transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Ads removed */}
        <div className="w-full my-4" />

        {/* WORKSPACE GRID */}
        <div
          className={`grid grid-cols-1 md:grid-cols-[320px_1fr] ${
            isAddEnabled || isReplaceEnabled
              ? "lg:grid-cols-[320px_1fr_320px]"
              : "lg:grid-cols-[320px_1fr]"
          } gap-2 md:gap-3 lg:gap-4 items-stretch text-left`}
        >
          {/* PANEL 1: TITLES LIST */}
          <div className="lg:col-span-1 bg-[#121214] border border-white/5 rounded-3xl p-2 md:p-3 flex flex-col gap-2 md:gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Processed Items ({items.length})
              </span>
              <span className="text-[8px] uppercase font-mono px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-lg">
                List Queue
              </span>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar">
              {items.map((itm, idx) => {
                const isActive = idx === activeIndex;
                const isSelected = !!selectedItems[idx];
                // Title text color: highlighted when active, neutral otherwise
                const statusColor = isActive
                  ? "text-zinc-100"
                  : "text-zinc-400";
                // Dot indicates per-item status regardless of active selection
                let indicatorDot = "bg-zinc-500";
                if (itm.status === "success") {
                  indicatorDot = "bg-emerald-500";
                } else if (itm.status === "error") {
                  indicatorDot = "bg-red-500";
                } else if (itm.status === "pending") {
                  indicatorDot = "bg-sky-400 animate-ping";
                }

                return (
                  <div
                    key={itm.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveIndex(idx);
                      // select only this item (single-selection)
                      setSelectedItems(() => ({ [idx]: true }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveIndex(idx);
                        setSelectedItems(() => ({ [idx]: true }));
                      }
                    }}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center gap-2.5 ${
                      isActive
                        ? "bg-white/5 border-white/10 shadow-xl"
                        : isSelected
                          ? "bg-emerald-900/20 border-emerald-500/20"
                          : "bg-black/20 border-transparent hover:bg-white/[0.02]"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${indicatorDot}`}
                    />
                    <div className="min-w-0 flex-1">
                      <span
                        className={`text-xs block font-bold truncate leading-tight ${statusColor}`}
                      >
                        {itm.title}
                      </span>
                      <span className="text-[9px] text-zinc-500 block truncate mt-1">
                        Source: {itm.sourceTitle}
                      </span>
                    </div>

                    {/* per-item PDF download button (does not change active selection) */}
                    <div className="ml-3 flex-shrink-0">
                      <button
                        type="button"
                        title="Download this item as PDF"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPdfForItem(itm, idx);
                        }}
                        className="p-2 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <div className="py-12 text-center text-xs italic text-zinc-600 flex flex-col items-center gap-1">
                  <FileText size={20} className="opacity-35" />
                  No processing queues queued yet.
                </div>
              )}
            </div>
          </div>

          {/* PANEL 2: ACTIVE REPORT VIEW */}
          <div className={`lg:col-span-1 bg-[#121214] border border-[#27272a] rounded-3xl p-5 md:p-6 flex flex-col gap-4 transition-all duration-300`}>
            {activeItem ? (
              <div className="flex flex-col gap-4">
                <div className="flex-1 flex flex-col gap-4">
                  {/* Document title and header (spans both editor and output) */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 flex flex-col gap-1">
                      <span
                        style={{ color: ACTIVE_COLOR }}
                        className="text-[10px] font-black uppercase tracking-widest"
                      >
                        Active Campaign Header
                      </span>
                      <input
                        type="text"
                        value={activeItem.title}
                        onChange={(e) => handleUpdateItemTitle(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 focus:border-white/20 p-2.5 rounded-xl font-bold text-sm outline-none text-white leading-normal"
                      />
                    </div>
                  </div>

                  {/* Editor + Output container: stacks on small, side-by-side on md+ */}
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Editor column */}
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                        <span
                          style={{ color: ACTIVE_COLOR }}
                          className="text-[10px] font-black uppercase tracking-widest"
                        >
                          Document Body
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsHtmlMode(!isHtmlMode)}
                            className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] uppercase font-black tracking-widest rounded-lg text-sky-400 transition cursor-pointer"
                          >
                            {isHtmlMode
                              ? "Switch to Read View"
                              : "Switch to Raw HTML"}
                          </button>

                          <div className="flex items-center gap-2">
                            <div className="relative" ref={editorMenuRef}>
                              <button
                                type="button"
                                title="Editor options"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowEditorMenu((s) => !s);
                                }}
                                className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/80 transition"
                              >
                                <MoreHorizontal size={14} />
                              </button>

                              {showEditorMenu && (
                                <div className="absolute right-0 mt-2 w-48 bg-[#0b0b0c] border border-white/10 rounded-md shadow-lg z-50 p-2">
                                  <div className="text-xs text-white/60 mb-2">
                                    Editor Options
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="flex items-center gap-2 text-xs">
                                      <input
                                        type="checkbox"
                                        checked={
                                          Array.isArray(
                                            addSettings.excludeHeadingTags,
                                          ) &&
                                          addSettings.excludeHeadingTags.includes(
                                            "h1",
                                          )
                                        }
                                        onChange={() =>
                                          handleToggleHeadingTag("h1")
                                        }
                                      />
                                      <span>Exclude H1 from Add</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs">
                                      <input
                                        type="checkbox"
                                        checked={
                                          Array.isArray(
                                            addSettings.excludeHeadingTags,
                                          ) &&
                                          addSettings.excludeHeadingTags.includes(
                                            "h2",
                                          )
                                        }
                                        onChange={() =>
                                          handleToggleHeadingTag("h2")
                                        }
                                      />
                                      <span>Exclude H2 from Add</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs">
                                      <input
                                        type="checkbox"
                                        checked={
                                          Array.isArray(
                                            addSettings.excludeHeadingTags,
                                          ) &&
                                          addSettings.excludeHeadingTags.includes(
                                            "h3",
                                          )
                                        }
                                        onChange={() =>
                                          handleToggleHeadingTag("h3")
                                        }
                                      />
                                      <span>Exclude H3 from Add</span>
                                    </label>
                                  </div>
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              title="Regenerate content for this item"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRegenerateActive();
                              }}
                              disabled={isRegenerating}
                              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/80 transition disabled:opacity-40"
                            >
                              {isRegenerating ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <RefreshCw size={14} />
                              )}
                            </button>
                            <button
                              type="button"
                              title="Copy active title + body"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyActive();
                              }}
                              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/80 transition"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {isHtmlMode ? (
                        <textarea
                          value={activeItem.content}
                          onChange={(e) =>
                            handleUpdateItemContent(e.target.value)
                          }
                          className="w-full rounded-2xl bg-black/40 border border-white/5 p-4 text-xs font-mono text-white outline-none focus:border-white/20 leading-relaxed"
                        />
                      ) : (
                        <div
                          ref={editorRef}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={(e) => {
                            const html = (e.currentTarget as HTMLDivElement)
                              .innerHTML;
                            handleUpdateItemContent(html);
                          }}
                          onPaste={(e: any) => {
                            try {
                              e.preventDefault();
                              const clipboard =
                                (e && e.clipboardData) ||
                                (window as any).clipboardData;
                              const text = clipboard
                                ? clipboard.getData("text")
                                : "";
                              const cleaned = sanitizeUserContent(text || "");
                              const html = cleaned
                                .split(/\n{2}/)
                                .map((p) => `<p>${escapeHtml(p)}</p>`)
                                .join("");
                              // insert sanitized html at caret
                              document.execCommand("insertHTML", false, html);
                              const htmlNow = (e.currentTarget as HTMLDivElement)
                                .innerHTML;
                              handleUpdateItemContent(htmlNow);
                            } catch (err) {
                              // fallback to default paste if anything fails
                            }
                          }}
                          className="w-full rounded-2xl bg-black/40 border border-white/5 p-4 text-sm text-zinc-100 outline-none focus:border-white/20 leading-relaxed prose-visual-editor text-left"
                          style={{ overflow: "visible" }}
                        />
                      )}

                      {/* Ads removed */}
                    </div>

                    {/* Output column removed — editor now takes full width */}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-zinc-600 gap-4">
                {/* Ads removed */}
                <div className="w-full max-w-2xl">
                  <div className="w-full h-28" />
                </div>
              </div>
            )}
          </div>

          {/* Right-side Add/Replace panel (rendered via RightPanel component) */}
          {(isAddEnabled || isReplaceEnabled) && (
            <div className="lg:col-span-1">
              <RightPanel
                activeTools={{ add: isAddEnabled, replace: isReplaceEnabled }}
                addSettings={addSettings}
                onAddSettingsChange={(patch) =>
                  setAddSettings((prev) => ({
                    ...prev,
                    ...(patch as Partial<typeof prev>),
                  }))
                }
                replaceSettings={replaceSettings}
                onReplaceSettingsChange={(patch) =>
                  setReplaceSettings((prev) => ({
                    ...prev,
                    ...(patch as Partial<typeof prev>),
                  }))
                }
                isAddEnabled={isAddEnabled}
                isReplaceEnabled={isReplaceEnabled}
                onToggleAddEnabled={handleToggleAddEnabled}
                onToggleReplaceEnabled={handleToggleReplaceEnabled}
                onAddNewField={handleAddNewField}
                onRemoveNewField={handleRemoveNewField}
                onApplyAdd={handleApplyAdd}
                onUndoActive={handleUndoActive}
                undoDisabled={!undoMap[activeIndex]}
              />
            </div>
          )}
        </div>

        {/* Ads removed */}
        <div className="w-full my-4" />

        {/* BOTTOM: PAGINATION + PDF DOWNLOAD */}
        {items.length > 0 && (
          <div className="bg-[#18181b]/40 border border-white/5 rounded-3xl p-5 block relative z-10">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mr-2 shrink-0">
                  Document index:
                </span>
                {items.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveIndex(idx)}
                    className={`h-8 w-8 rounded-xl text-xs font-bold transition flex items-center justify-center shrink-0 ${
                      idx === activeIndex
                        ? "text-black font-semibold shadow-lg"
                        : "bg-white/5 hover:bg-white/10 text-white/50 hover:text-white"
                    }`}
                    style={
                      idx === activeIndex
                        ? {
                            backgroundColor: ACTIVE_COLOR,
                            boxShadow: "0 10px 30px rgba(16,185,129,0.12)",
                          }
                        : undefined
                    }
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleBatchDownloadPDFs}
                  style={{
                    backgroundColor: BUTTON_BG_COLOR,
                    color: BUTTON_TEXT_COLOR,
                  }}
                  className="px-5 py-3 text-xs font-extrabold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition active:scale-[0.98]"
                >
                  <Download size={15} />
                  Multiple PDF Download (One-Click)
                </button>
              </div>
            </div>
          </div>
        )}
        {showBatchNameModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                setShowBatchNameModal(false);
                setBatchNameWordCount("");
              }}
            />
            <div className="relative bg-[#0b0b0c] border border-white/10 rounded-lg p-6 w-full max-w-sm text-white">
              <h3 className="text-lg font-bold mb-2">PDF Filename Options</h3>
              <p className="text-sm text-white/60 mb-3">
                Optionally limit generated PDF filenames to the first N words
                from the title. Leave blank to use full title.
              </p>
              <input
                type="number"
                min={1}
                value={batchNameWordCount}
                onChange={(e) => setBatchNameWordCount(e.target.value)}
                placeholder="e.g. 3"
                className="w-full p-2 rounded bg-black/40 border border-white/10 mb-3 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowBatchNameModal(false);
                    setBatchNameWordCount("");
                  }}
                  className="px-3 py-1 bg-white/5 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const n = parseInt(batchNameWordCount || "", 10);
                    const limit = isNaN(n) || n <= 0 ? undefined : n;
                    setShowBatchNameModal(false);
                    setBatchNameWordCount("");
                    // start batch download with optional limit
                    runBatchDownloadPDFs(limit);
                  }}
                  className="px-3 py-1 bg-emerald-500 text-black rounded font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
