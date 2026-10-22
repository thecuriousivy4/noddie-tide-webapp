"use client";

// Task: lodge a works notice.
//
//   Start → Affected place → Notice details → Check your answers → Confirmation
//
// The "affected place" step is a clearance check, not a browse: the proponent selects the
// zones their project touches and the register answers with a reference, a land description
// and a contact. They never see, and never need, the protected details of the place they are
// proposing to disturb.
//
// Submitting does three things in one server step, in this order: open the request, generate
// the formal PDF notice, and record its SHA-256 in the activity log. The hash is therefore
// fixed before any custodian has seen the request.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { ServiceLayout } from "@/components/ServiceLayout";
import { Field } from "@/components/Field";
import { GridMap } from "@/components/GridMap";
import {
  Callout,
  CheckAnswers,
  Confirmation,
  StartPanel,
  TaskActions,
  TaskSteps,
} from "@/components/TaskFlow";
import { usePost, useOpenPdf, ApiError } from "@/lib/useApi";
import { useIdentity } from "@/lib/identity/client";
import type { CellId } from "@/lib/grid";

const STEPS = ["Start", "Affected place", "Notice details", "Check your answers", "Confirmation"];
type Step = "start" | "place" | "details" | "check" | "done";
const ORDER: Step[] = ["start", "place", "details", "check", "done"];

interface Hit {
  publicRef: string;
  publicName: string;
  country: string;
  status: string;
  overlap: string[];
  hasRestricted: boolean;
  custodianOrg: { name: string; contact: string; consentRule: string };
}

// useSearchParams drives the step, so the flow renders inside a Suspense boundary.
export default function Page() {
  return (
    <Suspense fallback={<div className="loading-screen">Loading…</div>}>
      <WorksNoticeFlow />
    </Suspense>
  );
}

function WorksNoticeFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const post = usePost();
  const openPdf = useOpenPdf();
  const { user, hasRole } = useIdentity();

  const step = (params.get("step") as Step) ?? "start";
  const stepIndex = Math.max(0, ORDER.indexOf(step)) + 1;

  const go = useCallback(
    (next: Step) => {
      router.push(next === "start" ? "/requests/new" : `/requests/new?step=${next}`);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [router],
  );

  const [cells, setCells] = useState<CellId[]>([]);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [chosen, setChosen] = useState<Hit | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    id: string;
    ref: string;
    sha256: string;
    documentId: string | null;
    community: string;
    consentRule: string;
    threshold: number;
    custodianCount: number;
  } | null>(null);

  const isMinister = hasRole("minister");

  const detailErrors = useMemo(() => {
    const e: string[] = [];
    if (title.trim().length < 6) e.push("Give the proposal a title of at least six characters.");
    if (description.trim().length < 20) {
      e.push("Describe the works in at least twenty characters, in plain terms.");
    }
    return e;
  }, [title, description]);

  useEffect(() => {
    if ((step === "details" || step === "check") && !chosen) go("place");
    if (step === "check" && detailErrors.length > 0) go("details");
    if (step === "done" && !receipt) go("start");
  }, [step, chosen, detailErrors.length, receipt, go]);

  async function runCheck() {
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ hits: Hit[] }>("/api/clearance", { cells });
      setHits(res.hits);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const created = await post<{
        id: string;
        ref: string;
        community: {
          name: string;
          consentRule: string;
          quorumThreshold: number;
          custodianCount: number;
        };
      }>("/api/changes", {
        placeId: chosen.publicRef,
        type: "WORKS_PERMIT",
        title,
        description,
      });
      // Serving the notice is what opens the request to the quorum, so it happens here
      // rather than being left as a second thing to remember.
      const notice = await post<{ sha256: string; documentId: string | null }>(
        `/api/changes/${created.id}/notice`,
      );
      setReceipt({
        id: created.id,
        ref: created.ref,
        sha256: notice.sha256,
        documentId: notice.documentId,
        community: created.community.name,
        consentRule: created.community.consentRule,
        threshold: created.community.quorumThreshold,
        custodianCount: created.community.custodianCount,
      });
      go("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ServiceLayout
      width="narrow"
      crumbs={[
        { label: "Home", href: "/home" },
        { label: "Requests", href: "/requests" },
        { label: "Lodge a works notice" },
      ]}
      caption={step === "done" ? undefined : `Step ${stepIndex} of ${STEPS.length}`}
      title={
        step === "start"
          ? "Lodge a works notice"
          : step === "place"
            ? "Which place do the works affect?"
            : step === "details"
              ? "Notice details"
              : step === "check"
                ? "Check your answers"
                : "Notice served"
      }
      lede={
        step === "place"
          ? "Select the zones your project touches. The register will tell you whether anything is recorded there, and nothing more."
          : undefined
      }
    >
      {step !== "done" && <TaskSteps steps={STEPS} current={stepIndex} />}

      {error && (
        <div className="callout danger" role="alert">
          <h2>There is a problem</h2>
          <p>{error}</p>
        </div>
      )}

      {step === "start" && (
        <StartPanel
          what={
            <>
              <p>
                Use this task to propose works affecting a place on the register. Lodging it
                serves a formal notice on the place&rsquo;s Traditional Owner Corporation and
                routes the request to that community&rsquo;s custodian quorum.
              </p>
              <p>
                You will not see the place&rsquo;s recorded name, boundary or significance at any
                point in this task, and neither will this register&rsquo;s operator.
              </p>
            </>
          }
          need={[
            "The generalized zones your project touches.",
            "A plain description of the works — what, where in the basin, and how extensive.",
            isMinister
              ? "Note: lodging as a Minister produces a ministerial announcement rather than a proponent notice. It carries no more weight."
              : "Nothing else. There is no fee and no supporting documentation at this stage.",
          ]}
          before={
            <>
              <h2>What lodging this does not do</h2>
              <p>
                It does not authorise any works. It does not create a permit. It cannot be
                approved by you, by a Minister, or by an administrator — only the custodians of
                the affected community can carry it, under that community&rsquo;s own consent
                rule, each deciding from their own session.
              </p>
            </>
          }
        >
          <TaskActions>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => go("place")}>
              Start now
            </button>
            <Link className="btn" href="/requests">
              Cancel
            </Link>
          </TaskActions>
        </StartPanel>
      )}

      {step === "place" && (
        <div className="stack" style={{ gap: 22 }}>
          <Field
            label="Zones your project touches"
            hint="Whole cells only. Positions in this register are indicative — a zone is not a location."
          >
            <GridMap
              mode="select"
              selected={cells}
              onToggle={(c) =>
                setCells((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))
              }
            />
            <span className="tiny muted mono">{cells.join(" ") || "none selected"}</span>
          </Field>

          <div className="row" style={{ gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={runCheck}
              disabled={busy || cells.length === 0}
            >
              <Search size={14} strokeWidth={1.9} />
              {busy ? "Checking…" : "Check these zones"}
            </button>
            <span className="tiny muted">
              Every check is written to the activity log, including the zones asked about.
            </span>
          </div>

          {hits !== null && hits.length === 0 && (
            <Callout variant="warn" heading="Nothing is recorded in those zones">
              <p>
                This is not a clearance to proceed. A place can be unrecorded and still be
                significant — absence of a record is not absence of Country. If your project area
                is wrong, change the zones and check again.
              </p>
            </Callout>
          )}

          {hits !== null && hits.length > 0 && (
            <div className="stack-sm">
              <h2>Recorded places in those zones</h2>
              <div className="decision-options">
                {hits.map((h) => (
                  <label
                    key={h.publicRef}
                    className={`decision-option${chosen?.publicRef === h.publicRef ? " selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="place"
                      checked={chosen?.publicRef === h.publicRef}
                      onChange={() => {
                        setChosen(h);
                        setTitle(`Works affecting ${h.publicRef}`);
                      }}
                    />
                    <span style={{ flex: 1 }}>
                      <strong>
                        <span className="mono">{h.publicRef}</span> {h.publicName}
                      </strong>
                      <span>
                        {h.country} · overlaps {h.overlap.join(" ")} · held by{" "}
                        {h.custodianOrg.name} · {h.custodianOrg.consentRule}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="tiny muted">
                The recorded name, boundary and significance of these places are sealed. You
                cannot read them, and nor can this register&rsquo;s operator.
              </p>
            </div>
          )}

          <TaskActions>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={!chosen}
              onClick={() => go("details")}
            >
              Continue
            </button>
            <button type="button" className="btn" onClick={() => go("start")}>
              Back
            </button>
          </TaskActions>
        </div>
      )}

      {step === "details" && chosen && (
        <form
          className="stack"
          style={{ gap: 22 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (detailErrors.length === 0) go("check");
          }}
        >
          <Callout variant="info">
            <p>
              Notice will be served on <strong>{chosen.custodianOrg.name}</strong> in respect of{" "}
              <span className="mono">{chosen.publicRef}</span>. Consent rule:{" "}
              {chosen.custodianOrg.consentRule}.
            </p>
          </Callout>

          <Field label="Proposal" hint="One line, as it will appear in the notice." htmlFor="title">
            <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <Field
            label="Description of works"
            hint="What is proposed, in plain terms. This is what the custodians will read."
            htmlFor="desc"
          >
            <textarea
              id="desc"
              className="input"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="For example: a 1.8 km haul-road corridor crossing the northern zones, with culvert works at the watercourse."
            />
          </Field>

          {detailErrors.length > 0 && (
            <div className="callout danger">
              <h2>Before you continue</h2>
              <ul>
                {detailErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <TaskActions>
            <button type="submit" className="btn btn-primary btn-lg" disabled={detailErrors.length > 0}>
              Continue
            </button>
            <button type="button" className="btn" onClick={() => go("place")}>
              Back
            </button>
          </TaskActions>
        </form>
      )}

      {step === "check" && chosen && (
        <div className="stack">
          <CheckAnswers
            caption="Nothing has been served yet. Submitting generates the notice and opens the request to the quorum."
            rows={[
              { label: "Affected place", value: <><span className="mono">{chosen.publicRef}</span> {chosen.publicName}</>, changeTo: "/requests/new?step=place" },
              { label: "Zones checked", value: <span className="mono">{cells.join(" ")}</span>, changeTo: "/requests/new?step=place" },
              { label: "Proposal", value: title, changeTo: "/requests/new?step=details" },
              { label: "Description of works", value: description, changeTo: "/requests/new?step=details" },
              { label: "Lodged by", value: `${user?.name ?? ""} (${isMinister ? "minister" : "proponent"})` },
              { label: "Served on", value: `${chosen.custodianOrg.name} · ${chosen.custodianOrg.contact}` },
              { label: "Consent rule", value: chosen.custodianOrg.consentRule },
              { label: "Permit sought for", value: user?.name ?? "" },
            ]}
          />

          <Callout variant="warn" heading="What happens when you submit">
            <p>
              A formal {isMinister ? "ministerial announcement" : "notice of proposed works"} is
              generated as a PDF, its SHA-256 is written to the activity log, and the request
              moves to <strong>pending quorum</strong>. The notice cannot be withdrawn from the
              log afterwards — that is what makes it proof of service.
            </p>
          </Callout>

          <TaskActions>
            <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={busy}>
              {busy ? "Serving the notice…" : "Accept and serve the notice"}
            </button>
            <button type="button" className="btn" onClick={() => go("details")}>
              Back
            </button>
          </TaskActions>
        </div>
      )}

      {step === "done" && receipt && (
        <Confirmation
          heading="Notice served and request opened"
          reference={receipt.ref}
          next={[
            <>
              The notice has been served on <strong>{receipt.community}</strong> and the request
              is now open to their custodian quorum.
            </>,
            <>
              That community&rsquo;s own rule applies: {receipt.consentRule}. {receipt.threshold}{" "}
              of its {receipt.custodianCount} custodians must each approve it, from their own
              sessions. You cannot approve it, and neither can a Minister or an administrator.
            </>,
            <>
              If the quorum carries it, a custodian commits the request and an instrument of
              consent is issued. The permit role then has to be issued into your token before any
              works may be lodged — your old token will not carry it.
            </>,
            <>
              Follow progress at <Link href={`/requests/${receipt.id}`}>{receipt.ref}</Link>.
            </>,
          ]}
          notDone={
            <p>
              This did not create a permit and does not authorise any works. Attempting to lodge
              works now will be refused, because your token carries no permit role for this place.
            </p>
          }
        >
          <section className="stack-sm">
            <h2>Proof of notice served</h2>
            <p className="small muted">
              The SHA-256 below was written to the activity log at the moment the notice was
              generated — before any custodian saw the request.
            </p>
            <p className="mono" style={{ wordBreak: "break-all", fontSize: 12.5 }}>
              {receipt.sha256}
            </p>
            {receipt.documentId && (
              <button
                type="button"
                className="btn btn-sm"
                style={{ alignSelf: "flex-start" }}
                onClick={() => openPdf(`/api/changes/${receipt.id}/documents/${receipt.documentId}`)}
              >
                <FileText size={14} strokeWidth={1.8} /> Download the notice (PDF)
              </button>
            )}
          </section>

          <TaskActions>
            <Link className="btn btn-primary" href={`/requests/${receipt.id}`}>
              View the request
            </Link>
            <Link className="btn" href="/requests">
              Back to requests
            </Link>
          </TaskActions>
        </Confirmation>
      )}
    </ServiceLayout>
  );
}
