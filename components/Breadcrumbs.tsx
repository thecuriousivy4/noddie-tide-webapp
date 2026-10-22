import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

/** Where you are and how you got here. The last crumb is the current page and is not a link. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.label + i}>
              {c.href && !last ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              {!last && <span className="crumb-sep" aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
