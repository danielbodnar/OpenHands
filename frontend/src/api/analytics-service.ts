import { openHands } from "./open-hands-axios";

interface TrackEventParams {
  event: string;
  properties?: Record<string, unknown>;
}

/**
 * Track a client-side event via the server-side analytics API.
 * Fire-and-forget: errors are silently caught to avoid breaking UI.
 */
export async function trackEvent({
  event,
  properties = {},
}: TrackEventParams): Promise<void> {
  try {
    await openHands.post("/api/v1/analytics/track", {
      event,
      properties,
    });
  } catch {
    // Fire-and-forget: don't break UI if tracking fails
  }
}
