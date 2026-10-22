"use client";

// The service chrome: a two-row top navbar (authority lockup + account, then the primary
// nav), breadcrumbs, a single content column, and a footer carrying the Acknowledgement of
// Country. No sidebar, no dashboard — every screen is one step of one task.

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, RefreshCw } from "lucide-react";
import { useIdentity } from "@/lib/identity/client";
import { Mark } from "./Mark";
import { NavTab } from "./NavTab";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { SimulationBanner } from "./SimulationBanner";

interface NavItem {
  href: string;
  label: string;
  anyRole: string[];
}

const NAV: NavItem[] = [
  { href: "/register", label: "Register", anyRole: [] },
  { href: "/requests", label: "Requests", anyRole: [] },
  { href: "/transparency", label: "Transparency", anyRole: [] },
  { href: "/activity", label: "Activity", anyRole: [] },
];

export function ServiceLayout({
  children,
  crumbs,
  title,
  lede,
  requiredRole,
  /** Narrow column for forms and single-concern screens; wide for records tables. */
  width = "wide",
  /** Set on task-flow screens so the nav does not invite a mid-task detour. */
  caption,
}: {
  children: ReactNode;
  crumbs?: Crumb[];
  title?: string;
  lede?: string;
  requiredRole?: string;
  width?: "wide" | "narrow";
  caption?: string;
}) {
  const { ready, authenticated, user, logout, refresh, simulated } = useIdentity();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/signin");
  }, [ready, authenticated, router]);

  if (!ready) return <div className="loading-screen">Checking your token…</div>;
  if (!authenticated || !user) return <div className="loading-screen">Taking you to sign in…</div>;

  const roles = user.roles;
  const denied = requiredRole && !roles.includes(requiredRole);

  return (
    <div className="svc">
      {simulated && <SimulationBanner />}

      <header className="svc-masthead">
        <div className="svc-row">
          <Link href="/home" className="svc-lockup">
            <Mark size={36} />
            <span>
              <span className="svc-lockup-name">Noddie</span>
              <span className="svc-lockup-sub">
                Heritage register &middot; each place held by its own Traditional Owner corporation
              </span>
            </span>
          </Link>

          <div className="svc-account">
            <span className="svc-account-who">
              <span className="svc-account-name">{user.name}</span>
              <span className="svc-account-sub mono">
                {user.username || user.sub.slice(0, 8)}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-sm"
              disabled={refreshing}
              title="Ask the identity provider for a fresh token. A newly granted role appears only after this."
              onClick={async () => {
                setRefreshing(true);
                try {
                  await refresh();
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              <RefreshCw size={13} strokeWidth={1.8} />
              {refreshing ? "Refreshing" : "Refresh token"}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={async () => {
                await logout();
                router.replace("/");
              }}
            >
              <LogOut size={13} strokeWidth={1.8} /> Sign out
            </button>
          </div>
        </div>

        <nav className="svc-nav" aria-label="Primary">
          <div className="svc-row svc-nav-row">
            {NAV.filter((i) => i.anyRole.length === 0 || i.anyRole.some((r) => roles.includes(r))).map(
              (i) => (
                <NavTab key={i.href} href={i.href} label={i.label} />
              ),
            )}
          </div>
        </nav>
      </header>

      <main className={`svc-main ${width}`}>
        {crumbs && crumbs.length > 0 && <Breadcrumbs crumbs={crumbs} />}

        {(title || lede) && (
          <div className="svc-head">
            {caption && <span className="svc-caption">{caption}</span>}
            {title && <h1>{title}</h1>}
            {lede && <p className="svc-lede">{lede}</p>}
          </div>
        )}

        {denied ? (
          <div className="callout danger">
            <h2>This task is not available to your account</h2>
            <p>
              It needs the role <code>{requiredRole}</code>. Your token carries{" "}
              {roles.length > 0 ? roles.map((r) => <code key={r}>{r}</code>) : "no roles"}. This
              service cannot add a role to your token — a custodian quorum has to grant it and the
              identity provider has to issue it.
            </p>
          </div>
        ) : (
          children
        )}
      </main>

      <footer className="svc-footer">
        <div className="svc-row svc-footer-inner">
          <div>
            <h2>Acknowledgement of Country</h2>
            <p>
              We acknowledge the Traditional Owners and Custodians of Country throughout
              Australia and their continuing connection to land, waters, skies and community. We
              pay our respects to Elders past and present. Sovereignty was never ceded. This
              register defers to Traditional Owners on everything it holds.
            </p>
          </div>
          <div className="svc-footer-meta">
            <span>Prototype · synthetic data · no Aboriginal art or iconography is used</span>
            <span>
              <Link href="/transparency">What this server holds</Link> ·{" "}
              <Link href="/activity">Activity log</Link>
            </span>
            <span className="mono tiny">
              identity: {simulated ? "simulated" : "TideCloak"} · version 0.3.0
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
