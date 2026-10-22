"use client";

// The activity log: every state transition, document, approval, clearance check and policy
// decision, in order, with the hash that chains each entry to the one before it.

import { useMemo, useState } from "react";
import { ServiceLayout } from "@/components/ServiceLayout";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { useApi } from "@/lib/useApi";

interface Event {
  seq: number;
  at: string;
  actorName: string;
  actorRoles: string[];
  action: string;
  target: string;
  detail: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

const GROUPS: { label: string; match: (a: string) => boolean }[] = [
  { label: "All", match: () => true },
  { label: "Governance", match: (a) => a.startsWith("change.") },
  { label: "Documents", match: (a) => a.startsWith("document.") || a.includes("notice") },
  { label: "Register", match: (a) => a.startsWith("place.") || a.startsWith("clearance.") },
  { label: "Keys & policy", match: (a) => a.startsWith("policy.") },
  { label: "The gate", match: (a) => a.startsWith("works_notice.") },
];

export default function AuditPage() {
  const { data, loading } = useApi<{
    chain: { events: number; intact: boolean; brokenAtSeq?: number };
    events: Event[];
  }>("/api/audit?limit=400");
  const [group, setGroup] = useState("All");
  const [expanded, setExpanded] = useState<number | null>(null);

  const rows = useMemo(() => {
    const matcher = GROUPS.find((g) => g.label === group) ?? GROUPS[0];
    return (data?.events ?? []).filter((e) => matcher.match(e.action));
  }, [data, group]);

  const columns: Column<Event>[] = [
    { key: "seq", header: "#", width: "60px", align: "right", sort: (r) => r.seq, cell: (r) => r.seq },
    {
      key: "at",
      header: "When",
      width: "170px",
      sort: (r) => r.at,
      cell: (r) =>
        new Date(r.at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "medium" }),
    },
    { key: "actor", header: "Actor", sort: (r) => r.actorName, cell: (r) => r.actorName },
    {
      key: "action",
      header: "Action",
      sort: (r) => r.action,
      cell: (r) => <span className="mono">{r.action}</span>,
    },
    {
      key: "target",
      header: "Target",
      sort: (r) => r.target,
      cell: (r) => <span className="mono">{r.target}</span>,
    },
    {
      key: "hash",
      header: "Hash",
      width: "130px",
      secondary: true,
      cell: (r) => <span className="mono tiny">{r.hash.slice(0, 14)}…</span>,
    },
  ];

  return (
    <ServiceLayout
      crumbs={[{ label: "Home", href: "/home" }, { label: "Activity" }]}
      title="Activity log"
      lede="Append-only. Each entry's hash covers the previous entry's hash, so a removed or edited line breaks the chain and this page says so."
    >
      <div className="stack">
        {data && (
          <div className={`callout ${data.chain.intact ? "ok" : "danger"}`}>
            <h2>{data.chain.intact ? "Chain intact" : "Chain broken"}</h2>
            <p>
              {data.chain.intact
                ? `Recomputed from the first entry across ${data.chain.events} events; every hash matches its parent.`
                : `Broken at entry #${data.chain.brokenAtSeq}. A row has been edited or removed.`}
            </p>
          </div>
        )}

        <div className="row-wrap" style={{ gap: 6 }}>
          {GROUPS.map((g) => (
            <button
              key={g.label}
              type="button"
              className={`btn btn-sm${group === g.label ? " btn-primary" : ""}`}
              onClick={() => setGroup(g.label)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => String(r.seq)}
          initialSort={{ key: "seq", dir: "desc" }}
          onRowClick={(r) => setExpanded((cur) => (cur === r.seq ? null : r.seq))}
          empty={<EmptyState title={loading ? "Loading…" : "Nothing logged yet."} />}
        />

        {expanded !== null && (
          <section className="panel">
            <div className="panel-head">
              <strong style={{ fontWeight: 600, fontSize: 14 }}>Event #{expanded}</strong>
              <button type="button" className="btn btn-sm" onClick={() => setExpanded(null)}>
                Close
              </button>
            </div>
            <div className="panel-body">
              <pre className="json">
                {JSON.stringify(rows.find((r) => r.seq === expanded), null, 2)}
              </pre>
            </div>
          </section>
        )}
      </div>
    </ServiceLayout>
  );
}
