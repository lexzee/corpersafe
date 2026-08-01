// Minimal localStorage buffer for GPS points recorded while offline.
//
// The PCM tracking view enqueues position updates that can't reach
// Supabase (dead zones / dropped data), then drains them when connectivity
// returns — so highway blackspots don't create gaps in trip history or
// false "signal lost" alarms.

export type QueuedPoint = {
  lat: number;
  lng: number;
  speed: number;
  ts: string;
};

const keyFor = (tripId: string) => `corpersafe_offline_queue_${tripId}`;
const MAX_QUEUE = 500; // ~8 hours at one point/minute

export function enqueuePoint(tripId: string, point: QueuedPoint) {
  try {
    const existing = readQueue(tripId);
    existing.push(point);
    // Drop the oldest points first if the cap is exceeded
    while (existing.length > MAX_QUEUE) existing.shift();
    localStorage.setItem(keyFor(tripId), JSON.stringify(existing));
  } catch {
    // Storage unavailable (private mode etc.) — queueing is best-effort
  }
}

export function readQueue(tripId: string): QueuedPoint[] {
  try {
    return JSON.parse(localStorage.getItem(keyFor(tripId)) || "[]");
  } catch {
    return [];
  }
}

export function clearQueue(tripId: string) {
  try {
    localStorage.removeItem(keyFor(tripId));
  } catch {
    // ignore
  }
}

export function queueLength(tripId: string) {
  return readQueue(tripId).length;
}
