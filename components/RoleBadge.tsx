export function RoleBadge({ role }: { role: string }) {
  const isPermit = role.startsWith("permit-");
  return <span className={`role-badge${isPermit ? " permit" : ""}`}>{role}</span>;
}
