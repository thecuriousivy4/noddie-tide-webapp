"use client";

// Guided demo: the seven steps of the scenario, each with who to be, what to do, and a live
// check against the register so a presenter can see where they are.

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { ServiceLayout } from "@/components/ServiceLayout";
import { useApi } from "@/lib/useApi";
import { useIdentity } from "@/lib/identity/client";

interface ChangeRow {
  id: string;
  ref: string;
  state: string;
  placeRef: string;
  ministerConsent: boolean;
  noticePdfHash: string | null;
  grantedRole: string;
  subjectSub: string;
  tally: { approvals: number; threshold: number };
  documents: { kind: string }[];
}

export default function GuidePage() {
  const { user, mode } = useIdentity();
  const places = useApi<{ places: { publicRef: string }[] }>("/api/places");
  const changes = useApi<{ requests: ChangeRow[] }>("/api/changes");

  const all = changes.data?.requests ?? [];
  const latest = all[0];
  const committed = all.find((c) => c.state === "COMMITTED");

  const steps = [
    {
      n: 1,
      who: "Elder Joan (custodian)",
      title: "Record places, sealed in the browser",
      what: "Open the register and press “Load sample places”. The protected fields are encrypted before they leave the browser; the server receives ciphertext.",
      href: "/register",
      done: (places.data?.places.length ?? 0) >= 2,
    },
    {
      n: 2,
      who: "Elder Lena (custodian + custodian-women)",
      title: "Record the place with a restricted layer",
      what: "RB-15 carries a second, separately sealed layer. Only the custodian-women standing opens it — Ray holds custodian and still cannot.",
      href: "/register",
      done: (places.data?.places.length ?? 0) >= 3,
    },
    {
      n: 3,
      who: "Dana (proponent)",
      title: "Run a clearance check, then apply",
      what: "Select zones E4–F5 and run the check. You get a reference, a land description and a contact — never a name or a boundary. Apply for a works permit from the result.",
      href: "/check",
      done: all.length > 0,
    },
    {
      n: 4,
      who: "Dana (proponent)",
      title: "Issue the notice",
      what: "Open the request and issue the notice. A real PDF is generated server-side and its SHA-256 is written to the append-only log — proof of notice served, fixed before anyone decides.",
      href: latest ? `/requests/${latest.id}` : "/requests",
      done: all.some((c) => c.noticePdfHash),
    },
    {
      n: 5,
      who: "Minister Harding",
      title: "Press consent, and watch nothing happen",
      what: "The queue lets the Minister record a consent. It returns 200, it is kept permanently, and the request does not move. The tally is unchanged.",
      href: "/queue",
      done: all.some((c) => c.ministerConsent),
    },
    {
      n: 6,
      who: "Elder Joan, then Elder Ray",
      title: "Two custodians approve, independently",
      what: "Each signs in their own session and decides for themselves. The initiator cannot approve, and one custodian cannot approve twice. At two of three the request becomes APPROVED; a custodian then commits it.",
      href: latest ? `/requests/${latest.id}` : "/requests",
      done: all.some((c) => c.state === "COMMITTED" || c.state === "APPROVED"),
    },
    {
      n: 7,
      who: "Dana (proponent)",
      title: "Lodge the works notice — before and after",
      what: "Lodge it before the commit: refused, because the token carries no permit role. Refresh the token after the commit and lodge again: accepted, and the receipt quotes the token it was checked against.",
      href: "/applications",
      done: Boolean(committed),
    },
  ];

  return (
    <ServiceLayout
      crumbs={[{ label: "Home", href: "/home" }, { label: "Guided demonstration" }]}
      title="Guided demonstration"
      lede="Seven steps, in order. Sign in as the person named in each step — the point of the demo is that no single person can do all of it."
    >
      <div className="stack" style={{ gap: 22 }}>
        <div className="banner">
          <strong>Signed in as {user?.name ?? "—"}.</strong>{" "}
          {mode === "tidecloak"
            ? "Each person signs in through their own TideCloak account; there are no shared passwords and no account that can read everything."
            : "Dev identity: switch accounts from the sign-out button on the public page. The governance rules are unchanged, but the identity is local."}
        </div>

        <ol className="guide-steps">
          {steps.map((s) => (
            <li key={s.n} className={s.done ? "done" : undefined}>
              <span className="guide-mark">
                {s.done ? (
                  <CheckCircle2 size={18} strokeWidth={1.7} className="ico-ok" />
                ) : (
                  <Circle size={18} strokeWidth={1.5} />
                )}
              </span>
              <div className="grow">
                <div className="guide-head">
                  <strong>
                    {s.n}. {s.title}
                  </strong>
                  <span className="tiny muted">{s.who}</span>
                </div>
                <p className="small">{s.what}</p>
                <Link className="btn btn-sm" href={s.href}>
                  Go
                </Link>
              </div>
            </li>
          ))}
        </ol>

        <section className="panel">
          <div className="panel-head">
            <strong style={{ fontWeight: 600, fontSize: 14 }}>What to say at the end</strong>
          </div>
          <div className="panel-body stack-sm small">
            <p>
              Open <Link href="/transparency">Transparency</Link> as the system administrator. The
              protected columns are ciphertext, the audit chain recomputes intact, and the permit
              column is a record rather than an authority.
            </p>
            <p>
              Then say the line that matters: at no point in this flow did any single party — not
              the Minister, not the administrator, not the operator of this register — hold the
              ability to reveal a place or permit works on it. That authority did not exist until
              two custodians made it exist.
            </p>
          </div>
        </section>
      </div>
    </ServiceLayout>
  );
}
