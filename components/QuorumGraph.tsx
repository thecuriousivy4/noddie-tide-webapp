"use client";

// Quorum visualization — a multisig-style approval graph (pattern borrowed from Gnosis Safe /
// Snapshot): three custodian signers around a central permit node, edges that light up as each
// elder approves, a progress ring toward the 2-of-3 threshold, and a terminal "committed" seal.
// Authorities that cannot act alone (minister, system admin) are shown severed in red.

import { motion } from "framer-motion";
import { Crown, ShieldAlert, Unplug } from "lucide-react";

export interface QuorumSigner {
  sub: string;
  name: string;
  initials: string;
}

export interface QuorumGraphProps {
  signers: QuorumSigner[]; // the three custodians
  approvals: string[]; // subs that have approved
  threshold?: number; // default 2
  committed?: boolean;
  blocked?: { name: string; role: string }[]; // minister / admin
}

const C = { cx: 170, cy: 130, rCenter: 38, rNode: 28 };
// triangle anchor points for up to three signers
const ANCHORS = [
  { x: 170, y: 40 },
  { x: 64, y: 206 },
  { x: 276, y: 206 },
];

export function QuorumGraph({
  signers,
  approvals,
  threshold = 2,
  committed = false,
  blocked = [],
}: QuorumGraphProps) {
  const approvedSet = new Set(approvals);
  const count = Math.min(approvals.length, threshold);
  const quorumMet = approvals.length >= threshold;

  const ringR = C.rCenter + 8;
  const circ = 2 * Math.PI * ringR;
  const frac = Math.min(count / threshold, 1);

  const centerStroke = committed ? "var(--gold)" : quorumMet ? "var(--eucalypt)" : "var(--line-strong)";
  const centerFill = committed ? "var(--gold-soft)" : quorumMet ? "var(--ok-soft)" : "var(--surface)";

  const status = committed
    ? "Committed — the permit now exists in the token"
    : quorumMet
      ? "Quorum reached — ready to commit"
      : approvals.length === 0
        ? `${threshold} of ${signers.length} custodians required`
        : `${threshold - approvals.length} more approval${threshold - approvals.length === 1 ? "" : "s"} required`;

  return (
    <div className="quorum">
      <motion.svg
        viewBox="0 -16 340 284"
        width="100%"
        style={{ maxWidth: 360, display: "block", margin: "0 auto" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        role="img"
        aria-label={`Quorum: ${approvals.length} of ${threshold} approvals`}
      >
        {/* edges */}
        {signers.map((s, i) => {
          const a = ANCHORS[i] ?? ANCHORS[0];
          const approved = approvedSet.has(s.sub);
          return (
            <line
              key={`edge-${s.sub}`}
              x1={a.x}
              y1={a.y}
              x2={C.cx}
              y2={C.cy}
              stroke={approved ? (committed ? "var(--gold)" : "var(--eucalypt)") : "var(--line)"}
              strokeWidth={approved ? 2.5 : 1.25}
              strokeDasharray={approved ? "0" : "4 5"}
              style={{ transition: "stroke 0.45s ease, stroke-width 0.45s ease" }}
            />
          );
        })}

        {/* progress ring */}
        <circle cx={C.cx} cy={C.cy} r={ringR} fill="none" stroke="var(--line)" strokeWidth="3" />
        <motion.circle
          cx={C.cx}
          cy={C.cy}
          r={ringR}
          fill="none"
          stroke={committed ? "var(--gold)" : "var(--eucalypt)"}
          strokeWidth="3"
          strokeLinecap="round"
          transform={`rotate(-90 ${C.cx} ${C.cy})`}
          strokeDasharray={circ}
          initial={false}
          animate={{ strokeDashoffset: circ * (1 - frac) }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />

        {/* center permit node */}
        <circle
          cx={C.cx}
          cy={C.cy}
          r={C.rCenter}
          fill={centerFill}
          stroke={centerStroke}
          strokeWidth="2"
          style={{ transition: "stroke 0.45s ease, fill 0.45s ease" }}
        />
        <text x={C.cx} y={C.cy - 4} textAnchor="middle" fontSize="10" fill="var(--ink-3)" style={{ letterSpacing: "0.08em" }}>
          PERMIT
        </text>
        <text x={C.cx} y={C.cy + 12} textAnchor="middle" fontSize="15" fontWeight={600} fill={committed ? "var(--gold)" : "var(--ink)"} style={{ fontFamily: "var(--font-serif)" }}>
          {count}/{threshold}
        </text>

        {/* signer nodes */}
        {signers.map((s, i) => {
          const a = ANCHORS[i] ?? ANCHORS[0];
          const approved = approvedSet.has(s.sub);
          const nodeStroke = approved ? (committed ? "var(--gold)" : "var(--eucalypt)") : "var(--line-strong)";
          const nodeFill = approved ? (committed ? "var(--gold-soft)" : "var(--ok-soft)") : "var(--surface)";
          const labelY = a.y > C.cy ? a.y + C.rNode + 15 : a.y - C.rNode - 8;
          return (
            <g key={`node-${s.sub}`}>
              <motion.circle
                cx={a.x}
                cy={a.y}
                r={C.rNode}
                fill={nodeFill}
                stroke={nodeStroke}
                strokeWidth="2"
                initial={false}
                animate={approved ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={{ duration: 0.4 }}
                style={{ transformOrigin: `${a.x}px ${a.y}px`, transition: "stroke 0.45s ease, fill 0.45s ease" }}
              />
              <text x={a.x} y={a.y + 5} textAnchor="middle" fontSize="14" fontWeight={600} fill={approved ? "var(--eucalypt)" : "var(--ink-2)"} style={{ fontFamily: "var(--font-mono)" }}>
                {s.initials}
              </text>
              {approved && (
                <g transform={`translate(${a.x + C.rNode - 10}, ${a.y - C.rNode + 2})`}>
                  <circle r="8" fill={committed ? "var(--gold)" : "var(--eucalypt)"} />
                  <path d="M-3.5 0 L-1 2.5 L3.5 -3" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              )}
              <text x={a.x} y={labelY} textAnchor="middle" fontSize="11" fill="var(--ink-2)">
                {s.name}
              </text>
            </g>
          );
        })}
      </motion.svg>

      <div className="stack-sm" style={{ marginTop: 12, textAlign: "center" }}>
        <div className="quorum-progress">{status}</div>
        <div className="quorum-legend" style={{ justifyContent: "center" }}>
          <span className="key"><span className="swatch" style={{ background: "var(--ok-soft)", borderColor: "var(--eucalypt)" }} /> Approved</span>
          <span className="key"><span className="swatch" style={{ background: "var(--surface)" }} /> Awaiting</span>
          {committed && <span className="key"><span className="swatch" style={{ background: "var(--gold-soft)", borderColor: "var(--gold)" }} /> Granted</span>}
        </div>
      </div>

      {blocked.length > 0 && (
        <div className="stack-sm" style={{ marginTop: 18 }}>
          <div className="tiny muted" style={{ textAlign: "center", display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
            <Unplug size={13} strokeWidth={1.5} /> These authorities cannot grant it, alone or together
          </div>
          <div className="blocked-lane" style={{ justifyContent: "center" }}>
            {blocked.map((b) => (
              <span key={b.role} className="blocked-chip">
                {b.role === "minister" ? <Crown size={14} strokeWidth={1.5} /> : <ShieldAlert size={14} strokeWidth={1.5} />}
                {b.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
