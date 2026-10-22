// The platform lockup mark. It marks the register software, not any community: every
// corporation using Noddie keeps its own identity, and the register never speaks for them.
//
// A plain geometric figure: three stacked bars inside a square, reading as layered ground.
// Deliberately NOT the Commonwealth Coat of Arms, not any real agency's crest, and not a
// cultural motif — a register run by a community should not borrow the state's insignia or
// the community's art.

export function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Noddie heritage register"
    >
      <rect x="1" y="1" width="46" height="46" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />
      <rect x="9" y="30" width="30" height="7" fill="var(--accent)" />
      <rect x="9" y="21" width="22" height="6" fill="var(--ink)" opacity="0.75" />
      <rect x="9" y="13" width="14" height="5" fill="var(--ink)" opacity="0.45" />
    </svg>
  );
}
