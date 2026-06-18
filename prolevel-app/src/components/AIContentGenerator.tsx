"use client";

import { useState, type FC } from 'react';
import { Sparkles, Loader2, Send } from 'lucide-react';
import { themeColorMix, TEXT_COLOR, THEME_COLOR, ACTIVE_COLOR, BUTTON_BG_COLOR, BUTTON_TEXT_COLOR } from '@/lib/utils';
import { error as logError } from '@/lib/logger';
import type { GenerateResponseBody, GenerateErrorBody } from '@/types';

interface AIContentGeneratorProps {
  apiKey?: string;
  onGenerated: (title: string, content: string) => void;
  onClose: () => void;
}

const AIContentGenerator: FC<AIContentGeneratorProps> = ({ apiKey, onGenerated, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const LENGTH_INSTRUCTION = 'Generate content of any length according to the prompt requirements.';
  const CONTENT_STRUCTURE_INSTRUCTIONS = 'Return content as clean HTML using <p>, <ul>, <li>, <strong>, <h2>, <h3> tags. Structure with appropriate paragraphs, bullet lists if relevant, and a closing call-to-action. Return ONLY valid JSON with "title" and "content" keys.';

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);

    try {
      const controller = new AbortController();
      // Allow generous time for server-side generation (align with server timeout)
      const timeout = setTimeout(() => controller.abort(), 170_000);

      const fullPrompt = `${LENGTH_INSTRUCTION}\n${CONTENT_STRUCTURE_INSTRUCTIONS}\n\n${prompt}`;

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, apiKey }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as GenerateErrorBody | null;
        const errorMsg = errBody?.error || `Generation failed (HTTP ${res.status})`;
        setError(errorMsg);
        logError('AI Generation HTTP Error:', errorMsg);
        return;
      }

      const body = (await res.json().catch(() => null)) as GenerateResponseBody | null;
      
      if (!body || typeof body !== 'object') {
        setError('Invalid response format from AI');
        return;
      }

      if (!body.title || !body.content) {
        setError('AI returned incomplete response (missing title or content)');
        logError('Invalid AI response:', body);
        return;
      }

      onGenerated(body.title, body.content);
      setPrompt('');
      setError(null);
      } catch (err: unknown) {
      if ((err as any)?.name === 'AbortError') {
        setError('Generation timed out (>170s). Please try again.');
      } else {
        const message = err instanceof Error ? err.message : 'Unknown error occurred';
        logError('AI Generation Error:', err);
        setError(`Failed to generate content: ${message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col bg-white/5 overflow-hidden transition-all duration-200" style={{ color: THEME_COLOR }}>
      <div className="p-2 max-w-4xl mx-auto w-full flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-0.5 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: ACTIVE_COLOR }} />
            <h3 className="text-sm font-bold uppercase tracking-widest">AI Content Generator</h3>
          </div>
        </div>

        <div className="flex gap-3 flex-1 overflow-hidden">
          <div className="relative flex-1 flex flex-col overflow-hidden">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the content you want to generate (aim 180-300 words; include tone and CTA)..."
              className="flex-1 w-full bg-white/5 border rounded-xl p-4 text-sm outline-none transition-all resize-none overflow-y-auto custom-scrollbar placeholder:opacity-20"
              style={{ color: TEXT_COLOR, borderColor: themeColorMix(90) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
            />
          </div>

            <div className="flex flex-col gap-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="p-3 rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all shadow-lg flex items-center justify-center"
                style={{ backgroundColor: BUTTON_BG_COLOR, color: BUTTON_TEXT_COLOR }}
              title="Generate Content"
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>

            <button
              onClick={onClose}
              className="p-3 bg-white/5 border rounded-xl transition-all flex items-center justify-center opacity-60 hover:opacity-100"
              style={{ color: THEME_COLOR, borderColor: themeColorMix(90) }}
              title="Close AI Tools"
            >
              <span className="text-[10px] font-bold">X</span>
            </button>
          </div>
        </div>

        <div className="shrink-0 mt-2">
          {error && (
            <p className="text-xs text-red-500 font-medium transition-opacity duration-200">✗ {error}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIContentGenerator;
