import { NextRequest, NextResponse } from 'next/server';
import { error as logError } from '@/lib/logger';
import { getDb } from '@/lib/mongodb';
import type { ProcessedItem } from '@/types';

interface HistoryDoc {
  sessionId: string;
  items: ProcessedItem[];
  customPrompt: string;
  updatedAt: Date;
}

const COLLECTION = 'pro_level_history';

// GET /api/history?sessionId=xxxx
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId query param is required.' }, { status: 400 });
  }

  // If DB is not configured, fail fast with useful guidance.
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: 'Database is not configured. Set MONGODB_URI in environment.' },
      { status: 503 }
    );
  }

  try {
    const db = await getDb();
    const doc = await db.collection<HistoryDoc>(COLLECTION).findOne({ sessionId });

    if (!doc) {
      return NextResponse.json({ items: [], customPrompt: null });
    }

    return NextResponse.json({ items: doc.items, customPrompt: doc.customPrompt });
  } catch (err) {
    logError('[history GET] error:', err);
    return NextResponse.json(
      { error: 'Failed to load history. Database may not be configured.' },
      { status: 500 }
    );
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

  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: 'Database is not configured. Set MONGODB_URI in environment.' },
      { status: 503 }
    );
  }

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
    logError('[history POST] error:', err);
    return NextResponse.json(
      { error: 'Failed to save history. Database may not be configured.' },
      { status: 500 }
    );
  }
}
