"use client";

// Browse the register. A records table over the public columns — nothing on this screen is
// protected information, and opening a place means going to its own page.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { ServiceLayout } from "@/components/ServiceLayout";
import { DataTable, type Column } from "@/components/DataTable";
import { PlaceStatusBadge } from "@/components/StateBadge";
import { EmptyState } from "@/components/EmptyState";
import { Callout } from "@/components/TaskFlow";
import { useApi } from "@/lib/useApi";
import { useIdentity } from "@/lib/identity/client";
import { SEED_SITES } from "@/lib/fixtures";

interface PlaceRow {
  id: string;
  publicRef: string;
  publicName: string;
  country: string;
  publicSummary: string;
  status: string;
  zoneCells: string[];
  hasRestricted: boolean;
  openRequests: number;
  recordedByName: string;
  createdAt: string;
  custodianOrg: { id: string; name: string };
}

export default function RegisterPage() {
  const router = useRouter();
  const { seal, authFetch, hasRole } = useIdentity();
  const { data, loading, reload } = useApi<{
    places: PlaceRow[];
    orgs: { id: string; name: string }[];
  }>("/api/places");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const places = data?.places ?? [];
  const orgs = data?.orgs ?? [];
  const isCustodian = hasRole("custodian");

  /**
   * Seeding helper. Protected fields can only be sealed in a browser, so the sample places
   * cannot come from a server-side seed script when the keys belong to the network. This
   * runs the same code path "Record a place" uses.
   */
  async function loadSamples() {
    if (orgs.length === 0) return;
    setWorking(true);
    setMessage(null);
    let added = 0;
    let skipped = 0;
    try {
      for (const s of SEED_SITES) {
        if (places.some((p) => p.publicRef === s.id)) continue;
        if (s.restricted && !hasRole("custodian-women")) {
          skipped++;
          continue;
        }
        const res = await authFetch("/api/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicRef: s.id,
            publicName: s.publicName,
            country: s.landType,
            publicSummary: s.publicSummary,
            scene: s.scene,
            zoneCells: s.zoneCells,
            custodianOrgId: s.orgId,
            sealedName: await seal("custodian-records", s.details.name),
            sealedBoundary: await seal("custodian-records", s.details.boundary),
            sealedSignificance: await seal("custodian-records", {
              significance: s.details.significance,
              description: s.details.description,
              recordedBy: s.details.recordedBy,
              recordedOn: s.details.recordedOn,
            }),
            sealedRestricted: s.restricted ? await seal("restricted-women", s.restricted) : null,
          }),
        });
        if (res.ok) added++;
      }
      setMessage(
        `Sealed and recorded ${added} place(s) from this browser.` +
          (skipped
            ? ` ${skipped} skipped: they carry a restricted layer, which needs the custodian-women standing.`
            : ""),
      );
      reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not seal the samples.");
    } finally {
      setWorking(false);
    }
  }

  const columns: Column<PlaceRow>[] = [
    {
      key: "ref",
      header: "Reference",
      width: "120px",
      sort: (r) => r.publicRef,
      cell: (r) => (
        <Link className="mono" href={`/register/${r.publicRef}`}>
          {r.publicRef}
        </Link>
      ),
    },
    { key: "name", header: "Public name", sort: (r) => r.publicName, cell: (r) => r.publicName },
    { key: "country", header: "Country", sort: (r) => r.country, cell: (r) => r.country },
    {
      key: "org",
      header: "Held by",
      sort: (r) => r.custodianOrg.name,
      cell: (r) => r.custodianOrg.name,
    },
    {
      key: "zones",
      header: "Zones",
      secondary: true,
      cell: (r) => <span className="mono tiny">{r.zoneCells.join(" ")}</span>,
    },
    {
      key: "layers",
      header: "Layers",
      secondary: true,
      sort: (r) => (r.hasRestricted ? 1 : 0),
      cell: (r) => (r.hasRestricted ? "Record + restricted" : "Record"),
    },
    {
      key: "open",
      header: "Open requests",
      align: "right",
      width: "130px",
      sort: (r) => r.openRequests,
      cell: (r) => r.openRequests || "—",
    },
    {
      key: "status",
      header: "Status",
      width: "150px",
      sort: (r) => r.status,
      cell: (r) => <PlaceStatusBadge status={r.status} />,
    },
  ];

  return (
    <ServiceLayout
      crumbs={[{ label: "Home", href: "/home" }, { label: "Register" }]}
      title="Places register"
      lede="Every place belongs to the corporation that holds it, and each corporation sets its own consent rule. Public columns only: a recorded name, boundary and significance are ciphertext here, and open only in a custodian's own browser."
    >
      <div className="stack">
        <div className="spread">
          <span className="muted small">
            {loading ? "Reading the register…" : `${places.length} place(s) recorded`}
          </span>
          {isCustodian && (
            <div className="row" style={{ gap: 8 }}>
              {places.length < SEED_SITES.length && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={loadSamples}
                  disabled={working || orgs.length === 0}
                >
                  <Upload size={14} strokeWidth={1.8} />
                  {working ? "Sealing…" : "Load sample places"}
                </button>
              )}
              <Link className="btn btn-primary btn-sm" href="/register/new">
                <Plus size={14} strokeWidth={2} /> Record a place
              </Link>
            </div>
          )}
        </div>

        {message && <Callout variant="ok">{<p>{message}</p>}</Callout>}

        <DataTable
          rows={places}
          columns={columns}
          rowKey={(r) => r.id}
          initialSort={{ key: "ref", dir: "asc" }}
          onRowClick={(r) => router.push(`/register/${r.publicRef}`)}
          empty={
            <EmptyState title="Nothing is recorded yet.">
              <span className="small muted">
                {isCustodian
                  ? "Use “Load sample places” to seal the scenario records in this browser, or record one yourself."
                  : "A custodian has to record the first place — the protected fields can only be sealed in their browser."}
              </span>
            </EmptyState>
          }
        />
      </div>
    </ServiceLayout>
  );
}
