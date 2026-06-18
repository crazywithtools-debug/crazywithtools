"use client";

import { useRef, useEffect, useState, type RefObject, type FC } from "react";
import {
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Smile,
  ChevronDown,
  Palette,
} from "lucide-react";
import EmojiPicker from "./EmojiPicker";
import {
  themeColorMix,
  THEME_COLOR,
  TEXT_COLOR,
  ACTIVE_COLOR,
} from "@/lib/utils";

interface MainEditorProps {
  title: string;
  onTitleChange: (t: string) => void;
  content: string;
  onContentChange: (c: string) => void;
  showToolbar?: boolean;
  /** Optional external ref to the editable content div so parent can access it */
  editorRefProp?: RefObject<HTMLDivElement>;
  /** Optional inline style applied to the editable content area */
  contentStyle?: React.CSSProperties;
  /** Optional className applied to the editable content area */
  contentClassName?: string;
}

export const MainEditor: FC<MainEditorProps> = ({
  title,
  onTitleChange,
  content,
  onContentChange,
  showToolbar = true,
  editorRefProp,
  contentStyle,
  contentClassName,
}) => {
  const internalEditorRef = useRef<HTMLDivElement | null>(null);
  const editorRef = editorRefProp ?? internalEditorRef;
  const titleRef = useRef<HTMLInputElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTarget, setEmojiTarget] = useState<"content" | "title">(
    "content",
  );
  const [titleSelection, setTitleSelection] = useState({ start: 0, end: 0 });

  useEffect(() => {
    try {
      const el = editorRef && "current" in editorRef ? editorRef.current : null;
      if (!el) return;
      // If the editor currently has focus, avoid overwriting innerHTML as that
      // will reset the caret/selection to the start. Wait until blur to apply
      // external changes to content.
      if (document.activeElement === el) return;
      if (el.innerHTML !== content) el.innerHTML = content || "";
    } catch (e) {
      /* ignore */
    }
  }, [content, editorRef]);

  const updateTitleSelection = () => {
    const input = titleRef.current;
    if (!input) return;
    setTitleSelection({
      start: input.selectionStart ?? 0,
      end: input.selectionEnd ?? 0,
    });
  };

  const insertEmojiToTitle = (emoji: string) => {
    const text = title || "";
    const { start, end } = titleSelection;
    const safeStart = Math.min(start, text.length);
    const safeEnd = Math.min(end, text.length);
    const nextTitle = text.slice(0, safeStart) + emoji + text.slice(safeEnd);
    onTitleChange(nextTitle);
    setShowEmojiPicker(false);
    window.requestAnimationFrame(() => {
      const input = titleRef.current;
      if (input) {
        input.focus();
        const position = safeStart + emoji.length;
        input.setSelectionRange(position, position);
      }
    });
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    selectionRangeRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    if (!selection || !selectionRangeRef.current) return;
    selection.removeAllRanges();
    selection.addRange(selectionRangeRef.current);
    editorRef.current?.focus();
  };

  const insertHtmlAtSelection = (html: string) => {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const fragment = range.createContextualFragment(html);
    range.insertNode(fragment);
    range.collapse(false);
  };

  useEffect(() => {
    if (!toolbarRef.current || !sectionRef.current) return;

    const update = () => {
      const sec = sectionRef.current as HTMLElement;
      const tb = toolbarRef.current as HTMLDivElement;
      const secRect = sec.getBoundingClientRect();
      const secStyle = window.getComputedStyle(sec);
      const padLeft = parseFloat(secStyle.paddingLeft || "0") || 0;
      const padRight = parseFloat(secStyle.paddingRight || "0") || 0;
      const left = secRect.left + padLeft;
      const width = Math.max(200, secRect.width - padLeft - padRight);

      tb.style.position = "fixed";
      tb.style.left = `${left}px`;
      tb.style.width = `${width}px`;
      tb.style.top = `64px`;
      tb.style.zIndex = "1200";
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("scroll", update, true);
      if (toolbarRef.current) {
        toolbarRef.current.style.position = "";
        toolbarRef.current.style.left = "";
        toolbarRef.current.style.width = "";
        toolbarRef.current.style.top = "";
        toolbarRef.current.style.zIndex = "";
      }
    };
  }, [showToolbar]);

  const execCommand = (command: string, value: string | null = null) => {
    if (command !== "insertHTML" && selectionRangeRef.current) {
      restoreSelection();
    }

    if (editorRef.current) editorRef.current.focus();

    if (command === "insertHTML" && value) {
      insertHtmlAtSelection(value);
      if (editorRef.current) onContentChange(editorRef.current.innerHTML);
      return;
    }

    // @ts-ignore execCommand is deprecated but still useful for this editor
    document.execCommand(command, false, value || undefined);
    if (editorRef.current) onContentChange(editorRef.current.innerHTML);
  };

  const handleInsertLink = () => {
    saveSelection();
    const url = prompt("Enter URL:", "https://");
    if (url) {
      execCommand("createLink", url);
    }
  };

  const handleFontSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) return;

    if (value === "custom") {
      const size = prompt("Enter font size in pixels (e.g., 20):");
      if (size && !isNaN(parseInt(size))) {
        applyFontSize(parseInt(size, 10));
      }
    } else {
      applyFontSize(parseInt(value, 10));
    }
    e.currentTarget.value = "";
  };

  const handleFontFamily = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      execCommand("fontName", value);
      e.currentTarget.value = "";
    }
  };

  const handleHeading = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      execCommand("formatBlock", value);
      e.currentTarget.value = "";
    }
  };

  const handleTextColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    if (color) {
      execCommand("foreColor", color);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imgHtml = `<img src="${event.target?.result}" style="max-width: 90%; display: block; margin: 10px auto; border-radius: 8px;" />`;
        insertHtmlAtSelection(imgHtml);
        if (editorRef.current) onContentChange(editorRef.current.innerHTML);
      };
      reader.readAsDataURL(file);
    }
  };

  const applyFontSize = (size: number) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
      return;

    const range = selection.getRangeAt(0);
    const span = document.createElement("span");
    span.style.fontSize = `${size}px`;

    try {
      range.surroundContents(span);
    } catch {
      const content = range.extractContents();
      span.appendChild(content);
      range.insertNode(span);
    }

    if (editorRef.current) onContentChange(editorRef.current.innerHTML);
  };

  return (
    <div className="w-full flex-1 flex flex-col min-w-0 p-1.5 sm:p-3 md:p-4 lg:p-6">
      <section
        ref={sectionRef}
        className="w-full bg-gradient-to-br from-white/5 to-transparent backdrop-blur-sm rounded-lg md:rounded-xl border shadow-sm flex flex-col min-w-0 flex-1 min-h-0 overflow-hidden"
        style={{ borderColor: themeColorMix() }}
      >
        {/* Title Header */}
        <header
          className="relative px-3 sm:px-4 md:px-6 pt-2 sm:pt-3 md:pt-4 pb-2 sm:pb-3 md:pb-4 border-b bg-white/5 flex flex-col gap-2 sm:gap-3"
          style={{ borderColor: themeColorMix() }}
        >
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            <span
              className="text-[10px] sm:text-xs font-bold uppercase tracking-widest bg-white/10 px-2 py-1 rounded-md"
              style={{ color: THEME_COLOR, opacity: 0.55 }}
            >
              Title
            </span>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmojiTarget("title");
                  setShowEmojiPicker((p) => !p);
                }}
                className="p-1.5 sm:p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                title="Insert emoji into title"
                style={{ color: THEME_COLOR }}
                aria-label="Insert emoji into title"
              >
                <Smile size={16} />
              </button>
            </div>
          </div>
          <input
            ref={titleRef}
            type="text"
            inputMode="text"
            autoCapitalize="sentences"
            autoCorrect="on"
            value={title || ""}
            onChange={(e) => onTitleChange(e.target.value)}
            onClick={updateTitleSelection}
            onKeyUp={updateTitleSelection}
            onSelect={updateTitleSelection}
            placeholder="Enter title..."
            className="w-full bg-transparent font-bold text-lg sm:text-2xl md:text-3xl outline-none placeholder:opacity-20 py-1 sm:py-2"
            style={{ color: TEXT_COLOR }}
            aria-label="Content title"
          />
          {showEmojiPicker && emojiTarget === "title" && (
            <div className="mt-2">
              <EmojiPicker
                onSelect={insertEmojiToTitle}
                onClose={() => setShowEmojiPicker(false)}
              />
            </div>
          )}
        </header>

        {/* Content Label */}
        <div className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 bg-white/2">
          <div className="text-[10px] sm:text-xs text-white/40 font-semibold">
            CONTENT
          </div>
        </div>

        {/* Formatting Toolbar */}
        {showToolbar && (
          <div
            ref={toolbarRef}
            className="p-2 sm:p-3 border-b bg-white/5 overflow-x-auto scrollbar-thin"
            style={{ borderColor: themeColorMix(), touchAction: "pan-x" }}
          >
            <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-wrap">
              {/* Undo/Redo */}
              <ToolbarButton onClick={() => execCommand("undo")} title="Undo">
                <Undo size={16} />
              </ToolbarButton>
              <ToolbarButton onClick={() => execCommand("redo")} title="Redo">
                <Redo size={16} />
              </ToolbarButton>

              <Divider />

              {/* Text Formatting */}
              <ToolbarButton
                onClick={() => execCommand("bold")}
                title="Bold (Ctrl+B)"
              >
                <Bold size={16} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => execCommand("italic")}
                title="Italic (Ctrl+I)"
              >
                <Italic size={16} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => execCommand("underline")}
                title="Underline (Ctrl+U)"
              >
                <Underline size={16} />
              </ToolbarButton>

              <Divider />

              {/* Lists */}
              <ToolbarButton
                onClick={() => execCommand("insertUnorderedList")}
                title="Bulleted List"
              >
                <List size={16} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => execCommand("insertOrderedList")}
                title="Numbered List"
              >
                <ListOrdered size={16} />
              </ToolbarButton>

              <Divider />

              {/* Link & Emoji */}
              <ToolbarButton
                onMouseDown={saveSelection}
                onClick={handleInsertLink}
                title="Insert Link"
              >
                <LinkIcon size={16} />
              </ToolbarButton>
              <div className="relative">
                <ToolbarButton
                  onMouseDown={saveSelection}
                  onClick={() => {
                    setEmojiTarget("content");
                    setShowEmojiPicker((p) => !p);
                  }}
                  title="Insert Emoji"
                >
                  <Smile size={16} />
                </ToolbarButton>
                {showEmojiPicker && emojiTarget === "content" && (
                  <div className="absolute top-full left-0 mt-1 z-50">
                    <EmojiPicker
                      onSelect={(emoji) => {
                        execCommand("insertHTML", emoji);
                        setShowEmojiPicker(false);
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  </div>
                )}
              </div>

              {/* Image Upload */}
              <label
                className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                style={{ color: THEME_COLOR }}
                title="Insert Image"
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  aria-label="Upload image"
                />
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </label>

              <Divider />

              {/* Heading Selector */}
              <select
                onMouseDown={saveSelection}
                onChange={handleHeading}
                className="text-xs px-2 py-1 rounded bg-white/5 border outline-none cursor-pointer"
                style={{ color: TEXT_COLOR, borderColor: themeColorMix() }}
                title="Paragraph style"
              >
                <option value="">Paragraph</option>
                <option value="<h1>">Heading 1</option>
                <option value="<h2>">Heading 2</option>
                <option value="<h3>">Heading 3</option>
              </select>

              {/* Font Family Selector */}
              <select
                onMouseDown={saveSelection}
                onChange={handleFontFamily}
                className="hidden sm:inline-block text-xs px-2 py-1 rounded bg-white/5 border outline-none cursor-pointer"
                style={{ color: TEXT_COLOR, borderColor: themeColorMix() }}
                title="Font family"
              >
                <option value="">Font</option>
                <option value="Inter">Inter</option>
                <option value="Georgia">Serif</option>
                <option value="Courier New">Monospace</option>
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
              </select>

              {/* Font Size Selector */}
              <select
                onMouseDown={saveSelection}
                onChange={handleFontSize}
                className="hidden sm:inline-block text-xs px-2 py-1 rounded bg-white/5 border outline-none cursor-pointer"
                style={{ color: TEXT_COLOR, borderColor: themeColorMix() }}
                title="Font size"
              >
                <option value="">Size</option>
                <option value="12">12px</option>
                <option value="14">14px</option>
                <option value="16">16px</option>
                <option value="18">18px</option>
                <option value="24">24px</option>
                <option value="32">32px</option>
                <option value="custom">Custom...</option>
              </select>

              {/* Text Color Picker */}
              <label
                className="flex items-center gap-1 p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Text color"
              >
                <Palette size={16} style={{ color: THEME_COLOR }} />
                <input
                  type="color"
                  onChange={handleTextColor}
                  onMouseDown={saveSelection}
                  className="w-6 h-6 rounded cursor-pointer border-0"
                  style={{ opacity: 0.7 }}
                  title="Pick text color"
                  aria-label="Text color picker"
                />
              </label>
            </div>
          </div>
        )}

        {/* Content Editor */}
        <div
          ref={editorRef as any}
          contentEditable
          onInput={(e) =>
            onContentChange((e.currentTarget as HTMLDivElement).innerHTML)
          }
          className={
            contentClassName ||
            "w-full flex-1 min-h-0 bg-gradient-to-br from-gray-900/40 to-black/40 border-t border-white/5 p-2 sm:p-3 md:p-4 lg:p-6 overflow-y-auto prose prose-invert max-w-none scrollbar-thin scrollbar-thumb-white/10"
          }
          style={{
            color: TEXT_COLOR,
            WebkitOverflowScrolling: "touch",
            ...(contentStyle || {}),
          }}
          role="textbox"
          aria-multiline="true"
        />
      </section>
    </div>
  );
};

const ToolbarButton: FC<any> = ({ onClick, onMouseDown, title, children }) => (
  <button
    onMouseDown={(e) => {
      if (onMouseDown) onMouseDown(e);
      e.preventDefault();
    }}
    onClick={onClick}
    title={title}
    className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0"
    style={{ color: THEME_COLOR }}
  >
    {children}
  </button>
);

const Divider: FC = () => (
  <div
    className="w-px h-6 mx-1 shrink-0"
    style={{ backgroundColor: themeColorMix(80) }}
  />
);

export default MainEditor;
