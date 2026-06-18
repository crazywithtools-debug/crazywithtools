"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
  type ChangeEvent,
  type FC,
} from "react";
// Avoid motion/react dependency — use CSS transitions instead
import {
  X,
  Bold,
  Underline,
  Image as ImageIcon,
  Palette,
  GripHorizontal,
} from "lucide-react";

export interface Note {
  id: string | number;
  x: number;
  y: number;
  zIndex?: number;
  color?: string;
  title?: string;
  content?: string;
}

interface StickyNoteProps {
  note: Note;
  onUpdate: (id: string | number, patch: Partial<Note>) => void;
  onClose: (id: string | number) => void;
  onBringToFront: (id: string | number) => void;
}

const StickyNote: FC<StickyNoteProps> = ({
  note,
  onUpdate,
  onClose,
  onBringToFront,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const noteRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const insertHtmlAtCursor = (html: string) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const fragment = range.createContextualFragment(html);
    range.insertNode(fragment);
    range.collapse(false);
  };

  const applyInlineTag = (tagName: string) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;
    const wrapper = document.createElement(tagName);
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    selection.addRange(newRange);
  };

  const handleMouseDown = (e: MouseEvent | TouchEvent) => {
    // ignore clicks on controls
    const target = (e as any).target as HTMLElement | null;
    if (
      target &&
      target.closest &&
      target.closest("button, label, input, [contenteditable]")
    )
      return;

    const clientX =
      (e as React.TouchEvent).type === "touchstart"
        ? (e as React.TouchEvent).touches[0].clientX
        : (e as React.MouseEvent).clientX;
    const clientY =
      (e as React.TouchEvent).type === "touchstart"
        ? (e as React.TouchEvent).touches[0].clientY
        : (e as React.MouseEvent).clientY;

    setIsDragging(true);
    onBringToFront(note.id);
    setOffset({ x: clientX - note.x, y: clientY - note.y });
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX =
        (e as TouchEvent).type === "touchmove"
          ? (e as TouchEvent).touches[0].clientX
          : (e as MouseEvent).clientX;
      const clientY =
        (e as TouchEvent).type === "touchmove"
          ? (e as TouchEvent).touches[0].clientY
          : (e as MouseEvent).clientY;
      onUpdate(note.id, { x: clientX - offset.x, y: clientY - offset.y });
    };

    const handleEnd = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", handleMove as any);
      document.addEventListener("mouseup", handleEnd);
      document.addEventListener("touchmove", handleMove as any, {
        passive: false,
      });
      document.addEventListener("touchend", handleEnd as any);
    }

    return () => {
      document.removeEventListener("mousemove", handleMove as any);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove as any);
      document.removeEventListener("touchend", handleEnd as any);
    };
  }, [isDragging, offset, note.id, onUpdate]);

  useEffect(() => {
    if (!contentRef.current) return;
    const currentHtml = contentRef.current.innerHTML;
    const desiredHtml = note.content || "";
    if (currentHtml !== desiredHtml) contentRef.current.innerHTML = desiredHtml;
  }, [note.content]);

  const handleContentInput = () => {
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      onUpdate(note.id, { content: html });
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const imgHtml = `<img src="${event.target?.result}" style="max-width: 90%; display: block; margin: 10px auto; border-radius: 8px;" />`;
      insertHtmlAtCursor(imgHtml);
      handleContentInput();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      ref={noteRef}
      className="absolute w-[300px] max-w-[calc(100vw-32px)] min-h-[250px] shadow-2xl rounded-xl overflow-hidden flex flex-col pointer-events-auto border border-black/10 transition-transform duration-150"
      style={{
        left: note.x,
        top: note.y,
        zIndex: note.zIndex,
        backgroundColor: note.color || "#fff",
        transform: "translateZ(0)",
      }}
      onMouseDown={() => onBringToFront(note.id)}
    >
      <div
        className="h-12 flex items-center px-3 gap-1 cursor-move bg-black/10 backdrop-blur-sm border-b border-black/5"
        onMouseDown={handleMouseDown as any}
        onTouchStart={handleMouseDown as any}
      >
        <GripHorizontal size={16} className="text-black/30 mr-1" />
        <input
          type="text"
          value={note.title || ""}
          onChange={(e) => onUpdate(note.id, { title: e.target.value })}
          placeholder="Note Title"
          className="bg-transparent font-black uppercase tracking-widest text-[10px] outline-none placeholder:text-black/20 w-32"
          style={{ color: "rgba(0,0,0,0.6)" }}
        />

        <div className="flex items-center gap-0.5 ml-auto">
          <button
            onClick={() => {
              onBringToFront(note.id);
              applyInlineTag("strong");
            }}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors text-black/60"
            title="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            onClick={() => {
              onBringToFront(note.id);
              applyInlineTag("u");
            }}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors text-black/60"
            title="Underline"
          >
            <Underline size={14} />
          </button>

          <label
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors cursor-pointer text-black/60"
            title="Add Image"
          >
            <ImageIcon size={14} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>

          <label
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors cursor-pointer text-black/60"
            title="Change Color"
          >
            <Palette size={14} />
            <input
              type="color"
              value={note.color || "#ffffff"}
              className="hidden"
              onChange={(e) => onUpdate(note.id, { color: e.target.value })}
            />
          </label>

          <button
            onClick={() => onClose(note.id)}
            className="p-1.5 hover:bg-red-500/20 hover:text-red-700 rounded-lg transition-colors text-black/60"
            title="Close Note"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div
        ref={contentRef}
        className="flex-1 p-5 outline-none overflow-auto max-h-[400px] prose prose-sm prose-zinc"
        contentEditable
        suppressContentEditableWarning
        onInput={handleContentInput}
        onBlur={handleContentInput}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        style={{ color: "rgba(0,0,0,0.8)" }}
      />
    </div>
  );
};

export default StickyNote;
