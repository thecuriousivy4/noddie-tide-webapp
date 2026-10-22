"use client";

// One identity interface for the whole UI, over two backends.
//
//   mode "mock"       a simulated provider with the same shape as @tidecloak/react:
//                     signIn/logout/token/hasRole/authFetch/seal/open. Username + password
//                     against a local scrypt hash, RS256 token from a local keypair,
//                     verified server-side against a JWKS on every protected route.
//
//   mode "tidecloak"  the live realm: `TideCloakProvider` + `useTideCloak()`, tokens signed
//                     by the Tide network, policy-enabled doEncrypt/doDecrypt where the ORK
//                     nodes decide who may decrypt.
//
// Components only ever call useIdentity(). This file is the single seam, so swapping the
// simulation for the realm touches nothing else in the app.
//
// TIDECLOAK: the three bridge functions below (seal, open, refresh) and the login path are
// the only places the two differ. Each is marked inline.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TideCloakProvider, useTideCloak } from "@tidecloak/nextjs";
import type { PolicyLabel } from "@/lib/policyRegistry";
import {
  decryptUnderPolicy,
  encryptUnderPolicy,
  PolicyRefusedError,
} from "@/lib/crypto-browser";

export interface IdentityUser {
  sub: string;
  username: string;
  name: string;
  roles: string[];
}

export interface Identity {
  mode: "tidecloak" | "mock" | "unknown";
  /** True while the simulation is in use, so the UI can say so unmissably. */
  simulated: boolean;
  /** Finished initialising — either signed in or definitely not. */
  ready: boolean;
  authenticated: boolean;
  user: IdentityUser | null;
  token: string | null;
  /**
   * Begin sign-in. Mock mode: resolves false, and the caller sends the person to /signin.
   * TideCloak mode: redirects to the realm and resolves true.
   */
  login: () => Promise<boolean>;
  /** Mock mode only: the credential post behind the /signin form. */
  signIn?: (username: string, password: string) => Promise<IdentityUser>;
  logout: () => Promise<void>;
  /** Fetch a fresh token. A quorum-granted role only exists for the holder after this. */
  refresh: () => Promise<void>;
  hasRole: (role: string) => boolean;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** Seal a value under a policy, in this browser. */
  seal: (policy: PolicyLabel, value: unknown) => Promise<string>;
  /** Open a sealed value. The policy comes from the column it was read from. */
  open: <T>(sealed: string, policy: PolicyLabel) => Promise<T>;
}

const Ctx = createContext<Identity | null>(null);

export function useIdentity(): Identity {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useIdentity must be used inside <IdentityProvider>.");
  return ctx;
}

export { PolicyRefusedError };

function decode(token: string | null): IdentityUser | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((part.length + 3) % 4));
    const p = JSON.parse(json) as {
      sub?: string;
      preferred_username?: string;
      name?: string;
      realm_access?: { roles?: string[] };
    };
    return {
      sub: p.sub ?? "",
      username: p.preferred_username ?? "",
      name: p.name ?? p.preferred_username ?? "",
      roles: p.realm_access?.roles ?? [],
    };
  } catch {
    return null;
  }
}

interface ModeResponse {
  mode: "tidecloak" | "mock";
  simulated: boolean;
  config: Record<string, unknown> | null;
  misconfigured: boolean;
}

/** Decides which backend to mount, then gets out of the way. */
export function IdentityProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ModeResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/identity")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((m: ModeResponse) => live && setMode(m))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) return <Ctx.Provider value={{ ...blank(), ready: true }}>{children}</Ctx.Provider>;
  if (!mode) return <Ctx.Provider value={blank()}>{children}</Ctx.Provider>;

  if (mode.mode === "tidecloak" && mode.config) {
    return (
      <TideCloakProvider config={mode.config}>
        <TideCloakBridge>{children}</TideCloakBridge>
      </TideCloakProvider>
    );
  }
  return <MockBridge>{children}</MockBridge>;
}

function blank(): Identity {
  return {
    mode: "unknown",
    simulated: false,
    ready: false,
    authenticated: false,
    user: null,
    token: null,
    login: async () => false,
    logout: async () => {},
    refresh: async () => {},
    hasRole: () => false,
    authFetch: (path, init) => fetch(path, init),
    seal: async () => {
      throw new Error("Identity is still initialising.");
    },
    open: async () => {
      throw new Error("Identity is still initialising.");
    },
  };
}

/* ------------------------------------------------------------ real TideCloak */

function TideCloakBridge({ children }: { children: ReactNode }) {
  const tc = useTideCloak();
  const [policyBytes, setPolicyBytes] = useState<Record<string, Uint8Array>>({});

  const user = useMemo(() => decode(tc.token), [tc.token]);

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await tc.getToken();
      const headers = new Headers(init.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(path, { ...init, headers });
    },
    [tc],
  );

  /** Signed Forseti policy bytes for a label, fetched once and cached. Not a key. */
  const bytesFor = useCallback(
    async (policy: PolicyLabel): Promise<Uint8Array> => {
      const cached = policyBytes[policy];
      if (cached) return cached;
      const res = await authFetch(`/api/policy?policy=${policy}`);
      if (res.status === 403) {
        const body = await res.json().catch(() => null);
        throw new PolicyRefusedError(body?.error?.requiredRole ?? policy, policy);
      }
      if (!res.ok) throw new Error(`Could not load policy bytes for ${policy} (${res.status}).`);
      const { bytesB64 } = (await res.json()) as { bytesB64: string };
      const raw = Uint8Array.from(atob(bytesB64), (c) => c.charCodeAt(0));
      setPolicyBytes((cur) => ({ ...cur, [policy]: raw }));
      return raw;
    },
    [authFetch, policyBytes],
  );

  const value = useMemo<Identity>(
    () => ({
      mode: "tidecloak",
      simulated: false,
      ready: !tc.isInitializing,
      authenticated: tc.authenticated,
      user,
      token: tc.token,
      login: async () => {
        await tc.login();
        return true;
      },
      logout: async () => {
        await tc.logout();
      },
      refresh: async () => {
        await tc.forceRefreshToken();
      },
      hasRole: (role: string) => tc.hasRealmRole(role),
      authFetch,
      // Policy-enabled encryption: the ORK nodes run the Forseti contract and refuse a
      // caller whose realm roles do not satisfy it.
      seal: async (policy, data) => {
        const [sealed] = await tc.doEncrypt(
          [{ data: JSON.stringify(data), tags: [policyTag(policy)] }],
          await bytesFor(policy),
        );
        return sealed as string;
      },
      open: async <T,>(sealed: string, policy: PolicyLabel) => {
        const [plain] = await tc.doDecrypt(
          [{ encrypted: sealed, tags: [policyTag(policy)] }],
          await bytesFor(policy),
        );
        return JSON.parse(plain as string) as T;
      },
    }),
    [tc, user, authFetch, bytesFor],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Tag passed to doEncrypt/doDecrypt, matching the Forseti policy's data tag. */
function policyTag(policy: PolicyLabel): string {
  return policy === "restricted-women" ? "restricted" : "site";
}

/* ------------------------------------------------- simulated identity provider */

function MockBridge({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const user = useMemo(() => decode(token), [token]);

  // Restore a session on load: the cookie says who, the provider issues a fresh token.
  useEffect(() => {
    let live = true;
    fetch("/api/auth/token", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => live && body?.token && setToken(body.token))
      .catch(() => {})
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  const authFetch = useCallback(
    (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(path, { ...init, headers });
    },
    [token],
  );

  const value = useMemo<Identity>(
    () => ({
      mode: "mock",
      simulated: true,
      ready,
      authenticated: Boolean(token),
      user,
      token,
      // No realm to redirect to; the caller sends the person to the /signin form.
      login: async () => false,
      signIn: async (username: string, password: string) => {
        const res = await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const body = (await res.json().catch(() => null)) as
          | { token: string; user: IdentityUser }
          | { error?: { message?: string } }
          | null;
        if (!res.ok || !body || !("token" in body)) {
          const message =
            body && "error" in body && body.error?.message
              ? body.error.message
              : "Could not sign in.";
          throw new Error(message);
        }
        setToken(body.token);
        return body.user;
      },
      logout: async () => {
        await fetch("/api/auth/signout", { method: "POST" });
        setToken(null);
      },
      refresh: async () => {
        const res = await fetch("/api/auth/token", { method: "POST" });
        if (res.ok) setToken(((await res.json()) as { token: string }).token);
      },
      hasRole: (role: string) => user?.roles.includes(role) ?? false,
      authFetch,
      // Simulated sealing: AES-256-GCM in this browser, with the per-policy key released by
      // /api/policy only to a verified token carrying the policy's role.
      seal: (policy, data) => {
        if (!token) throw new Error("Sign in first.");
        return encryptUnderPolicy(token, policy, data);
      },
      // Simulated ciphertext names its own policy, so the hint is unused here.
      open: <T,>(sealed: string, _policy: PolicyLabel) => {
        if (!token) throw new Error("Sign in first.");
        return decryptUnderPolicy<T>(token, sealed);
      },
    }),
    [ready, token, user, authFetch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
