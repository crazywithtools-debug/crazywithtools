import type { AddSettings, ReplaceSettings } from '@/types';
import createDOMPurify from 'dompurify';

/**
 * Inserts configured snippets into HTML content at word-count intervals.
 * Must run in a browser environment (uses DOM APIs).
 */
export function applyAddOperation(initialHtml: string, settings: AddSettings): string {
  if (typeof document === 'undefined') return initialHtml;

  const { contents, baseValues, mode, excludeHeadingTags } = settings;
  if (!contents.length || !baseValues.length) return initialHtml;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = initialHtml;

  const processWithWalker = (root: HTMLElement, currentBaseValue: number, currentNewContents: string[]) => {
    if (currentBaseValue <= 0) return;
    const SHOW_TEXT = typeof (globalThis as any).NodeFilter !== 'undefined' ? (globalThis as any).NodeFilter.SHOW_TEXT : 4;
    const walker = document.createTreeWalker(root, SHOW_TEXT, null);
    let node: Node | null = walker.nextNode();
    let wordCounter = 0;
    let contentIndex = 0;

    while (node) {
      const textNode = node as Text;
      // Skip text nodes that are inside excluded heading tags
      try {
        if (Array.isArray(excludeHeadingTags) && excludeHeadingTags.length > 0) {
          const parentEl = (textNode as any).parentElement as HTMLElement | null;
          if (parentEl) {
            let skipThisNode = false;
            for (const tag of excludeHeadingTags) {
              if (!tag) continue;
              try {
                if ((parentEl as HTMLElement).closest && (parentEl as HTMLElement).closest(tag)) {
                  skipThisNode = true;
                  break;
                }
              } catch (e) {
                // ignore invalid selector and continue
              }
            }
            if (skipThisNode) {
              node = walker.nextNode();
              continue;
            }
          }
        }
      } catch (e) {
        // ignore and continue processing
      }

      const text = textNode.nodeValue || '';
      const parts = text.split(/(\s+)/);
      let newTextValue = '';

      for (const part of parts) {
        if (part.trim().length > 0) {
          wordCounter++;
          newTextValue += part;
          if (wordCounter % currentBaseValue === 0) {
            const contentToInsert =
              mode === 'alternative'
                ? currentNewContents[contentIndex++ % currentNewContents.length]
                : currentNewContents[0];
            newTextValue += ` ${contentToInsert} `;
          }
        } else {
          newTextValue += part;
        }
      }

      textNode.nodeValue = newTextValue;
      node = walker.nextNode();
    }
  };

  if (mode === 'alternative') {
    processWithWalker(tempDiv, baseValues[0] || 1, contents);
    return tempDiv.innerHTML;
  } else {
    let intermediateHtml = initialHtml;
    for (let i = 0; i < contents.length; i++) {
      const tempInnerDiv = document.createElement('div');
      tempInnerDiv.innerHTML = intermediateHtml;
      processWithWalker(tempInnerDiv, baseValues[i] || 1, [contents[i]]);
      intermediateHtml = tempInnerDiv.innerHTML;
    }
    return intermediateHtml;
  }
}

/**
 * Performs find-and-replace operations on HTML content.
 * Supports plain text matches and /regex/ syntax (always global).
 */
export function applyReplaceOperation(originalHtml: string, settings: ReplaceSettings): string {
  const { finds, replaces } = settings;
  let newHtml = originalHtml;

  for (let i = 0; i < finds.length; i++) {
    const find = (finds[i] || '').trim();
    if (!find) continue;

    const replaceWith = replaces[i] !== undefined ? replaces[i] : replaces[0] || '';

    try {
      let regex: RegExp;
      if (find.startsWith('/') && find.endsWith('/') && find.length > 1) {
        regex = new RegExp(find.slice(1, -1), 'g');
      } else {
        regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      }
      newHtml = newHtml.replace(regex, replaceWith);
      } catch (e) {
        // logging only in dev (use dynamic import without await inside sync function)
        import('./logger').then(({ error: logError }) => logError(`Invalid regex: ${find}`, e)).catch(() => {});
      }
  }

  return newHtml;
}

/**
 * Removes <strong>/<b> tags from inside <h2> headings (cleanup pass).
 */
export function cleanOutputHtml(html: string): string {
  try {
    if (typeof window !== 'undefined') {
      const DOMPurify = createDOMPurify(window as any);
      // Keep basic formatting but remove dangerous tags/attributes
      return DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
      });
    }
  } catch (e) {
    // fall through to fallback
  }

  // Fallback (minimal) cleanup when DOMPurify isn't available (server-side)
  return html.replace(/(<h2[^>]*>)(.*?)(<\/h2>)/gi, (_match, openTag, content, closeTag) => {
    const cleanedContent = content.replace(/<\/?(strong|b)\b[^>]*>/gi, '');
    return openTag + cleanedContent + closeTag;
  });
}
