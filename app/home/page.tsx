"use client";

// The signed-in landing page.
//
// Deliberately not a dashboard: an acknowledgement, who the register believes you are, the
// roles the identity provider signed into your token, and the two or three tasks your roles
// actually permit. Everything else is a page of its own, reached through the nav.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ServiceLayout } from "@/components/ServiceLayout";
import { RoleBadge } from "@/components/RoleBadge";
import { useIdentity } from "@/lib/identity/client";
import { useApi } from "@/lib/useApi";

interface Me {
  user: { name: string; roles: string[] };
  verifiedVia: string;
  issuer: string;
  authority: { role: string; explain: string }[];
  permits: { ref: string; placeRef: string; placeName: string; role: string }[];
}

interface Task {
  href: string;
  title: string;
  what: string;
  go: string;
  roles: string[];
}

const TASKS: Task[] = [
  {
    href: "/register/new",
    title: "Record a place",
    what:
      "Add a place to the register. Its name, boundary and significance are encrypted in your browser before they are sent.",
    go: "Start recording a place",
    roles: ["custodian"],
  },
  {
    href: "/requests",
    title: "Decide a change request",
    what:
      "Review what has been proposed against your community's places and record your own decision. Your community's own consent rule decides when it carries.",
    go: "Go to requests",
    roles: ["custodian"],
  },
  {
    href: "/requests/new",
    title: "Lodge a works notice",
    what:
      "Propose works affecting a place on the register. A formal notice is served on the community and routed to its custodian quorum.",
    go: "Start a works notice",
    roles: ["proponent", "minister"],
  },
  {
    href: "/requests",
    title: "View the permit queue",
    what:
      "See every open request and record a ministerial consent. Consent is an input to the community's decision and grants nothing on its own.",
    go: "Go to requests",
    roles: ["minister"],
  },
  {
    href: "/transparency",
    title: "Check what the server holds",
    what:
      "Read the protected columns exactly as the database stores them, and recompute the activity log's hash chain.",
    go: "Open transparency",
    roles: ["tide-realm-admin"],
  },
];

export default function HomePage() {
  const { user } = useIdentity();
  const { data } = useApi<Me>("/api/me");

  const roles = user?.roles ?? [];
  const tasks = TASKS.filter((t) => t.roles.some((r) => roles.includes(r)));
  const name = (user?.name ?? "").replace(/^Elder\s+/, "");

  return (
    <ServiceLayout
      title={name ? `Welcome, ${name}` : "Welcome"}
      lede="This register holds places on behalf of their Traditional Owners. What you can do here is decided by your token, not by this page."
    >
      <div className="stack" style={{ gap: 30 }}>
        <section className="landing-ack">
          <h2>Acknowledgement of Country</h2>
          <p>
            We acknowledge the Traditional Owners and Custodians of Country throughout Australia
            and their continuing connection to land, waters, skies and community. We pay our
            respects to Elders past and present. Sovereignty was never ceded.
          </p>
        </section>

        <section className="stack-sm">
          <h2>Your authority</h2>
          <p className="small muted" style={{ maxWidth: "80ch" }}>
            These roles were read from your signed token
            {data ? ` (verified ${data.verifiedVia})` : ""}. This service has no code path that
            adds one: a permit or a reading standing appears here only after a custodian quorum
            commits it and the identity provider issues a new token.
          </p>
          <div className="token-roles">
            {roles.length === 0 && <span className="small muted">No roles in this token.</span>}
            {roles.map((r) => (
              <RoleBadge key={r} role={r} />
            ))}
          </div>
          {data && data.authority.length > 0 && (
            <dl className="authority-list" style={{ marginTop: 10, maxWidth: "80ch" }}>
              {data.authority.map((a) => (
                <div key={a.role}>
                  <dt className="mono">{a.role}</dt>
                  <dd>{a.explain}</dd>
                </div>
              ))}
            </dl>
          )}
          {data && data.permits.length > 0 && (
            <div className="callout ok" style={{ marginTop: 10 }}>
              <h2>Permits in your token</h2>
              {data.permits.map((p) => (
                <p key={p.ref}>
                  <strong className="mono">{p.role}</strong> — {p.placeRef} {p.placeName}, granted
                  under {p.ref}.
                </p>
              ))}
            </div>
          )}
        </section>

        <section className="stack-sm">
          <h2>Start a task</h2>
          {tasks.length === 0 ? (
            <div className="callout info">
              <p>
                Your token carries no role that can start a task. You can still read the public
                register, the transparency view and the activity log from the navigation above.
              </p>
            </div>
          ) : (
            <div className="start-tasks">
              {tasks.map((t) => (
                <Link key={t.title} href={t.href} className="start-task">
                  <h2>{t.title}</h2>
                  <p>{t.what}</p>
                  <span className="start-task-go">
                    {t.go} <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: "-2px" }} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="stack-sm">
          <h2>Walking the demonstration</h2>
          <p className="small muted" style={{ maxWidth: "80ch" }}>
            The seven steps of the scenario, in order, with the account each step needs — useful
            if you are presenting this rather than using it.
          </p>
          <Link className="btn btn-sm" href="/guide" style={{ alignSelf: "flex-start" }}>
            Open the guided demonstration
          </Link>
        </section>
      </div>
    </ServiceLayout>
  );
}
