"use client";

import { COLS, ROWS, type CellId } from "@/lib/grid";

const CELL = 40;
const MARGIN = 22; // ruler band around the grid

export interface GridMapProps {
  mode: "select" | "zones" | "boundary";
  selected?: CellId[];
  onToggle?: (cell: CellId) => void;
  zones?: CellId[];
  polygon?: [number, number][];
  basemap?: boolean; // show the survey basemap (contours, creek, road, locality)
}

export function GridMap({
  mode,
  selected = [],
  onToggle,
  zones = [],
  polygon,
  basemap = true,
}: GridMapProps) {
  const gw = COLS.length * CELL;
  const gh = ROWS.length * CELL;
  const W = gw + MARGIN * 2;
  const H = gh + MARGIN * 2;
  const selectedSet = new Set(selected);
  const zoneSet = new Set(zones);
  const interactive = mode === "select" && typeof onToggle === "function";

  const points =
    polygon && polygon.length > 0
      ? polygon.map(([x, y]) => `${(x * CELL).toFixed(1)},${(y * CELL).toFixed(1)}`).join(" ")
      : null;

  return (
    <div className="grid-map-wrap">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Survey reference map"
        style={{ display: "block", maxWidth: "100%", height: "auto" }}
      >
        <defs>
          <pattern id="zoneHatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill="transparent" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--accent)" strokeOpacity="0.28" strokeWidth="2" />
          </pattern>
        </defs>

        {/* map frame */}
        <rect x={MARGIN - 6} y={MARGIN - 6} width={gw + 12} height={gh + 12} fill="none" stroke="var(--line-strong)" strokeWidth="1" />

        {/* column + row rulers */}
        {COLS.map((c, ci) => (
          <text key={`cr-${c}`} x={MARGIN + ci * CELL + CELL / 2} y={MARGIN - 10} textAnchor="middle" fontSize={9} fill="var(--ink-3)">
            {c}
          </text>
        ))}
        {ROWS.map((r, ri) => (
          <text key={`rr-${r}`} x={MARGIN - 12} y={MARGIN + ri * CELL + CELL / 2 + 3} textAnchor="middle" fontSize={9} fill="var(--ink-3)">
            {r}
          </text>
        ))}

        <g transform={`translate(${MARGIN}, ${MARGIN})`}>
          {/* basemap (decorative, aligned to grid units * CELL) */}
          {basemap && (
            <g pointerEvents="none">
              {/* contour hints around a rise near I2 */}
              <ellipse cx={8.6 * CELL} cy={2 * CELL} rx={2.1 * CELL} ry={1.4 * CELL} fill="none" stroke="var(--line-strong)" strokeWidth="0.75" opacity="0.5" />
              <ellipse cx={8.6 * CELL} cy={2 * CELL} rx={1.3 * CELL} ry={0.85 * CELL} fill="none" stroke="var(--line-strong)" strokeWidth="0.75" opacity="0.5" />
              {/* watercourse: Dry Creek */}
              <path
                d={`M0 ${2.3 * CELL} C${2 * CELL} ${2 * CELL} ${3 * CELL} ${3.4 * CELL} ${4.5 * CELL} ${3.2 * CELL} C${6.5 * CELL} ${3 * CELL} ${7 * CELL} ${4.6 * CELL} ${9 * CELL} ${4.8 * CELL} C${10.5 * CELL} ${5 * CELL} ${11 * CELL} ${5.8 * CELL} ${12 * CELL} ${6.2 * CELL}`}
                fill="none"
                stroke="#6f93a6"
                strokeWidth="1.5"
                opacity="0.6"
              />
              <text x={1.2 * CELL} y={2.0 * CELL} fontSize="8" fill="#6f93a6" fontStyle="italic" opacity="0.8">Dry Creek</text>
              {/* road: Old Coach Road */}
              <line x1={0.6 * CELL} y1={7.6 * CELL} x2={11.6 * CELL} y2={1.1 * CELL} stroke="var(--clay)" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.6" />
              <text x={3.3 * CELL} y={6.0 * CELL} fontSize="8" fill="var(--clay)" opacity="0.85" transform={`rotate(-30 ${3.3 * CELL} ${6.0 * CELL})`}>Old Coach Road</text>
              {/* locality label */}
              <text x={0.2 * CELL} y={0.55 * CELL} fontSize="9" fill="var(--ink-3)" letterSpacing="1.5" opacity="0.7">RIDGELINE BASIN · INDICATIVE</text>
            </g>
          )}

          {/* cells */}
          {ROWS.map((r, ri) =>
            COLS.map((c, ci) => {
              const id = `${c}${r}`;
              const x = ci * CELL;
              const y = ri * CELL;
              const isZone = zoneSet.has(id);
              const isSel = selectedSet.has(id);
              return (
                <g key={id}>
                  <rect x={x} y={y} width={CELL} height={CELL} fill="none" stroke="var(--line)" strokeWidth={0.75} />
                  {isZone && <rect x={x} y={y} width={CELL} height={CELL} fill="url(#zoneHatch)" />}
                  {isSel && (
                    <rect x={x + 0.75} y={y + 0.75} width={CELL - 1.5} height={CELL - 1.5} fill="var(--accent)" fillOpacity={0.12} stroke="var(--ink)" strokeWidth={1.5} />
                  )}
                  {interactive && (
                    <rect x={x} y={y} width={CELL} height={CELL} fill="transparent" style={{ cursor: "pointer" }} onClick={() => onToggle!(id)} />
                  )}
                </g>
              );
            })
          )}

          {/* boundary polygon */}
          {points && <polygon points={points} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />}
        </g>

        {/* compass rose */}
        <g transform={`translate(${W - MARGIN - 10}, ${MARGIN + 12})`}>
          <line x1="0" y1="-10" x2="0" y2="8" stroke="var(--ink-2)" strokeWidth="1" />
          <path d="M0 -12 L3 -5 L0 -7 L-3 -5 Z" fill="var(--ink-2)" />
          <text x="0" y="-15" textAnchor="middle" fontSize="8" fill="var(--ink-2)">N</text>
        </g>

        {/* scale bar */}
        <g transform={`translate(${MARGIN}, ${H - 7})`}>
          <line x1="0" y1="0" x2={2 * CELL} y2="0" stroke="var(--ink-2)" strokeWidth="1.5" />
          <line x1="0" y1="-3" x2="0" y2="3" stroke="var(--ink-2)" strokeWidth="1" />
          <line x1={CELL} y1="-3" x2={CELL} y2="3" stroke="var(--ink-2)" strokeWidth="1" />
          <line x1={2 * CELL} y1="-3" x2={2 * CELL} y2="3" stroke="var(--ink-2)" strokeWidth="1" />
          <text x={2 * CELL + 6} y="3" fontSize="8" fill="var(--ink-2)">2 km (approx.)</text>
        </g>
      </svg>

      {basemap && (
        <div className="map-meta">
          <span className="key"><span style={{ width: 14, height: 2, background: "var(--accent)", display: "inline-block" }} /> Precise boundary (decrypted)</span>
          <span className="key"><span style={{ width: 12, height: 12, background: "url(#zoneHatch)", border: "1px solid var(--accent)", display: "inline-block", backgroundColor: "var(--accent-soft)" }} /> Notification zone (public)</span>
          <span className="key"><span style={{ width: 12, height: 12, border: "1.5px solid var(--ink)", background: "rgba(154,74,36,0.12)", display: "inline-block" }} /> Your selection</span>
        </div>
      )}
    </div>
  );
}
