"use client";

// Task: record a place.
//
//   Start → Public details → Protected details → Check your answers → Receipt
//
// The split between the two detail screens is the point of the task, not a layout choice:
// everything on the first screen will be readable by anyone signed in, and everything on the
// second is encrypted in this browser before it is sent. Showing them together would blur
// the one distinction a custodian most needs to be sure of.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Unlock } from "lucide-react";
import { ServiceLayout } from "@/components/ServiceLayout";
import { Field } from "@/components/Field";
import { GridMap } from "@/components/GridMap";
import { CheckAnswers, Confirmation, StartPanel, TaskActions, TaskSteps, Callout } from "@/components/TaskFlow";
import { useApi } from "@/lib/useApi";
import { useIdentity } from "@/lib/identity/client";
import type { CellId } from "@/lib/grid";

const STEPS = ["Start", "Public details", "Protected details", "Check your answers", "Receipt"];
type Step = "start" | "public" | "protected" | "check" | "done";
const ORDER: Step[] = ["start", "public", "protected", "check", "done"];

// useSearchParams drives the step, so the flow renders inside a Suspense boundary.
export default function Page() {
  return (
    <Suspense fallback={<div className="loading-screen">Loading…</div>}>
      <RecordPlaceFlow />
    </Suspense>
  );
}

function RecordPlaceFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { seal, hasRole, authFetch } = useIdentity();
  const { data } = useApi<{
    orgs: { id: string; name: string; consentRule: string; quorumThreshold: number }[];
  }>("/api/places");

  const step = (params.get("step") as Step) ?? "start";
  const stepIndex = Math.max(0, ORDER.indexOf(step)) + 1;

  const go = useCallback(
    (next: Step) => {
      router.push(next === "start" ? "/register/new" : `/register/new?step=${next}`);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [router],
  );

  // Public
  const [publicRef, setPublicRef] = useState("");
  const [publicName, setPublicName] = useState("");
  const [country, setCountry] = useState("Rock country");
  const [publicSummary, setPublicSummary] = useState(
    "A protected place is recorded here; its details are held by the community.",
  );
  const [cells, setCells] = useState<CellId[]>([]);
  const [orgId, setOrgId] = useState("");

  // Protected
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [significance, setSignificance] = useState("");
  const [restrictedKnowledge, setRestrictedKnowledge] = useState("");
  const [restrictedProtocol, setRestrictedProtocol] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ ref: string; hasRestricted: boolean } | null>(null);

  const orgs = data?.orgs ?? [];
  // The holding corporation is a choice, not a constant: the register is used by several,
  // and the one chosen here decides whose consent rule governs the place afterwards.
  const org = orgs.find((o) => o.id === orgId) ?? null;
  const canRestrict = hasRole("custodian-women");

  const publicErrors = useMemo(() => {
    const e: string[] = [];
    if (!/^[A-Za-z]{2}-\d{2,3}$/.test(publicRef.trim())) {
      e.push("Enter a public reference in the form RB-21.");
    }
    if (!publicName.trim()) e.push("Enter a public name.");
    if (!country.trim()) e.push("Enter a coarse land description.");
    if (cells.length === 0) e.push("Mark at least one generalized zone.");
    if (!orgId) e.push("Choose the corporation that holds this place.");
    return e;
  }, [publicRef, publicName, country, cells, orgId]);

  const protectedErrors = useMemo(() => {
    const e: string[] = [];
    if (!name.trim()) e.push("Enter the recorded name.");
    if (!description.trim()) e.push("Enter a description.");
    if (!significance.trim()) e.push("Enter the significance.");
    return e;
  }, [name, description, significance]);

  // Guard against someone deep-linking to a later step with nothing filled in.
  useEffect(() => {
    if ((step === "protected" || step === "check") && publicErrors.length > 0) go("public");
    if (step === "check" && protectedErrors.length > 0) go("protected");
    if (step === "done" && !receipt) go("start");
  }, [step, publicErrors.length, protectedErrors.length, receipt, go]);

  async function submit() {
    if (!org) return;
    setBusy(true);
    setError(null);
    try {
      const ref = publicRef.trim().toUpperCase();
      // Sealing happens here, in this browser, before anything leaves it.
      const body = {
        publicRef: ref,
        publicName,
        country,
        publicSummary,
        scene: "ridge",
        zoneCells: cells,
        custodianOrgId: org.id,
        sealedName: await seal("custodian-records", name),
        sealedBoundary: await seal("custodian-records", boundaryFromCells(cells)),
        sealedSignificance: await seal("custodian-records", {
          significance,
          description,
          recordedBy: "custodian",
          recordedOn: new Date().toISOString().slice(0, 10),
        }),
        sealedRestricted:
          canRestrict && restrictedKnowledge.trim()
            ? await seal("restricted-women", {
                audience: "women",
                knowledge: restrictedKnowledge,
                protocol: restrictedProtocol,
              })
            : null,
      };
      const res = await authFetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const failure = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
        throw new Error(failure?.error?.message ?? "Could not record the place.");
      }
      setReceipt({ ref, hasRestricted: Boolean(body.sealedRestricted) });
      go("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the place.");
    } finally {
      setBusy(false);
    }
  }

  const crumbs = [
    { label: "Home", href: "/home" },
    { label: "Register", href: "/register" },
    { label: "Record a place" },
  ];

  return (
    <ServiceLayout
      requiredRole="custodian"
      width="narrow"
      crumbs={crumbs}
      caption={step === "done" ? undefined : `Step ${stepIndex} of ${STEPS.length}`}
      title={
        step === "start"
          ? "Record a place"
          : step === "public"
            ? "Public details"
            : step === "protected"
              ? "Protected details"
              : step === "check"
                ? "Check your answers"
                : "Place recorded"
      }
      lede={
        step === "public"
          ? "Anyone signed in to this register will be able to read what you enter on this screen."
          : step === "protected"
            ? "What you enter here is encrypted in this browser. The server stores the result and cannot read it back."
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
                Use this task to add a place to the register. You will enter two kinds of
                information, on separate screens, because they are treated completely differently.
              </p>
              <p>
                The <strong>public details</strong> — a reference, a coarse land description and
                generalized zones — are readable by anyone signed in, including proponents. The{" "}
                <strong>protected details</strong> — the recorded name, the boundary and the
                significance — are encrypted in your browser before they are sent.
              </p>
            </>
          }
          need={[
            "Which Traditional Owner corporation holds the place. Its consent rule will govern every later decision about it.",
            "A public reference that is not already in use, in the form RB-21.",
            "The zones the place sits within. Whole cells only — the register never stores coordinates.",
            "The recorded name, a description and a statement of significance.",
            canRestrict
              ? "If a restricted cultural layer applies, the knowledge and the protocol for it."
              : "A restricted cultural layer cannot be added with your current standing.",
          ]}
          before={
            <>
              <h2>What this register will not do</h2>
              <p>
                It will not store a coordinate, and it will not hold a key that opens what you
                seal. If the protected details need to be read later, the network has to agree to
                take part — and it will only do that for a custodian.
              </p>
            </>
          }
        >
          {orgs.length === 0 && (
            <Callout variant="danger" heading="No corporation is configured">
              <p>The register has not been seeded. Run the seed step from the README.</p>
            </Callout>
          )}
          <TaskActions>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={orgs.length === 0}
              onClick={() => go("public")}
            >
              Start now
            </button>
            <Link className="btn" href="/register">
              Cancel
            </Link>
          </TaskActions>
        </StartPanel>
      )}

      {step === "public" && (
        <form
          className="stack"
          style={{ gap: 22 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (publicErrors.length === 0) go("protected");
          }}
        >
          <span className="lock-chip open">
            <Unlock size={13} strokeWidth={1.7} /> readable by anyone signed in
          </span>

          <Field label="Public reference" hint="For example RB-21. Shown to proponents." htmlFor="ref">
            <input
              id="ref"
              className="input mono input-narrow"
              value={publicRef}
              onChange={(e) => setPublicRef(e.target.value)}
              placeholder="RB-21"
            />
          </Field>

          <Field
            label="Public name"
            hint="A name that gives nothing away. Not the place's recorded name."
            htmlFor="pname"
          >
            <input
              id="pname"
              className="input input-medium"
              value={publicName}
              onChange={(e) => setPublicName(e.target.value)}
            />
          </Field>

          <Field label="Country" hint="A coarse land description, such as Rock country." htmlFor="country">
            <input
              id="country"
              className="input input-medium"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </Field>

          <Field label="Public summary" hint="What a proponent will be told, and no more." htmlFor="summary">
            <textarea
              id="summary"
              className="input"
              rows={3}
              value={publicSummary}
              onChange={(e) => setPublicSummary(e.target.value)}
            />
          </Field>

          <Field
            label="Held by"
            hint="The corporation whose custodians will decide every disclosure and every permit for this place."
            htmlFor="org"
          >
            <select id="org" className="input" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Choose a corporation</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — {o.consentRule}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Generalized zones"
            hint="Whole cells only. A zone is not a location, and this is the only spatial information the register keeps."
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

          {publicErrors.length > 0 && (
            <div className="callout danger">
              <h2>Before you continue</h2>
              <ul>
                {publicErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <TaskActions>
            <button type="submit" className="btn btn-primary btn-lg" disabled={publicErrors.length > 0}>
              Continue
            </button>
            <button type="button" className="btn" onClick={() => go("start")}>
              Back
            </button>
          </TaskActions>
        </form>
      )}

      {step === "protected" && (
        <form
          className="stack"
          style={{ gap: 22 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (protectedErrors.length === 0) go("check");
          }}
        >
          <span className="lock-chip">
            <Lock size={13} strokeWidth={1.7} /> encrypted in this browser before sending
          </span>

          <Field label="Recorded name" htmlFor="name">
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="Description" htmlFor="desc">
            <textarea
              id="desc"
              className="input"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field label="Significance" htmlFor="sig">
            <textarea
              id="sig"
              className="input"
              rows={3}
              value={significance}
              onChange={(e) => setSignificance(e.target.value)}
            />
          </Field>

          {canRestrict ? (
            <>
              <h2>Restricted cultural layer (optional)</h2>
              <p className="small muted">
                Sealed under a second policy, so that custodians who can open the record above
                still cannot read this. Leave blank if it does not apply.
              </p>
              <Field label="Knowledge" htmlFor="rk">
                <textarea
                  id="rk"
                  className="input"
                  rows={3}
                  value={restrictedKnowledge}
                  onChange={(e) => setRestrictedKnowledge(e.target.value)}
                />
              </Field>
              <Field label="Protocol" hint="Who it may be shown to, and how." htmlFor="rp">
                <input
                  id="rp"
                  className="input"
                  value={restrictedProtocol}
                  onChange={(e) => setRestrictedProtocol(e.target.value)}
                />
              </Field>
            </>
          ) : (
            <Callout variant="info" heading="Restricted cultural layer">
              <p>
                Your token does not carry <code>custodian-women</code>, so this register will not
                accept a restricted layer from you — and the network would not seal one for you
                either. That standing is itself quorum-granted.
              </p>
            </Callout>
          )}

          {protectedErrors.length > 0 && (
            <div className="callout danger">
              <h2>Before you continue</h2>
              <ul>
                {protectedErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <TaskActions>
            <button type="submit" className="btn btn-primary btn-lg" disabled={protectedErrors.length > 0}>
              Continue
            </button>
            <button type="button" className="btn" onClick={() => go("public")}>
              Back
            </button>
          </TaskActions>
        </form>
      )}

      {step === "check" && (
        <div className="stack">
          <CheckAnswers
            caption="Nothing has been sent yet. The protected details are encrypted at the moment you confirm."
            rows={[
              { label: "Public reference", value: <span className="mono">{publicRef.toUpperCase()}</span>, changeTo: "/register/new?step=public" },
              { label: "Public name", value: publicName, changeTo: "/register/new?step=public" },
              { label: "Country", value: country, changeTo: "/register/new?step=public" },
              { label: "Public summary", value: publicSummary, changeTo: "/register/new?step=public" },
              { label: "Generalized zones", value: <span className="mono">{cells.join(" ")}</span>, changeTo: "/register/new?step=public" },
              { label: "Recorded name", value: <em>will be encrypted — {name.length} characters</em>, changeTo: "/register/new?step=protected" },
              { label: "Description", value: <em>will be encrypted — {description.length} characters</em>, changeTo: "/register/new?step=protected" },
              { label: "Significance", value: <em>will be encrypted — {significance.length} characters</em>, changeTo: "/register/new?step=protected" },
              {
                label: "Restricted layer",
                value: restrictedKnowledge.trim()
                  ? <em>will be encrypted under restricted-women</em>
                  : "None",
                changeTo: "/register/new?step=protected",
              },
              { label: "Held by", value: org?.name ?? "—" },
              { label: "Consent rule", value: org?.consentRule ?? "—" },
            ]}
          />

          <Callout variant="warn" heading="Confirm you are recording this">
            <p>
              The protected details are shown back as lengths, not as text, so that a shoulder
              beside you at this moment does not read them off the screen. Go back a step if you
              need to check the wording.
            </p>
          </Callout>

          <TaskActions>
            <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={busy}>
              {busy ? "Encrypting and recording…" : "Accept and record this place"}
            </button>
            <button type="button" className="btn" onClick={() => go("protected")}>
              Back
            </button>
          </TaskActions>
        </div>
      )}

      {step === "done" && receipt && (
        <Confirmation
          heading="Place recorded"
          reference={receipt.ref}
          referenceLabel="Public reference"
          next={[
            <>
              The public details are now visible to anyone signed in, at{" "}
              <Link href={`/register/${receipt.ref}`}>{receipt.ref}</Link>.
            </>,
            <>
              The protected details are stored as ciphertext. Opening them asks the network to
              take part, and it will only do that for a token carrying <code>custodian</code>.
            </>,
            receipt.hasRestricted ? (
              <>
                The restricted layer is sealed under a second policy and needs the{" "}
                <code>custodian-women</code> standing to open.
              </>
            ) : (
              <>No restricted layer was recorded for this place.</>
            ),
            <>
              The recording has been written to the <Link href="/activity">activity log</Link>,
              including the ciphertext lengths but not the content.
            </>,
          ]}
          notDone={
            <p>
              Recording a place does not protect it from works. If works are later proposed here,
              a notice will be served on your community and its custodians will have to decide
              under their own consent rule.
            </p>
          }
        >
          <TaskActions>
            <Link className="btn btn-primary" href={`/register/${receipt.ref}`}>
              View the place
            </Link>
            <Link className="btn" href="/register">
              Back to the register
            </Link>
          </TaskActions>
        </Confirmation>
      )}
    </ServiceLayout>
  );
}

/** A coarse polygon around the selected cells, so the sealed record carries a boundary shape. */
function boundaryFromCells(cells: CellId[]): [number, number][] {
  if (cells.length === 0) return [];
  const cols = cells.map((c) => c.charCodeAt(0) - 65);
  const rows = cells.map((c) => Number(c.slice(1)) - 1);
  const x0 = Math.min(...cols) + 0.3;
  const x1 = Math.max(...cols) + 0.7;
  const y0 = Math.min(...rows) + 0.3;
  const y1 = Math.max(...rows) + 0.7;
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}
