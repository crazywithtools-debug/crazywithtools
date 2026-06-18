import { error as logError } from "./logger";

export const DEFAULT_API_TIMEOUT = 30000;

export function sanitizeUserContent(input: string): string {
  try {
    if (!input || typeof input !== "string") return "";
    let s = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    // remove control characters except tab/newline
    s = s.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, "");
    // Collapse many blank lines
    s = s.replace(/\n{3,}/g, "\n\n");
    s = s.trim();
    // Normalize spaces around punctuation
    s = s.replace(/[ \t]*([,.!?;:])[ \t]*/g, "$1 ");
    // Split into paragraphs and ensure each ends with punctuation when not HTML
    const paragraphs = s.split(/\n{1,2}/).map((line) => {
      let t = line.trim();
      if (!t) return "";
      // If contains HTML tags, return as-is
      if (/<\/?[a-z][\s\S]*>/i.test(t)) return t;
      // Ensure sentence ends with punctuation
      if (!/[.!?;:]$/.test(t)) t = t + ".";
      // Capitalize first letter
      t = t.charAt(0).toUpperCase() + t.slice(1);
      return t;
    });
    return paragraphs.filter(Boolean).join("\n\n");
  } catch (e) {
    logError("sanitizeUserContent failed", e);
    return input;
  }
}

async function parseResponseBody(res: Response): Promise<any> {
  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    return text;
  }
}

export async function fetchJsonWithTimeout(
  url: string,
  init?: RequestInit,
  timeout = DEFAULT_API_TIMEOUT,
): Promise<any> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(id);
    const body = await parseResponseBody(res);
    if (!res.ok) {
      const msg =
        body && (body.error || body.message)
          ? body.error || body.message
          : typeof body === "string" && body.length > 0
          ? body
          : `HTTP ${res.status}`;
      const err: any = new Error(msg);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  } catch (e: any) {
    clearTimeout(id);
    if (e && e.name === "AbortError") throw new Error("Request timed out");
    throw e;
  }
}

export async function generateContent(
  payload: { prompt: string; apiKey?: string },
  timeout = DEFAULT_API_TIMEOUT,
) {
  try {
    const body = await fetchJsonWithTimeout(
      "/api/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      timeout,
    );
    return { ok: true, data: body };
  } catch (e: any) {
    const msg = e?.message ?? "Unknown error";
    const status = e?.status || 0;
    // classify common error cases
    let code = "unknown";
    const body = e?.body;
    // detect structured API errors from Google / Gemini
    const bodyMessage =
      body && typeof body === "object"
        ? (body.error && body.error.message) || body.message || JSON.stringify(body)
        : String(body || "");

    if (
      status === 401 ||
      /no ai api key configured/i.test(msg) ||
      /no api key/i.test(msg) ||
      /api key.*not.*configured/i.test(msg)
    )
      code = "no_api_key";
    // Gemini / Google may return 400 with API_KEY_INVALID reason or message
    else if (
      /api[_\s-]*key not valid|api key not valid|api_key_invalid/i.test(msg) ||
      /API_KEY_INVALID/i.test(bodyMessage) ||
      /api key not valid/i.test(bodyMessage)
    )
      code = "invalid_api_key";
    else if (status === 429 || /limit|quota|exceed|rate limit|quota exceeded/i.test(msg))
      code = "rate_limited";
    else if (/timeout/i.test(msg) || (e && e.name === "AbortError")) code = "timeout";
    else if (status >= 500) code = "server_error";
    else code = "client_error";

    let friendly = "Sorry — unable to generate content.";
    if (code === "no_api_key") {
      friendly = "Sorry — I cannot generate content (reason: no API key found or API key quota exceeded).";
    } else if (code === "invalid_api_key") {
      friendly =
        "Sorry — I cannot generate content (reason: invalid API key). Please check your API key configuration.";
    } else if (code === "rate_limited") {
      friendly = "Sorry — I cannot generate content (reason: API key quota exceeded). Try again later or use a different API key.";
    } else if (code === "timeout") {
      friendly = "Sorry — the request timed out while generating content. Please try again.";
    } else if (code === "server_error") {
      friendly = "Sorry — the server failed to generate content. Try again later.";
    } else if (msg) {
      friendly = `Sorry — unable to generate content (${msg}).`;
    }

    return { ok: false, error: msg, status, body: e?.body, code, friendly };
  }
}

export async function postHistory(payload: any, timeout = 5000) {
  try {
    await fetchJsonWithTimeout(
      "/api/history",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      timeout,
    );
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "History post failed" };
  }
}
