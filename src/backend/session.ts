// The cookie holds a random ID that tells visitors apart. It has no personal data.
const COOKIE_NAME = "ai_session";
// A valid ID looks like a UUID. Anything else is ignored.
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ONE_DAY_SECONDS = 60 * 60 * 24;

/** Reads the visitor's session ID from the cookie. Returns nothing if it is missing or invalid. */
export function readSessionId(request: Request): string | undefined {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [name, value] = part.trim().split("=");
    if (name === COOKIE_NAME && value && SESSION_ID_PATTERN.test(value)) return value;
  }
  return undefined;
}

/** Makes a new random session ID. */
export function createSessionId(): string {
  return crypto.randomUUID();
}

/** Builds the Set-Cookie value. HttpOnly means page scripts cannot read it. */
export function sessionCookie(sessionId: string): string {
  return `${COOKIE_NAME}=${sessionId}; Path=/; Max-Age=${ONE_DAY_SECONDS}; HttpOnly; SameSite=Lax`;
}
