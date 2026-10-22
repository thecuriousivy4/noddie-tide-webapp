"use client";

// Small fetch helpers shared by the screens. Every call carries the access token, and a
// refused call keeps the server's own message — the UI never invents a reason.

import { useCallback, useEffect, useState } from "react";
import { useIdentity } from "./identity/client";

export interface ApiFailure {
  code: string;
  message: string;
  requiredRoles?: string[];
  heldRoles?: string[];
  requiredRole?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public failure: ApiFailure,
  ) {
    super(failure.message);
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  const body = (await res.json().catch(() => null)) as { error?: ApiFailure } | null;
  throw new ApiError(
    res.status,
    body?.error ?? { code: "UNKNOWN", message: `Request failed (${res.status}).` },
  );
}

/** GET a JSON endpoint, re-fetching when the token changes. */
export function useApi<T>(path: string | null): {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
} {
  const { authFetch, token, ready } = useIdentity();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // Nothing to fetch, or no verified token to fetch it with. Settle rather than leave
    // the screen on its loading state forever — a signed-out viewer is being redirected
    // by ServiceLayout, and a pathless call has nothing to wait for.
    if (!path || !ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    authFetch(path)
      .then((r) => unwrap<T>(r))
      .then((body) => {
        if (!live) return;
        setData(body);
        setError(null);
      })
      .catch((err) => {
        if (!live) return;
        setError(err instanceof ApiError ? err : new ApiError(0, { code: "NETWORK", message: String(err) }));
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [path, authFetch, token, ready, nonce]);

  return { data, error, loading, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

/** POST JSON and unwrap the result, throwing ApiError with the server's message. */
export function usePost() {
  const { authFetch } = useIdentity();
  return useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      const res = await authFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      return unwrap<T>(res);
    },
    [authFetch],
  );
}

/** Open an authenticated PDF in a new tab, via a blob so the bearer token can be sent. */
export function useOpenPdf() {
  const { authFetch } = useIdentity();
  return useCallback(
    async (path: string) => {
      const res = await authFetch(path);
      if (!res.ok) throw new ApiError(res.status, { code: "PDF", message: "Could not load document." });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    [authFetch],
  );
}
