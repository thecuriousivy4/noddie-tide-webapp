import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state stack-sm">
      <p>{title}</p>
      {children}
    </div>
  );
}
