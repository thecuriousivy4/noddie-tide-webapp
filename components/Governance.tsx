"use client";

// Two panels that carry the argument of the whole app:
//
//   QuorumTally   — a live count toward the community's own threshold, with each custodian's
//                   independent decision, and a line for the minister's consent showing that
//                   it was recorded and not counted.
//   ProofChainPanel — the three proofs a committed request carries: notice served (a PDF
//                   hash fixed before any decision), consent (the signatures), and authority
//                   (the network grant). Missing proofs are shown as missing.

import { CheckCircle2, Circle, FileText, MinusCircle, XCircle } from "lucide-react";

export interface Tally {
  approvals: number;
  denials: number;
  threshold: number;
  custodians: number;
  outstanding: number;
  quorumReached: boolean;
  quorumImpossible: boolean;
}

export interface DecisionRow {
  custodianName: string;
  custodianSub: string;
  decision: "APPROVE" | "DENY";
  signatureRef?: string;
  at: string;
}

export function QuorumTally({
  tally,
  decisions,
  consentRule,
  ministerConsent,
  ministerConsentBy,
  state,
}: {
  tally: Tally;
  decisions: DecisionRow[];
  consentRule: string;
  ministerConsent: boolean;
  ministerConsentBy?: string | null;
  state: string;
}) {
  const pct = Math.min(100, (tally.approvals / Math.max(1, tally.threshold)) * 100);

  return (
    <section className="panel">
      <div className="panel-head">
        <strong style={{ fontWeight: 600, fontSize: 14 }}>Quorum</strong>
        <span className="tiny muted">{consentRule}</span>
      </div>
      <div className="panel-body stack-sm">
        <div className="tally-figure">
          <span className="tally-count">
            {tally.approvals} <span className="muted">of {tally.threshold}</span>
          </span>
          <span className="tally-note">
            {state === "COMMITTED"
              ? "committed"
              : tally.quorumReached
                ? "threshold met — awaiting commit"
                : tally.quorumImpossible
                  ? "threshold can no longer be met"
                  : `${tally.outstanding} more approval${tally.outstanding === 1 ? "" : "s"} required`}
          </span>
        </div>

        <div className="tally-bar" role="img" aria-label={`${tally.approvals} of ${tally.threshold} approvals`}>
          <span style={{ width: `${pct}%` }} className={tally.quorumReached ? "met" : ""} />
        </div>

        <ul className="decision-list">
          {decisions.length === 0 && (
            <li className="tiny muted">No custodian has decided yet.</li>
          )}
          {decisions.map((d) => (
            <li key={d.custodianSub}>
              {d.decision === "APPROVE" ? (
                <CheckCircle2 size={15} strokeWidth={1.7} className="ico-ok" />
              ) : (
                <XCircle size={15} strokeWidth={1.7} className="ico-danger" />
              )}
              <span className="grow">
                <strong>{d.custodianName}</strong>{" "}
                <span className="tiny muted">
                  {d.decision === "APPROVE" ? "approved" : "declined"}{" "}
                  {new Date(d.at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </span>
              {d.signatureRef && <span className="mono tiny muted">{d.signatureRef.slice(0, 18)}…</span>}
            </li>
          ))}
          {Array.from({ length: Math.max(0, tally.custodians - decisions.length) }).map((_, i) => (
            <li key={`waiting-${i}`} className="muted">
              <Circle size={15} strokeWidth={1.5} />
              <span className="grow tiny">awaiting a custodian</span>
            </li>
          ))}
        </ul>

        <div className={`minister-line${ministerConsent ? " recorded" : ""}`}>
          <MinusCircle size={14} strokeWidth={1.7} />
          <span>
            {ministerConsent ? (
              <>
                <strong>Ministerial consent recorded</strong>
                {ministerConsentBy ? ` by ${ministerConsentBy}` : ""} — not counted toward this
                tally, and not required for the grant.
              </>
            ) : (
              <>No ministerial consent recorded. None is required: it is not a quorum signature.</>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}

export interface Proofs {
  notice: { present: boolean; sha256: string | null; issuedAt: string | null; filename: string | null };
  consent: {
    present: boolean;
    threshold: number;
    signatures: { custodian: string; signatureRef: string; at: string }[];
  };
  authority: {
    present: boolean;
    grantedRole: string;
    tideGrantRef: string | null;
    committedAt: string | null;
  };
  ministerConsent: { recorded: boolean; by: string | null; counted: false };
}

export function ProofChainPanel({
  proofs,
  documents,
  onOpenDocument,
}: {
  proofs: Proofs;
  documents: { id: string; kind: string; filename: string; sha256: string; issuedAt: string }[];
  onOpenDocument?: (id: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <strong style={{ fontWeight: 600, fontSize: 14 }}>Proof chain</strong>
        <span className="tiny muted">what a permit has to carry</span>
      </div>
      <div className="panel-body stack-sm">
        <ProofRow
          present={proofs.notice.present}
          title="Proof of notice served"
          detail={
            proofs.notice.present
              ? `${proofs.notice.filename ?? "notice.pdf"} · issued ${fmt(proofs.notice.issuedAt)}`
              : "No notice has been issued, so the request is not open to the quorum."
          }
          hash={proofs.notice.sha256}
        />
        <ProofRow
          present={proofs.consent.present}
          title="Proof of consent"
          detail={
            proofs.consent.signatures.length === 0
              ? `No custodian signatures yet. ${proofs.consent.threshold} required.`
              : `${proofs.consent.signatures.length} signature(s): ${proofs.consent.signatures
                  .map((s) => s.custodian)
                  .join(", ")} · threshold ${proofs.consent.threshold}`
          }
        />
        <ProofRow
          present={proofs.authority.present}
          title="Proof of authority"
          detail={
            proofs.authority.present
              ? `${proofs.authority.grantedRole} authorised ${fmt(proofs.authority.committedAt)}. It reaches the holder only in a network-signed token.`
              : `Nothing has been granted. ${proofs.authority.grantedRole} does not exist for this subject.`
          }
          hash={proofs.authority.tideGrantRef}
        />

        {documents.length > 0 && (
          <div className="doc-list">
            {documents.map((d) => (
              <button
                key={d.id}
                type="button"
                className="doc-row"
                onClick={() => onOpenDocument?.(d.id)}
                disabled={!onOpenDocument}
              >
                <FileText size={15} strokeWidth={1.6} />
                <span className="grow">
                  <strong>{d.filename}</strong>
                  <span className="tiny muted"> · {d.kind.replace(/_/g, " ").toLowerCase()}</span>
                </span>
                <span className="mono tiny muted">{d.sha256.slice(0, 16)}…</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ProofRow({
  present,
  title,
  detail,
  hash,
}: {
  present: boolean;
  title: string;
  detail: string;
  hash?: string | null;
}) {
  return (
    <div className={`proof-row${present ? " present" : ""}`}>
      {present ? (
        <CheckCircle2 size={17} strokeWidth={1.7} className="ico-ok" />
      ) : (
        <Circle size={17} strokeWidth={1.5} />
      )}
      <div className="grow">
        <div className="proof-title">{title}</div>
        <div className="proof-detail">{detail}</div>
        {hash && <div className="mono proof-hash">{hash}</div>}
      </div>
    </div>
  );
}

function fmt(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}
