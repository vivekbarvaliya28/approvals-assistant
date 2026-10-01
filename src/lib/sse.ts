import { StreamEventSchema, type StreamEvent } from "@/lib/schemas";

/** Turns an event into one SSE message ("data: ...") to send to the browser. */
export function encodeSseEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(StreamEventSchema.parse(event))}\n\n`;
}

/** Reads one SSE message from the server. Returns null if it is empty or invalid. */
export function decodeSseFrame(frame: string): StreamEvent | null {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");
  if (!data) return null;

  try {
    const parsed = StreamEventSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
