// Status lozenges for the two things this register tracks: the pressure on a place, and
// where a change request sits in the state machine.

const PLACE: Record<string, { label: string; variant: string }> = {
  WORKS_PROPOSED: { label: "Works proposed", variant: "danger" },
  UNDER_WATCH: { label: "Under watch", variant: "warn" },
  QUIET: { label: "Quiet", variant: "ok" },
};

const CHANGE: Record<string, { label: string; variant: string }> = {
  DRAFT: { label: "Draft", variant: "" },
  NOTICE_ISSUED: { label: "Notice issued", variant: "warn" },
  PENDING_QUORUM: { label: "Pending quorum", variant: "warn" },
  APPROVED: { label: "Approved", variant: "ok" },
  REJECTED: { label: "Refused", variant: "danger" },
  COMMITTED: { label: "Committed", variant: "gold" },
};

const TYPE: Record<string, string> = {
  WORKS_PERMIT: "Works permit",
  RESTRICTED_READ: "Restricted-layer standing",
  PERMIT_REVOCATION: "Permit revocation",
};

export function PlaceStatusBadge({ status }: { status: string }) {
  const s = PLACE[status] ?? { label: status, variant: "" };
  return <span className={`status-pill ${s.variant}`}>{s.label}</span>;
}

export function ChangeStateBadge({ state }: { state: string }) {
  const s = CHANGE[state] ?? { label: state, variant: "" };
  return <span className={`status-pill ${s.variant}`}>{s.label}</span>;
}

export function changeTypeLabel(type: string): string {
  return TYPE[type] ?? type;
}
