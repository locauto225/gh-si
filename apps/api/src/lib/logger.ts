export const logger = {
  info: (...args: any[]) => console.log("[api]", ...args),
  warn: (...args: any[]) => console.warn("[api]", ...args),
  error: (...args: any[]) => console.error("[api]", ...args),
};