"use client";

// Task: a custodian's decision.
//
//   Decide → Check → Confirmation
//
// One custodian, one session, one decision. The page states plainly what the decision does
// and does not do before it is taken, because it cannot be taken back: approvals are
// signatures and the log is append-only.

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ServiceLayout } from "@/components/ServiceLayout";
import { Field } from "@/components/Field";
import { QuorumTally, type Tally } from "@/components/Governance";
import { Callout, CheckAnswers, Confirmation, TaskActions, TaskSteps } from "@/components/TaskFlow";
import { useApi, usePost, ApiError } from "@/lib/useApi";

const STEPS = ["Your decision", "Check your answer", "Confirmation"];

interface Detail {
  request: {
    id: string;
    ref: string;
    state: string;
    title: string;
    description: string;
    place: { publicRef: string; publicName: string; country: string; zoneCells: string[] };
    community: { name: string; consentRule: string; custodianCount: number };
    initiatorName: string;
    initiatorRole: string;
    subjectName: string;
    grantedRole: string;
    ministerConsent: boolean;
    ministerConsentBy: string | null;
  };
  tally: Tally;
  decisions: { custodianName: string; custodianSub: string; decision: "APPROVE" | "DENY"; at: string }[];
  proofs: { notice: { present: boolean; sha256: string | null } };
  viewer: { canDecide: boolean; hasDecided: boolean; isInitiator: boolean; isCustodian: boolean };
}

export default function DecidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, loading, error } = useApi<Detail>(`/api/changes/${id}`);
  const post = usePost();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [choice, setChoice] = useState<"APPROVE" | "DENY" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ state: string; tally: Tally } | null>(null);

  const crumbs = [
    { label: "Home", href: "/home" },
    { label: "Requests", href: "/requests" },
    { label: data?.request.ref ?? "Request", href: `/requests/${id}` },
    { label: "Decide" },
  ];

  if (loading) {
    return (
      <ServiceLayout crumbs={crumbs} title="Decision" width="narrow" requiredRole="custodian">
        <div className="muted">Loading…</div>
      </ServiceLayout>
    );
  }
  if (error || !data) {
    return (
      <ServiceLayout crumbs={crumbs} title="Decision" width="narrow" requiredRole="custodian">
        <div className="callout danger">
          <p>{error?.message ?? "No such request."}</p>
        </div>
      </ServiceLayout>
    );
  }

  const r = data.request;

  // The server already decided whether this viewer may act. Say why, rather than
  // presenting a form that would be refused.
  if (!data.viewer.canDecide && step !== 3) {
    return (
      <ServiceLayout
        crumbs={crumbs}
        caption={r.ref}
        title="You cannot decide this request"
        width="narrow"
        requiredRole="custodian"
      >
        <Callout variant="info">
          <p>
            {data.viewer.hasDecided
              ? "You have already recorded a decision on this request. A custodian gets one decision, and the register will not accept another."
              : data.viewer.isInitiator
                ? "You lodged this request, so you cannot also approve it. Four eyes, always — the register enforces it server-side, not just here."
                : r.state !== "PENDING_QUORUM"
                  ? `This request is ${r.state.replace(/_/g, " ").toLowerCase()} and is no longer open to decisions.`
                  : "Your token does not carry the custodian role for this community."}
          </p>
        </Callout>
        <TaskActions>
          <Link className="btn btn-primary" href={`/requests/${id}`}>
            Back to the request
          </Link>
        </TaskActions>
      </ServiceLayout>
    );
  }

  async function submit() {
    if (!choice) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await post<{ state: string; tally: Tally }>(`/api/changes/${id}/decision`, {
        decision: choice,
        reason: reason.trim() || undefined,
      });
      setOutcome(res);
      setStep(3);
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ServiceLayout
      crumbs={crumbs}
      caption={step === 3 ? r.ref : `${r.ref} · step ${step} of ${STEPS.length}`}
      title={
        step === 1
          ? "Record your decision"
          : step === 2
            ? "Check your answer"
            : outcome?.state === "APPROVED"
              ? "Decision recorded — quorum reached"
              : outcome?.state === "REJECTED"
                ? "Decision recorded — request refused"
                : "Decision recorded"
      }
      width="narrow"
      requiredRole="custodian"
    >
      {step !== 3 && <TaskSteps steps={STEPS} current={step} />}

      {problem && (
        <div className="callout danger" role="alert">
          <h2>There is a problem</h2>
          <p>{problem}</p>
        </div>
      )}

      {step === 1 && (
        <div className="stack" style={{ gap: 22 }}>
          <section className="stack-sm">
            <h2>What you are deciding</h2>
            <CheckAnswers
              rows={[
                { label: "Reference", value: <span className="mono">{r.ref}</span> },
                {
                  label: "Affected place",
                  value: (
                    <>
                      <span className="mono">{r.place.publicRef}</span> {r.place.publicName} ·{" "}
                      {r.place.country}
                    </>
                  ),
                },
                { label: "Proposal", value: r.title },
                { label: "Description of works", value: r.description },
                { label: "Lodged by", value: `${r.initiatorName} (${r.initiatorRole})` },
                { label: "Permit would be granted to", value: r.subjectName },
                { label: "Role that would emerge", value: <span className="mono">{r.grantedRole}</span> },
                {
                  label: "Notice served",
                  value: data.proofs.notice.present ? (
                    <span className="mono tiny">{data.proofs.notice.sha256?.slice(0, 32)}…</span>
                  ) : (
                    "No notice has been served"
                  ),
                },
                {
                  label: "Ministerial consent",
                  value: r.ministerConsent
                    ? `Recorded${r.ministerConsentBy ? ` by ${r.ministerConsentBy}` : ""} — not counted toward the quorum`
                    : "None recorded. None required.",
                },
              ]}
            />
          </section>

          <QuorumTally
            tally={data.tally}
            decisions={data.decisions}
            consentRule={r.community.consentRule}
            ministerConsent={r.ministerConsent}
            ministerConsentBy={r.ministerConsentBy}
            state={r.state}
          />

          <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend>
              <h2>Your decision</h2>
            </legend>
            <div className="decision-options">
              <label className={`decision-option${choice === "APPROVE" ? " selected" : ""}`}>
                <input
                  type="radio"
                  name="decision"
                  checked={choice === "APPROVE"}
                  onChange={() => setChoice("APPROVE")}
                />
                <span>
                  <strong>Approve</strong>
                  <span>
                    I consent to these works on behalf of my community. Your signature alone does
                    not carry it — {data.tally.outstanding} of {data.tally.threshold} approvals are
                    still required.
                  </span>
                </span>
              </label>
              <label className={`decision-option${choice === "DENY" ? " selected" : ""}`}>
                <input
                  type="radio"
                  name="decision"
                  checked={choice === "DENY"}
                  onChange={() => setChoice("DENY")}
                />
                <span>
                  <strong>Decline</strong>
                  <span>
                    I do not consent. If enough custodians decline that the threshold can no
                    longer be met, the request is refused and a refusal notice is issued.
                  </span>
                </span>
              </label>
            </div>

            <Field
              label="Reason (optional, recorded permanently)"
              hint="Shown on the request and in the refusal notice if one is issued."
              htmlFor="reason"
            >
              <textarea
                id="reason"
                className="input"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </fieldset>

          <TaskActions>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={!choice}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
            <Link className="btn" href={`/requests/${id}`}>
              Cancel
            </Link>
          </TaskActions>
        </div>
      )}

      {step === 2 && choice && (
        <div className="stack">
          <CheckAnswers
            caption="Nothing has been recorded yet."
            rows={[
              { label: "Request", value: <span className="mono">{r.ref}</span> },
              {
                label: "Your decision",
                value: <strong>{choice === "APPROVE" ? "Approve" : "Decline"}</strong>,
                changeTo: undefined,
                changeLabel: undefined,
              },
              { label: "Reason", value: reason.trim() || "None given" },
            ]}
          />

          <Callout variant="warn" heading="This cannot be undone">
            <p>
              Your decision is recorded as a signature against this request, with your name and a
              timestamp, in an append-only log. You will not be able to change it or take a second
              decision on this request.
            </p>
            {choice === "APPROVE" && data.tally.outstanding <= 1 && (
              <p>
                This is the approval that reaches the threshold. The request will move to{" "}
                <strong>approved</strong> and become committable.
              </p>
            )}
          </Callout>

          <TaskActions>
            <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={busy}>
              {busy
                ? "Recording…"
                : choice === "APPROVE"
                  ? "Accept and approve"
                  : "Accept and decline"}
            </button>
            <button type="button" className="btn" onClick={() => setStep(1)}>
              Back
            </button>
          </TaskActions>
        </div>
      )}

      {step === 3 && outcome && (
        <Confirmation
          heading={
            outcome.state === "APPROVED"
              ? "Recorded. The threshold is met."
              : outcome.state === "REJECTED"
                ? "Recorded. The request is refused."
                : "Your decision is recorded."
          }
          reference={r.ref}
          referenceLabel="Request"
          next={
            outcome.state === "APPROVED"
              ? [
                  <>
                    {outcome.tally.approvals} of {outcome.tally.threshold} custodians have
                    approved, so the request can now be committed by a custodian.
                  </>,
                  <>
                    Committing issues the instrument of consent. The permit role still has to
                    reach the holder&rsquo;s token before any works can be lodged.
                  </>,
                ]
              : outcome.state === "REJECTED"
                ? [
                    <>
                      Enough custodians have declined that the threshold can no longer be met, so
                      the request is refused.
                    </>,
                    <>
                      A refusal notice has been generated and its hash recorded in the{" "}
                      <Link href="/activity">activity log</Link>. No permit was created.
                    </>,
                  ]
                : [
                    <>
                      {outcome.tally.approvals} of {outcome.tally.threshold} approvals recorded.{" "}
                      {outcome.tally.outstanding} more required before the request can be
                      committed.
                    </>,
                    <>
                      Another custodian decides next, from their own session. Nothing you can do
                      here will carry it alone.
                    </>,
                  ]
          }
          notDone={
            <p>
              Your decision did not grant anything. No role has been written into any token, and
              nothing may be lodged against this place until a quorum commits and the identity
              provider issues the permit.
            </p>
          }
        >
          <TaskActions>
            <Link className="btn btn-primary" href={`/requests/${id}`}>
              View the request
            </Link>
            <button type="button" className="btn" onClick={() => router.push("/requests")}>
              Back to requests
            </button>
          </TaskActions>
        </Confirmation>
      )}
    </ServiceLayout>
  );
}
