// Session cookie: remembers which actor is signed in so the server can mint a fresh,
// network-signed token on demand (login and "Refresh my token"). The cookie holds only
// the user id; all authority still travels in the signed token.

import "server-only";
import { cookies } from "next/headers";

const COOKIE = "noddie_session";

export async function setSession(sub: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, sub, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function getSessionSub(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
