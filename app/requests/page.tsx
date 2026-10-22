"use client";

// Change requests. One list, filtered by what the signed-in person is for: a custodian sees
// what waits on their decision first; a proponent sees their own; a minister sees the queue.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ServiceLayout } from "@/components/ServiceLayout";
import { DataTable, type Column } from "@/components/DataTable";
import { ChangeStateBadge, changeTypeLabel } from "@/components/StateBadge";
import { EmptyState } from "@/components/EmptyState";
import { Callout } from "@/components/TaskFlow";
import { useApi } from "@/lib/useApi";
import { useIdentity } from "@/lib/identity/client";

interface ChangeRow {
  id: string;
  ref: string;
  type: string;
  state: string;
  title: string;
  placeRef: string;
  placeName: string;
  community: string;
  consentRule: string;
  initiatorName: string;
  initiatorRole: string;
  subjectName: string;
  subjectSub: string;
  grantedRole: string;
  ministerConsent: boolean;
  noticePdfHash: string | null;
  createdAt: string;
  tally: { approvals: number; denials: number; threshold: number; outstanding: number };
  decisions: { custodianSub: string; custodianName: string; decision: string; at: string }[];
}

type Tab = "action" | "open" | "mine" | "all";

export default function RequestsPage() {
  const router = useRouter();
  const { user, hasRole } = useIdentity();
  const { data, loading } = useApi<{ requests: ChangeRow[] }>("/api/changes");

  const isCustodian = hasRole("custodian");
  const isProponent = hasRole("proponent");
  const isMinister = hasRole("minister");

  const rows = data?.requests ?? [];

  const needsMe = useMemo(
    () =>
      rows.filter((r) => {
        if (isCustodian && r.state === "PENDING_QUORUM") {
          return (
            !r.decisions.some((d) => d.custodianSub === user?.sub) && r.initiatorName !== user?.name
          );
        }
        if (isCustodian && r.state === "APPROVED") return true;
        if (isProponent && r.state === "DRAFT" && r.subjectSub === user?.sub) return true;
        return false;
      }),
    [rows, isCustodian, isProponent, user],
  );

  const open = rows.filter((r) => !["COMMITTED", "REJECTED"].includes(r.state));
  const mine = rows.filter((r) => r.subjectSub === user?.sub);

  // The landing tab is a default, not a stored choice: on first render the request list
  // has not arrived yet, so snapshotting it in useState would strand a custodian on
  // "Open" even once work is waiting on them. Hold null until the person picks a tab.
  const [picked, setPicked] = useState<Tab | null>(null);
  const tab: Tab = picked ?? (needsMe.length > 0 ? "action" : isProponent ? "mine" : "open");
  const setTab = setPicked;

  const shown = tab === "action" ? needsMe : tab === "open" ? open : tab === "mine" ? mine : rows;

  const columns: Column<ChangeRow>[] = [
    {
      key: "ref",
      header: "Reference",
      width: "130px",
      sort: (r) => r.ref,
      cell: (r) => (
        <Link className="mono" href={`/requests/${r.id}`}>
          {r.ref}
        </Link>
      ),
    },
    {
      key: "place",
      header: "Place",
      width: "170px",
      sort: (r) => r.placeRef,
      cell: (r) => (
        <>
          <span className="mono">{r.placeRef}</span>{" "}
          <span className="muted tiny">{r.placeName}</span>
        </>
      ),
    },
    { key: "title", header: "Proposal", sort: (r) => r.title, cell: (r) => r.title },
    {
      key: "type",
      header: "Type",
      secondary: true,
      sort: (r) => r.type,
      cell: (r) => changeTypeLabel(r.type),
    },
    {
      key: "initiator",
      header: "Lodged by",
      secondary: true,
      sort: (r) => r.initiatorName,
      cell: (r) => (
        <>
          {r.initiatorName} <span className="tiny muted">({r.initiatorRole})</span>
        </>
      ),
    },
    {
      key: "notice",
      header: "Notice",
      secondary: true,
      width: "110px",
      cell: (r) =>
        r.noticePdfHash ? (
          <span className="mono tiny" title={r.noticePdfHash}>
            {r.noticePdfHash.slice(0, 10)}…
          </span>
        ) : (
          <span className="tiny muted">not issued</span>
        ),
    },
    {
      key: "quorum",
      header: "Quorum",
      width: "100px",
      align: "right",
      sort: (r) => r.tally.approvals,
      cell: (r) => (
        <span className="mono">
          {r.tally.approvals}/{r.tally.threshold}
        </span>
      ),
    },
    {
      key: "state",
      header: "State",
      width: "150px",
      sort: (r) => r.state,
      cell: (r) => <ChangeStateBadge state={r.state} />,
    },
  ];

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "action", label: "Needs your action", count: needsMe.length },
    { id: "open", label: "Open", count: open.length },
    ...(isProponent ? [{ id: "mine" as Tab, label: "Yours", count: mine.length }] : []),
    { id: "all", label: "All", count: rows.length },
  ];

  return (
    <ServiceLayout
      crumbs={[{ label: "Home", href: "/home" }, { label: "Requests" }]}
      title="Change requests"
      lede={
        isMinister
          ? "Every request affecting a registered place. You may record a consent on any of them; it is an input to the community's decision and grants nothing on its own."
          : "Every request affecting a registered place, and where each one sits in the quorum."
      }
    >
      <div className="stack">
        {(isProponent || isMinister) && (
          <div className="spread">
            <span className="muted small">{loading ? "Loading…" : `${rows.length} request(s)`}</span>
            <Link className="btn btn-primary btn-sm" href="/requests/new">
              <Plus size={14} strokeWidth={2} /> Start a works notice
            </Link>
          </div>
        )}

        {isMinister && (
          <Callout variant="warn" heading="What a ministerial consent does here">
            <p>
              It is recorded against the request, shown to the custodians, and included in any
              instrument that is later issued. It is not a quorum signature, it does not change
              the tally, and there is no state in this register that it can move on its own.
            </p>
          </Callout>
        )}

        <div className="row-wrap" style={{ gap: 6 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`btn btn-sm${tab === t.id ? " btn-primary" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <DataTable
          rows={shown}
          columns={columns}
          rowKey={(r) => r.id}
          initialSort={{ key: "ref", dir: "desc" }}
          onRowClick={(r) => router.push(`/requests/${r.id}`)}
          empty={
            <EmptyState
              title={
                loading
                  ? "Loading…"
                  : tab === "action"
                    ? "Nothing is waiting on you."
                    : "No requests to show."
              }
            >
              {(isProponent || isMinister) && (
                <Link className="btn btn-sm" href="/requests/new">
                  Start a works notice
                </Link>
              )}
            </EmptyState>
          }
        />
      </div>
    </ServiceLayout>
  );
}
