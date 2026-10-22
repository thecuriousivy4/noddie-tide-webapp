"use client";

// Place detail. The public columns render immediately; the protected ones stay sealed on the
// screen until the viewer asks, and then open only if the network will take part. A refusal
// is shown as the network's refusal, because that is what it is.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { use } from "react";
import { EyeOff, Lock, LockOpen, ShieldAlert } from "lucide-react";
import { ServiceLayout } from "@/components/ServiceLayout";
import { PlaceStatusBadge, ChangeStateBadge, changeTypeLabel } from "@/components/StateBadge";
import { CipherText } from "@/components/CipherText";
import { GridMap } from "@/components/GridMap";
import { EmptyState } from "@/components/EmptyState";
import { useApi } from "@/lib/useApi";
import { useIdentity, PolicyRefusedError } from "@/lib/identity/client";

const BasinMap = dynamic(() => import("@/components/BasinMap").then((m) => m.BasinMap), {
  ssr: false,
  loading: () => <div className="basin-wrap loading" style={{ height: 420 }} />,
});

interface PlaceResponse {
  place: {
    id: string;
    publicRef: string;
    publicName: string;
    country: string;
    publicSummary: string;
    status: string;
    zoneCells: string[];
    hasRestricted: boolean;
    recordedByName: string;
    createdAt: string;
    custodianOrg: { name: string; contact: string; consentRule: string };
    sealed: { name: string; boundary: string; significance: string; restricted: string | null };
  };
  requests: {
    id: string;
    ref: string;
    type: string;
    state: string;
    title: string;
    subjectName: string;
    approvals: number;
    threshold: number;
  }[];
}

interface OpenedRecord {
  name: string;
  boundary: [number, number][];
  significance: { significance: string; description: string; recordedBy: string; recordedOn: string };
}

export default function PlacePage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = use(params);
  const { data, loading, error } = useApi<PlaceResponse>(`/api/places/${ref}`);
  const { open, hasRole } = useIdentity();

  const [record, setRecord] = useState<OpenedRecord | null>(null);
  const [restricted, setRestricted] = useState<{ knowledge: string; protocol: string } | null>(null);
  const [opening, setOpening] = useState<"record" | "restricted" | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const place = data?.place;

  const zones = useMemo(
    () =>
      place
        ? [
            {
              id: place.id,
              publicRef: place.publicRef,
              publicName: place.publicName,
              cells: place.zoneCells,
              status: place.status,
            },
          ]
        : [],
    [place],
  );

  async function openRecord() {
    if (!place) return;
    setOpening("record");
    setRefusal(null);
    try {
      const [name, boundary, significance] = await Promise.all([
        open<string>(place.sealed.name, "custodian-records"),
        open<[number, number][]>(place.sealed.boundary, "custodian-records"),
        open<OpenedRecord["significance"]>(place.sealed.significance, "custodian-records"),
      ]);
      setRecord({ name, boundary, significance });
    } catch (err) {
      setRefusal(
        err instanceof PolicyRefusedError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not open this record.",
      );
    } finally {
      setOpening(null);
    }
  }

  async function openRestricted() {
    if (!place?.sealed.restricted) return;
    setOpening("restricted");
    setRefusal(null);
    try {
      setRestricted(await open(place.sealed.restricted, "restricted-women"));
    } catch (err) {
      setRefusal(
        err instanceof PolicyRefusedError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not open the restricted layer.",
      );
    } finally {
      setOpening(null);
    }
  }

  if (loading) {
    return (
      <ServiceLayout
        crumbs={[{ label: "Home", href: "/home" }, { label: "Register", href: "/register" }, { label: ref }]}
        title="Place"
      >
        <div className="muted">Reading the register…</div>
      </ServiceLayout>
    );
  }
  if (error || !place) {
    return (
      <ServiceLayout
        crumbs={[{ label: "Home", href: "/home" }, { label: "Register", href: "/register" }, { label: ref }]}
        title="Place not found"
      >
        <div className="callout danger">
          <p>{error?.message ?? `${ref} is not on the register.`}</p>
        </div>
      </ServiceLayout>
    );
  }

  return (
    <ServiceLayout
      crumbs={[
        { label: "Home", href: "/home" },
        { label: "Register", href: "/register" },
        { label: place.publicRef },
      ]}
      caption={place.publicRef}
      title={place.publicName}
      lede={place.publicSummary}
    >
      <div className="stack" style={{ gap: 24 }}>
        <div className="spread">
          <div className="row-wrap" style={{ gap: 10 }}>
            <PlaceStatusBadge status={place.status} />
            <span className="small muted">Held by {place.custodianOrg.name}</span>
            <span className="small muted">· {place.custodianOrg.consentRule}</span>
          </div>
          <Link className="btn btn-sm" href="/register">
            Back to the register
          </Link>
        </div>

        <section className="stack-sm">
          <BasinMap zones={zones} selected={place.id} height={400} />
          <div className="map-meta">
            <span className="key">Generalized zones: <span className="mono">{place.zoneCells.join(" ")}</span></span>
            <span className="key">No coordinates are stored for any place.</span>
          </div>
        </section>

        <div className="two-col">
          <section className="panel">
            <div className="panel-head">
              <strong style={{ fontWeight: 600, fontSize: 14 }}>The record</strong>
              {record ? (
                <span className="lock-chip open">
                  <LockOpen size={13} strokeWidth={1.6} /> open in this browser
                </span>
              ) : (
                <span className="lock-chip">
                  <Lock size={13} strokeWidth={1.6} /> sealed
                </span>
              )}
            </div>
            <div className="panel-body stack-sm">
              {!record && (
                <>
                  <p className="small muted">
                    These fields are ciphertext in the database. Opening them asks the network to
                    take part, and it will only do that for a token carrying{" "}
                    <code>custodian</code>.
                  </p>
                  <dl className="sealed-list">
                    <div>
                      <dt>Recorded name</dt>
                      <dd>
                        <CipherText value={place.sealed.name} />
                      </dd>
                    </div>
                    <div>
                      <dt>Boundary</dt>
                      <dd>
                        <CipherText value={place.sealed.boundary} />
                      </dd>
                    </div>
                    <div>
                      <dt>Significance</dt>
                      <dd>
                        <CipherText value={place.sealed.significance} />
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={openRecord}
                    disabled={opening !== null}
                  >
                    {opening === "record" ? "Asking the network…" : "Open the record"}
                  </button>
                </>
              )}

              {record && (
                <dl className="sealed-list open">
                  <div>
                    <dt>Recorded name</dt>
                    <dd>{record.name}</dd>
                  </div>
                  <div>
                    <dt>Description</dt>
                    <dd>{record.significance.description}</dd>
                  </div>
                  <div>
                    <dt>Significance</dt>
                    <dd>{record.significance.significance}</dd>
                  </div>
                  <div>
                    <dt>Boundary</dt>
                    <dd className="mono tiny">
                      {record.boundary.map(([x, y]) => `(${x}, ${y})`).join("  ")}
                    </dd>
                  </div>
                  <div>
                    <dt>Recorded by</dt>
                    <dd>
                      {record.significance.recordedBy} · {record.significance.recordedOn}
                    </dd>
                  </div>
                </dl>
              )}

              {record && (
                <div className="stack-sm">
                  <span className="tiny muted">Boundary, drawn from the opened record:</span>
                  <GridMap mode="boundary" polygon={record.boundary} zones={place.zoneCells} />
                </div>
              )}
            </div>
          </section>

          <div className="stack">
            {place.hasRestricted && (
              <section className="panel">
                <div className="panel-head">
                  <strong style={{ fontWeight: 600, fontSize: 14 }}>Restricted cultural layer</strong>
                  <span className="lock-chip">
                    <EyeOff size={13} strokeWidth={1.6} /> separate standing
                  </span>
                </div>
                <div className="panel-body stack-sm">
                  {restricted ? (
                    <dl className="sealed-list open">
                      <div>
                        <dt>Knowledge</dt>
                        <dd>{restricted.knowledge}</dd>
                      </div>
                      <div>
                        <dt>Protocol</dt>
                        <dd>{restricted.protocol}</dd>
                      </div>
                    </dl>
                  ) : (
                    <>
                      <p className="small muted">
                        Held under a second policy. A custodian role is not enough: this needs the{" "}
                        <code>custodian-women</code> standing, which is itself quorum-granted.
                        {!hasRole("custodian-women") && " Your token does not carry it."}
                      </p>
                      <CipherText value={place.sealed.restricted} />
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={openRestricted}
                        disabled={opening !== null}
                      >
                        {opening === "restricted" ? "Asking the network…" : "Try to open it"}
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}

            {refusal && (
              <div className="callout danger" role="alert">
                <h2>
                  <ShieldAlert size={15} strokeWidth={1.8} style={{ verticalAlign: "-2px" }} /> The
                  network declined
                </h2>
                <p>{refusal}</p>
              </div>
            )}

            <section className="panel">
              <div className="panel-head">
                <strong style={{ fontWeight: 600, fontSize: 14 }}>Change requests</strong>
                <span className="tiny muted">{data.requests.length} recorded</span>
              </div>
              <div className="panel-body">
                {data.requests.length === 0 ? (
                  <EmptyState title="Nothing has been proposed for this place." />
                ) : (
                  <ul className="request-list">
                    {data.requests.map((r) => (
                      <li key={r.id}>
                        <Link href={`/requests/${r.id}`} className="mono">
                          {r.ref}
                        </Link>
                        <span className="grow">
                          {changeTypeLabel(r.type)} — {r.title}
                          <span className="tiny muted"> · for {r.subjectName}</span>
                        </span>
                        <span className="mono tiny">
                          {r.approvals}/{r.threshold}
                        </span>
                        <ChangeStateBadge state={r.state} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <strong style={{ fontWeight: 600, fontSize: 14 }}>Contact</strong>
              </div>
              <div className="panel-body small">
                <p>
                  {place.custodianOrg.name}
                  <br />
                  <span className="mono">{place.custodianOrg.contact}</span>
                </p>
                <p className="tiny muted" style={{ marginTop: 10 }}>
                  Recorded by {place.recordedByName} on{" "}
                  {new Date(place.createdAt).toLocaleDateString("en-AU", { dateStyle: "medium" })}.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </ServiceLayout>
  );
}
