"use client";

// "What this server actually holds."
//
// The point of this screen is that it is boring. Anyone signed in — including a platform
// administrator — sees the protected columns exactly as PostgreSQL stores them, and they are
// ciphertext. If that were ever untrue, it would be visible here first.

import { ServiceLayout } from "@/components/ServiceLayout";
import { CipherText } from "@/components/CipherText";
import { useApi } from "@/lib/useApi";
import { CheckCircle2, XCircle } from "lucide-react";

interface Transparency {
  viewer: { name: string; roles: string[]; verifiedVia: string };
  mode: string;
  expectedPrefix: string;
  claims: { claim: string; holds: boolean; note?: string }[];
  places: {
    publicRef: string;
    publicName: string;
    country: string;
    zoneCells: string[];
    status: string;
    custodianOrg: string;
    sealedName: string;
    sealedBoundary: string;
    sealedSignificance: string;
    sealedRestricted: string | null;
    sealedLooksEncrypted: boolean;
  }[];
  changeRequests: {
    ref: string;
    state: string;
    grantedRole: string;
    subjectName: string;
    noticePdfHash: string | null;
    ministerConsent: boolean;
    tideGrantRef: string | null;
    committedAt: string | null;
  }[];
  documents: { filename: string; kind: string; sha256: string; issuedAt: string }[];
  auditChain: { events: number; intact: boolean; brokenAtSeq?: number };
}

export default function TransparencyPage() {
  const { data, loading } = useApi<Transparency>("/api/transparency");

  if (loading || !data) {
    return (
      <ServiceLayout
        crumbs={[{ label: "Home", href: "/home" }, { label: "Transparency" }]}
        title="Transparency"
      >
        <div className="muted">Reading the database…</div>
      </ServiceLayout>
    );
  }

  return (
    <ServiceLayout
      crumbs={[{ label: "Home", href: "/home" }, { label: "Transparency" }]}
      title="What this server holds"
      lede={`Read as ${data.viewer.name} (${data.viewer.roles.join(", ") || "no roles"}). These are the raw columns, not a rendering of them.`}
    >
      <div className="stack" style={{ gap: 26 }}>
        <section className="claims">
          {data.claims.map((c) => (
            <div className={`claim${c.holds ? " holds" : " fails"}`} key={c.claim}>
              {c.holds ? (
                <CheckCircle2 size={16} strokeWidth={1.7} className="ico-ok" />
              ) : (
                <XCircle size={16} strokeWidth={1.7} className="ico-danger" />
              )}
              <div>
                <strong className="small">{c.claim}</strong>
                {c.note && <p className="tiny muted">{c.note}</p>}
              </div>
            </div>
          ))}
        </section>

        <section className="stack-sm">
          <h2>place</h2>
          <p className="muted small">
            Ciphertext in this mode is prefixed <code>{data.expectedPrefix}</code>. The public
            columns are public on purpose: a reference, a coarse land description, generalized
            zones.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>publicRef</th>
                  <th>publicName</th>
                  <th className="col-secondary">zoneCells</th>
                  <th>sealedName</th>
                  <th>sealedBoundary</th>
                  <th>sealedSignificance</th>
                  <th>sealedRestricted</th>
                </tr>
              </thead>
              <tbody>
                {data.places.map((p) => (
                  <tr key={p.publicRef}>
                    <td className="mono">{p.publicRef}</td>
                    <td>{p.publicName}</td>
                    <td className="mono tiny col-secondary">{p.zoneCells.join(" ")}</td>
                    <td>
                      <CipherText value={p.sealedName} max={40} />
                    </td>
                    <td>
                      <CipherText value={p.sealedBoundary} max={40} />
                    </td>
                    <td>
                      <CipherText value={p.sealedSignificance} max={40} />
                    </td>
                    <td>
                      {p.sealedRestricted ? (
                        <CipherText value={p.sealedRestricted} max={40} />
                      ) : (
                        <span className="tiny muted">null</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.places.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted small">
                      No places recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="stack-sm">
          <h2>change_request</h2>
          <p className="muted small">
            <code>grantedRole</code> is a record of what was authorised. It is not the authority:
            every gate reads the role from a signed token instead, which is why editing this table
            would achieve nothing.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ref</th>
                  <th>state</th>
                  <th>grantedRole</th>
                  <th className="col-secondary">subject</th>
                  <th className="col-secondary">noticePdfHash</th>
                  <th className="col-secondary">ministerConsent</th>
                  <th>tideGrantRef</th>
                </tr>
              </thead>
              <tbody>
                {data.changeRequests.map((c) => (
                  <tr key={c.ref}>
                    <td className="mono">{c.ref}</td>
                    <td>{c.state}</td>
                    <td className="mono">{c.grantedRole}</td>
                    <td className="col-secondary">{c.subjectName}</td>
                    <td className="mono tiny col-secondary">
                      {c.noticePdfHash ? `${c.noticePdfHash.slice(0, 14)}…` : "—"}
                    </td>
                    <td className="col-secondary">{c.ministerConsent ? "true" : "false"}</td>
                    <td className="mono tiny">{c.tideGrantRef ?? "—"}</td>
                  </tr>
                ))}
                {data.changeRequests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted small">
                      Nothing yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="stack-sm">
          <h2>notice_document</h2>
          <p className="muted small">
            Every instrument the register issues, with the SHA-256 recorded in the log at the
            moment it was issued.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>filename</th>
                  <th>kind</th>
                  <th>sha256</th>
                  <th className="col-secondary">issuedAt</th>
                </tr>
              </thead>
              <tbody>
                {data.documents.map((d) => (
                  <tr key={d.sha256}>
                    <td className="mono tiny">{d.filename}</td>
                    <td>{d.kind.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="mono tiny">{d.sha256}</td>
                    <td className="col-secondary tiny">
                      {new Date(d.issuedAt).toLocaleString("en-AU", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
                {data.documents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted small">
                      No documents issued yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`callout ${data.auditChain.intact ? "ok" : "danger"}`}>
          <h2>Activity log chain</h2>
          <p>
            {data.auditChain.intact
              ? `${data.auditChain.events} events, recomputed from the first; every hash matches its parent.`
              : `Broken at event #${data.auditChain.brokenAtSeq}. A row has been edited or removed.`}
          </p>
        </section>
      </div>
    </ServiceLayout>
  );
}
