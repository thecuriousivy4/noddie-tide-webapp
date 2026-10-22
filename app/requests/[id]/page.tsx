"use client";

// One change request, end to end: what was proposed, which community it was routed to, the
// live quorum tally, each custodian's own decision, the proof chain, and the trail.
//
// This page reads. The two things that change state have their own screens or their own
// explicit confirmation: a custodian's decision lives at /requests/[id]/decide, and
// committing shows exactly what it will do before it does it.

import { use, useState } from "react";
import Link from "next/link";
import { ServiceLayout } from "@/components/ServiceLayout";
import { ChangeStateBadge, changeTypeLabel } from "@/components/StateBadge";
import { QuorumTally, ProofChainPanel, type Proofs, type Tally } from "@/components/Governance";
import { Callout, Confirmation, TaskActions } from "@/components/TaskFlow";
import { useApi, usePost, useOpenPdf, ApiError } from "@/lib/useApi";
import { useIdentity } from "@/lib/identity/client";

interface Detail {
  request: {
    id: string;
    ref: string;
    type: string;
    state: string;
    title: string;
    description: string;
    place: { publicRef: string; publicName: string; country: string; zoneCells: string[] };
    community: { name: string; contact: string; consentRule: string; custodianCount: number };
    initiatorName: string;
    initiatorRole: string;
    initiatorSub: string;
    subjectName: string;
    subjectSub: string;
    grantedRole: string;
    ministerConsent: boolean;
    ministerConsentBy: string | null;
    rejectionReason: string | null;
    createdAt: string;
    noticeIssuedAt: string | null;
    decidedAt: string | null;
    committedAt: string | null;
  };
  tally: Tally;
  proofs: Proofs;
  decisions: {
    custodianName: string;
    custodianSub: string;
    decision: "APPROVE" | "DENY";
    signatureRef: string;
    at: string;
  }[];
  documents: { id: string; kind: string; filename: string; sha256: string; issuedAt: string }[];
  viewer: {
    sub: string;
    isCustodian: boolean;
    isInitiator: boolean;
    hasDecided: boolean;
    canDecide: boolean;
    canCommit: boolean;
    canIssueNotice: boolean;
    canRecordMinisterConsent: boolean;
  };
  trail: { seq: number; at: string; actorName: string; action: string; hash: string }[];
}

export default function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<Detail>(`/api/changes/${id}`);
  const post = usePost();
  const openPdf = useOpenPdf();
  const { mode, user, hasRole, refresh } = useIdentity();

  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [consentMessage, setConsentMessage] = useState<string | null>(null);
  const [committed, setCommitted] = useState<{ note: string; role: string } | null>(null);
  const [lodged, setLodged] = useState<{ ok: boolean; message: string } | null>(null);

  const crumbs = [
    { label: "Home", href: "/home" },
    { label: "Requests", href: "/requests" },
    { label: data?.request.ref ?? "Request" },
  ];

  if (loading) {
    return (
      <ServiceLayout crumbs={crumbs} title="Change request">
        <div className="muted">Loading…</div>
      </ServiceLayout>
    );
  }
  if (error || !data) {
    return (
      <ServiceLayout crumbs={crumbs} title="Change request not found">
        <div className="callout danger">
          <p>{error?.message ?? "No such request."}</p>
        </div>
      </ServiceLayout>
    );
  }

  const r = data.request;
  const v = data.viewer;

  if (committed) {
    return (
      <ServiceLayout crumbs={crumbs} title="Request committed" width="narrow">
        <Confirmation
          heading="Committed by quorum"
          reference={r.ref}
          next={[
            <>{committed.note}</>,
            <>
              An instrument of consent has been issued and its SHA-256 recorded in the{" "}
              <Link href="/activity">activity log</Link>.
            </>,
            <>
              The permit holder has to obtain a new token before the role exists for them. Their
              current token does not carry it.
            </>,
          ]}
          notDone={
            <p>
              Committing did not write a role into anyone&rsquo;s token from this service. It
              recorded that the community consented;{" "}
              {mode === "tidecloak"
                ? "the Tide network signs the role in."
                : "the identity provider will issue it on the holder's next token."}
            </p>
          }
        >
          <TaskActions>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setCommitted(null);
                reload();
              }}
            >
              View the request
            </button>
            <Link className="btn" href="/requests">
              Back to requests
            </Link>
          </TaskActions>
        </Confirmation>
      </ServiceLayout>
    );
  }

  return (
    <ServiceLayout crumbs={crumbs} caption={r.ref} title={r.title} lede={r.description}>
      <div className="stack" style={{ gap: 24 }}>
        <div className="row-wrap" style={{ gap: 12 }}>
          <ChangeStateBadge state={r.state} />
          <span className="small muted">{changeTypeLabel(r.type)}</span>
          <span className="small muted">
            · lodged by {r.initiatorName} ({r.initiatorRole}) on{" "}
            {new Date(r.createdAt).toLocaleDateString("en-AU", { dateStyle: "medium" })}
          </span>
        </div>

        {problem && (
          <div className="callout danger" role="alert">
            <h2>There is a problem</h2>
            <p>{problem}</p>
          </div>
        )}
        {consentMessage && (
          <Callout variant="warn" heading="Ministerial consent recorded">
            <p>{consentMessage}</p>
          </Callout>
        )}
        {r.state === "REJECTED" && r.rejectionReason && (
          <Callout variant="danger" heading="Refused">
            <p>{r.rejectionReason}</p>
            <p>
              No permit was created and nothing further in this register can create one. A fresh
              request would start again at notice.
            </p>
          </Callout>
        )}

        {/* Routing is shown as its own band: which community holds this place is a decision
            the register makes, and it should be visible rather than implied. */}
        <section className="routing">
          <div className="routing-step">
            <span className="tiny muted">Affected place</span>
            <strong className="mono">{r.place.publicRef}</strong>
            <span className="tiny muted">
              <Link href={`/register/${r.place.publicRef}`}>{r.place.publicName}</Link> ·{" "}
              {r.place.country}
            </span>
          </div>
          <span className="routing-arrow">→</span>
          <div className="routing-step">
            <span className="tiny muted">Routed to</span>
            <strong>{r.community.name}</strong>
            <span className="tiny muted">{r.community.consentRule}</span>
          </div>
          <span className="routing-arrow">→</span>
          <div className="routing-step">
            <span className="tiny muted">Would grant</span>
            <strong className="mono">{r.grantedRole}</strong>
            <span className="tiny muted">to {r.subjectName}</span>
          </div>
        </section>

        <div className="two-col">
          <div className="stack">
            <QuorumTally
              tally={data.tally}
              decisions={data.decisions}
              consentRule={r.community.consentRule}
              ministerConsent={r.ministerConsent}
              ministerConsentBy={r.ministerConsentBy}
              state={r.state}
            />

            <section className="panel">
              <div className="panel-head">
                <strong style={{ fontWeight: 600, fontSize: 14 }}>Available to you</strong>
                <span className="tiny muted">from your token</span>
              </div>
              <div className="panel-body stack-sm">
                {v.canIssueNotice && (
                  <div className="action-row">
                    <div className="grow">
                      <strong className="small">Serve the notice</strong>
                      <p className="tiny muted">
                        This request is still a draft. Serving the notice generates the PDF,
                        records its hash, and opens the request to the quorum.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy("notice");
                        setProblem(null);
                        try {
                          await post(`/api/changes/${id}/notice`);
                          reload();
                        } catch (err) {
                          setProblem(err instanceof ApiError ? err.message : String(err));
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {busy === "notice" ? "Serving…" : "Serve notice"}
                    </button>
                  </div>
                )}

                {v.canDecide && (
                  <div className="action-row">
                    <div className="grow">
                      <strong className="small">Record your decision</strong>
                      <p className="tiny muted">
                        {data.tally.outstanding} of {data.tally.threshold} approvals still
                        required. Your decision is yours alone and cannot be changed afterwards.
                      </p>
                    </div>
                    <Link className="btn btn-primary btn-sm" href={`/requests/${id}/decide`}>
                      Decide this request
                    </Link>
                  </div>
                )}

                {v.canCommit && (
                  <div className="action-row">
                    <div className="grow">
                      <strong className="small">Commit</strong>
                      <p className="tiny muted">
                        The threshold is met. Committing issues the instrument of consent and
                        records the grant.{" "}
                        {mode === "tidecloak"
                          ? "The role reaches the holder only when the network signs it into their token."
                          : "The identity provider will then issue the role on the holder's next token."}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy("commit");
                        setProblem(null);
                        try {
                          const res = await post<{ tokenNote: string; grantedRole: string }>(
                            `/api/changes/${id}/commit`,
                          );
                          setCommitted({ note: res.tokenNote, role: res.grantedRole });
                        } catch (err) {
                          setProblem(err instanceof ApiError ? err.message : String(err));
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {busy === "commit" ? "Committing…" : "Commit the request"}
                    </button>
                  </div>
                )}

                {v.canRecordMinisterConsent && (
                  <div className="action-row">
                    <div className="grow">
                      <strong className="small">Record ministerial consent</strong>
                      <p className="tiny muted">
                        Kept permanently and shown to the custodians. It is not a quorum
                        signature, it does not change the tally, and it advances nothing.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy("consent");
                        setProblem(null);
                        try {
                          const res = await post<{ message: string }>(
                            `/api/changes/${id}/minister-consent`,
                          );
                          setConsentMessage(res.message);
                          reload();
                        } catch (err) {
                          setProblem(err instanceof ApiError ? err.message : String(err));
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {busy === "consent" ? "Recording…" : "Record consent"}
                    </button>
                  </div>
                )}

                {/* The gate. Shown to the subject of a committed request, because this is
                    where the whole argument is settled: the route reads the token and
                    nothing else. Before the role is in the token it refuses; after, it
                    accepts. */}
                {r.state === "COMMITTED" && r.subjectSub === user?.sub && (
                  <div className="action-row">
                    <div className="grow">
                      <strong className="small">Lodge works under this permit</strong>
                      <p className="tiny muted">
                        Checked against your verified token only — no column in this database can
                        change the answer.{" "}
                        {hasRole(r.grantedRole)
                          ? "Your token carries " + r.grantedRole + "."
                          : "Your token does not carry " +
                            r.grantedRole +
                            " yet; refresh it first and watch the refusal before you do."}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy("lodge");
                        setLodged(null);
                        try {
                          const res = await post<{ receipt: { sha256: string } }>(
                            "/api/works-notices",
                            { placeRef: r.place.publicRef },
                          );
                          setLodged({
                            ok: true,
                            message:
                              "Accepted. The token presented carried " +
                              r.grantedRole +
                              ", and a receipt quoting it has been filed (SHA-256 " +
                              res.receipt.sha256.slice(0, 16) +
                              ").",
                          });
                          reload();
                        } catch (err) {
                          setLodged({
                            ok: false,
                            message: err instanceof ApiError ? err.message : String(err),
                          });
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {busy === "lodge" ? "Lodging…" : "Lodge works notice"}
                    </button>
                  </div>
                )}

                {lodged && (
                  <Callout
                    variant={lodged.ok ? "ok" : "danger"}
                    heading={lodged.ok ? "Works notice accepted" : "Works notice refused"}
                  >
                    <p>{lodged.message}</p>
                    {!lodged.ok && (
                      <p>
                        <button type="button" className="link-btn" onClick={() => refresh()}>
                          Refresh your token
                        </button>{" "}
                        and try again — a committed grant only reaches you in a newly issued token.
                      </p>
                    )}
                  </Callout>
                )}

                {!v.canIssueNotice &&
                  !v.canDecide &&
                  !v.canCommit &&
                  !v.canRecordMinisterConsent &&
                  !(r.state === "COMMITTED" && r.subjectSub === user?.sub) && (
                    <p className="small muted">
                      {v.hasDecided
                        ? "You have already decided this request. A custodian gets one decision and cannot take another."
                        : v.isInitiator
                          ? "You lodged this request, so you cannot also approve it. Four eyes, always."
                          : v.isCustodian
                            ? "Nothing to do at this state."
                            : "Your token carries no role that can act on this request. This service cannot add one."}
                    </p>
                  )}
              </div>
            </section>
          </div>

          <div className="stack">
            <ProofChainPanel
              proofs={data.proofs}
              documents={data.documents}
              onOpenDocument={(docId) =>
                openPdf(`/api/changes/${id}/documents/${docId}`).catch((e) => setProblem(String(e)))
              }
            />

            <section className="panel">
              <div className="panel-head">
                <strong style={{ fontWeight: 600, fontSize: 14 }}>Trail</strong>
                <span className="tiny muted">append-only, hash-chained</span>
              </div>
              <div className="panel-body">
                <ol className="trail">
                  {data.trail.map((e) => (
                    <li key={e.seq}>
                      <span className="mono tiny trail-seq">#{e.seq}</span>
                      <span className="grow">
                        <strong className="small">{e.action}</strong>
                        <span className="tiny muted">
                          {" "}
                          · {e.actorName} ·{" "}
                          {new Date(e.at).toLocaleString("en-AU", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </span>
                      <span className="mono tiny muted">{e.hash.slice(0, 10)}…</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </div>
        </div>
      </div>
    </ServiceLayout>
  );
}
