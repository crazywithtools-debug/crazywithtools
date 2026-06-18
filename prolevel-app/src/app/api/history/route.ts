import { NextRequest, NextResponse } from 'next/server';
import { error as logError, warn as logWarn } from '@/lib/logger';
import { getDb } from '@/lib/mongodb';
import type { ProcessedItem } from '@/types';

interface HistoryDoc {
  sessionId: string;
  items: ProcessedItem[];
  customPrompt: string;
  updatedAt: Date;
}

const COLLECTION = 'pro_level_history';

// In-memory fallback storage when the database is not available.
const inMemoryHistory = new Map<string, { items: ProcessedItem[]; customPrompt: string; updatedAt: string }>();

// GET /api/history?sessionId=xxxx
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId query param is required.' }, { status: 400 });
  }

  // Try DB first when configured; otherwise fall back to in-memory store.
  try {
    if (process.env.MONGODB_URI) {
      try {
        const db = await getDb();
        const doc = await db.collection<HistoryDoc>(COLLECTION).findOne({ sessionId });

        if (doc) {
          return NextResponse.json({ items: doc.items, customPrompt: doc.customPrompt });
        }
        // no DB doc -> fall through to in-memory fallback
      } catch (err) {
        logError('[history GET] DB error, falling back to in-memory store:', err instanceof Error ? err.message : err);
      }
    } else {
      logWarn('MONGODB_URI not set; using in-memory history fallback.');
    }

    const doc = inMemoryHistory.get(sessionId!);
    if (!doc) {
      return NextResponse.json({ items: [], customPrompt: null });
    }

    return NextResponse.json({ items: doc.items, customPrompt: doc.customPrompt });
  } catch (err) {
    logError('[history GET] unexpected error:', err);
    return NextResponse.json({ error: 'Failed to load history.' }, { status: 500 });
  }
}

// POST /api/history  { sessionId, items, customPrompt }
export async function POST(req: NextRequest) {
  let body: { sessionId?: string; items?: ProcessedItem[]; customPrompt?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { sessionId, items, customPrompt } = body;

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 });
  }

  // Try to persist to DB when available; otherwise store in-memory as a graceful fallback.
  try {
    if (process.env.MONGODB_URI) {
      try {
        const db = await getDb();
        await db.collection<HistoryDoc>(COLLECTION).updateOne(
          { sessionId },
          {
            $set: {
              sessionId,
              items: items || [],
              customPrompt: customPrompt || '',
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );

        return NextResponse.json({ ok: true });
      } catch (err) {
        logError('[history POST] DB error, falling back to in-memory store:', err instanceof Error ? err.message : err);
      }
    } else {
      logWarn('MONGODB_URI not set; saving history to in-memory fallback.');
    }

    // In-memory fallback
    inMemoryHistory.set(sessionId, {
      items: items || [],
      customPrompt: customPrompt || '',
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, fallback: true });
  } catch (err) {
    logError('[history POST] unexpected error:', err);
    return NextResponse.json({ error: 'Failed to save history.' }, { status: 500 });
  }
}
