"use client";

import { ADS } from "./AdConfig";

type AdType = "banner" | "native" | "sticky" | "popunder" | "social";

type Slot = {
  id: string;
  type: AdType;
  callback: () => void;
};

const slots = new Map<string, Slot>();
const slotsByType = new Map<AdType, Set<string>>();
const timers = new Map<AdType, number>();

const INTERVALS: Record<AdType, number> = {
  banner: 60_000,
  native: 120_000,
  sticky: 90_000,
  popunder: 0,
  social: 120_000,
};

function trackEvent(event: "loaded" | "failed" | "clicked" | "blocked", data: any) {
  try {
    if (typeof window === "undefined") return;

    // 1) Custom hook (highest priority)
    try {
      if ((window as any).__trackAdEvent && typeof (window as any).__trackAdEvent === 'function') {
        (window as any).__trackAdEvent(event, data);
      }
    } catch (e) {
      // ignore
    }

    // 2) gtag (Google Analytics / GA4)
    try {
      if ((window as any).gtag && typeof (window as any).gtag === 'function') {
        (window as any).gtag('event', event, data || {});
      }
    } catch (e) {
      // ignore
    }

    // 3) dataLayer (Tag Manager)
    try {
      if ((window as any).dataLayer && Array.isArray((window as any).dataLayer)) {
        (window as any).dataLayer.push({ event: 'ad_event', ad_event: event, ...data });
      }
    } catch (e) {
      // ignore
    }

    // 4) Server-side tracking endpoint (optional)
    try {
      // NEXT_PUBLIC_AD_TRACK_URL can be set at build-time
      // eslint-disable-next-line no-undef
      const trackUrl = process.env.NEXT_PUBLIC_AD_TRACK_URL as string | undefined;
      if (trackUrl) {
        const payload = { event, data, ts: Date.now(), path: typeof window !== 'undefined' ? window.location?.pathname : undefined };
        if (navigator && (navigator as any).sendBeacon) {
          try {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            (navigator as any).sendBeacon(trackUrl, blob);
          } catch (e) {
            // ignore
          }
        } else {
          // best-effort non-blocking POST
          fetch(trackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
        }
      } else {
        // fallback: only log during development to avoid noisy production console output
        // eslint-disable-next-line no-console
        if (process.env.NODE_ENV !== 'production') console.log('Ad event:', event, data);
      }
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // ignore any unexpected errors
  }
}

function ensureTimerForType(type: AdType) {
  if (timers.has(type)) return;
  const interval = INTERVALS[type];
  if (!interval || interval <= 0) return;
  const id = window.setInterval(() => {
    const set = slotsByType.get(type);
    if (!set) return;
    set.forEach((slotId) => {
      const slot = slots.get(slotId);
      try {
        slot?.callback();
      } catch (e) {
        // ignore
      }
    });
  }, interval);
  timers.set(type, id);
}

export function registerSlot(id: string, type: AdType, callback: () => void) {
  if (!id) return () => {};
  slots.set(id, { id, type, callback });
  if (!slotsByType.has(type)) slotsByType.set(type, new Set());
  slotsByType.get(type)!.add(id);
  ensureTimerForType(type);

  return () => {
    slots.delete(id);
    const set = slotsByType.get(type);
    set?.delete(id);
    if (set && set.size === 0) {
      const t = timers.get(type);
      if (t) {
        clearInterval(t);
        timers.delete(type);
      }
    }
  };
}

export function refreshSlot(id: string) {
  const slot = slots.get(id);
  try {
    slot?.callback();
  } catch {}
}

export const AdManager = {
  registerSlot,
  refreshSlot,
  trackEvent,
  triggerPopunder: () => {
    try {
      if (typeof window === 'undefined') return;
      const key = 'ad_popunder_last_ts_v1';
      const last = parseInt(sessionStorage.getItem(key) || '0', 10) || 0;
      const now = Date.now();
      const MIN_INTERVAL = 10 * 60 * 1000; // 10 minutes
      if (now - last < MIN_INTERVAL) return;
      // try primary popunder script
      const script = (ADS as any).popunder?.script;
      if (script) {
        try {
          const s = document.createElement('script');
          s.async = true;
          s.src = script;
          document.body.appendChild(s);
          sessionStorage.setItem(key, String(Date.now()));
          trackEvent('loaded', { type: 'popunder', provider: 'primary' });
          return;
        } catch (e) {
          // fall through to backup
        }
      }
      // fallback: try backup provider script or open smartlink
      const backupScript = (ADS as any).backup?.popunder?.script;
      if (backupScript) {
        try {
          const s2 = document.createElement('script');
          s2.async = true;
          s2.src = backupScript;
          document.body.appendChild(s2);
          sessionStorage.setItem(key, String(Date.now()));
          trackEvent('loaded', { type: 'popunder', provider: 'backup' });
          return;
        } catch (e) {
          // fall through
        }
      }
      // last resort: open smartlink in new tab
      const backupSmart = (ADS as any).backup?.smartlink?.url || (ADS as any).smartlink?.url;
      if (backupSmart) {
        try {
          window.open(backupSmart, '_blank');
            sessionStorage.setItem(key, String(Date.now()));
          trackEvent('loaded', { type: 'popunder', provider: 'smartlink-fallback' });
          return;
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      trackEvent('failed', { type: 'popunder' });
    }
  },
  openSmartlink: (opts?: { openInNewTab?: boolean }) => {
    try {
      if (typeof window === 'undefined') return;
      const url = (ADS as any).smartlink?.url;
      const backupUrl = (ADS as any).backup?.smartlink?.url;
      const target = url || backupUrl;
      if (!target) return;
      // enforce client-side cooldown to prevent rapid repeated opens
      try {
        const key = 'ad_smartlink_last_ts_v1';
        const last = parseInt(sessionStorage.getItem(key) || '0', 10) || 0;
        const now = Date.now();
        const cooldown = (ADS as any).smartlink?.cooldownMs || 10 * 60 * 1000; // default 10 minutes
        if (now - last < cooldown) {
          trackEvent('blocked', { type: 'smartlink', reason: 'cooldown', since: now - last });
          return;
        }

        // Best-effort server-side track (non-blocking)
        try {
          const body = { event: 'smartlink_click', ts: now, path: typeof window !== 'undefined' ? window.location?.pathname : undefined, url: target };
          if (navigator && (navigator as any).sendBeacon) {
            try {
              const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
              (navigator as any).sendBeacon('/api/ads/track', blob);
            } catch (e) {}
          } else {
            fetch('/api/ads/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
          }
        } catch (e) {}

        // record timestamp and open
        sessionStorage.setItem(key, String(now));
        if (opts?.openInNewTab) {
          window.open(target, '_blank');
        } else {
          window.location.href = target;
        }
        trackEvent('clicked', { type: 'smartlink', usedBackup: !url && !!backupUrl });
      } catch (e) {
        // fallback: still attempt open
        if (opts?.openInNewTab) {
          window.open(target, '_blank');
        } else {
          window.location.href = target;
        }
        trackEvent('clicked', { type: 'smartlink', usedBackup: !url && !!backupUrl });
      }
    } catch (e) {
      trackEvent('failed', { type: 'smartlink' });
    }
  },
};
