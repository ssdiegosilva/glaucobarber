/**
 * Triggers the global AI limit modal (dispatches a window event).
 * The modal is mounted in the dashboard layout and listens for this event.
 */
export function triggerAiLimitModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ai-limit-reached"));
  }
}

/**
 * Returns true if the response indicates the AI usage limit was reached.
 * Usage:
 *   const data = await res.json();
 *   if (isAiLimitError(res.status, data)) { triggerAiLimitModal(); return; }
 */
export function isAiLimitError(status: number, data?: any): boolean {
  return status === 402 || data?.error === "ai_limit_reached";
}
