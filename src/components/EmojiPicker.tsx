"use client";

import type { FC } from "react";

interface EmojiPickerProps {
  variant?: "title" | "content";
  onSelect: (emoji: string) => void;
  onClose?: () => void;
}

export const EmojiPicker: FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const emojis = ["😀", "🎉", "🔥", "✨", "👍", "🤖"];
  return (
    <div className="bg-white/5 p-2 rounded-xl shadow-lg">
      <div className="flex gap-2">
        {emojis.map((e) => (
          <button
            key={e}
            onClick={() => {
              onSelect(e);
              onClose && onClose();
            }}
            className="p-2 rounded hover:bg-white/10"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
