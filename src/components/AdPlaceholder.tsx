"use client";

import type { FC } from 'react';

interface AdPlaceholderProps {
  compact?: boolean;
  variant?: 'compact' | 'banner' | 'wide';
}

const AdPlaceholder: FC<AdPlaceholderProps> = ({ compact = false, variant = 'compact' }) => {
  // Backwards-compatible: `compact` prop maps to 'compact' variant
  const v = compact ? 'compact' : variant;
  const heightClass = v === 'banner' ? 'h-24' : v === 'wide' ? 'h-32' : (compact ? 'h-16' : 'h-28');

  return (
    <div className={`p-3 bg-white/5 border border-white/5 rounded-2xl text-center py-4`}> 
      <div className="text-[10px] uppercase text-zinc-400 font-bold mb-2">Sponsored</div>
      <div className={`mx-auto ${heightClass} w-full bg-white/3 rounded flex items-center justify-center text-white/50`}>
        <span className="text-sm">Google Ads Placeholder</span>
      </div>
    </div>
  );
};

export default AdPlaceholder;
