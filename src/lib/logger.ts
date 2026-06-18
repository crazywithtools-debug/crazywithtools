const isDev = process.env.NODE_ENV !== "production";

export const error = (...args: unknown[]) => {
  // Always surface errors to host logs so production issues are visible
  console.error("[error]", ...(args as any));
};

export const warn = (...args: unknown[]) => {
  if (isDev) console.warn("[warn]", ...(args as any));
};

export const log = (...args: unknown[]) => {
  if (isDev) console.log("[log]", ...(args as any));
};
