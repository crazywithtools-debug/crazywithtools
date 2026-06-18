import { NextRequest, NextResponse } from "next/server";
import { error as logError } from "@/lib/logger";
import type { ProcessedItem } from "@/types";

// Lightweight in-memory history store. This keeps the API working even when
// no external database is configured and avoids introducing an unused
// external DB dependency.
const inMemoryHistory = new Map<
  string,
  { items: ProcessedItem[]; customPrompt: string; updatedAt: string }
>();

// GET /api/history?sessionId=xxxx
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId query param is required." },
      { status: 400 },
    );
  }

  try {
    const doc = inMemoryHistory.get(sessionId);
    if (!doc) {
      return NextResponse.json({ items: [], customPrompt: null });
    }

    return NextResponse.json({
      items: doc.items,
      customPrompt: doc.customPrompt,
    });
  } catch (err) {
    logError("[history GET] unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to load history." },
      { status: 500 },
    );
  }
}

// POST /api/history  { sessionId, items, customPrompt }
export async function POST(req: NextRequest) {
  let body: {
    sessionId?: string;
    items?: ProcessedItem[];
    customPrompt?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { sessionId, items, customPrompt } = body;

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required." },
      { status: 400 },
    );
  }

  try {
    inMemoryHistory.set(sessionId, {
      items: items || [],
      customPrompt: customPrompt || "",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, fallback: true });
  } catch (err) {
    logError("[history POST] unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to save history." },
      { status: 500 },
    );
  }
}
