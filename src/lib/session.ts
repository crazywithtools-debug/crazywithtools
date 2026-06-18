const SESSION_KEY = "prolevel_session_id";

/**
 * Returns a persistent anonymous session ID stored in localStorage.
 * Generates one on first use. Used to scope in-memory history and
 * identify sessions without requiring any login/signup flow.
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
