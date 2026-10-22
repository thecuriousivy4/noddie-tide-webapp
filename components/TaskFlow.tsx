"use client";

// The pieces every task flow is built from, so each one behaves the same way:
//
//   <TaskSteps>      where you are in the task
//   <StartPanel>     what this task is, what you need before you begin
//   <CheckAnswers>   review before anything is submitted, with Change links
//   <Confirmation>   reference number, what happens next, what was NOT done
//   <Callout>        a boxed statement — information, warning, or refusal
//
// The pattern matters here beyond convention: a register that quietly submits is a register
// that can surprise a community. Every irreversible step is shown back first.

import type { ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

export function TaskSteps({
  steps,
  current,
}: {
  steps: string[];
  /** 1-based. */
  current: number;
}) {
  return (
    <ol className="task-steps" aria-label={`Step ${current} of ${steps.length}`}>
      {steps.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "now" : "todo";
        return (
          <li key={s} className={state} aria-current={state === "now" ? "step" : undefined}>
            <span className="task-step-n">{state === "done" ? <Check size={12} strokeWidth={3} /> : n}</span>
            <span className="task-step-label">{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function StartPanel({
  what,
  need,
  before,
  children,
}: {
  /** What this task does, in one or two sentences. */
  what: ReactNode;
  /** What the person needs to hand before starting. */
  need?: ReactNode[];
  /** What this task will NOT do — the honest half of a start page. */
  before?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="start-panel">
      <div className="start-what">{what}</div>
      {need && need.length > 0 && (
        <>
          <h2>Before you start</h2>
          <ul className="start-need">
            {need.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </>
      )}
      {before && <div className="callout info">{before}</div>}
      {children}
    </div>
  );
}

export interface AnswerRow {
  label: string;
  value: ReactNode;
  /** Step to go back to. Omit when the value is not the person's to change. */
  changeTo?: string;
  changeLabel?: string;
}

export function CheckAnswers({
  rows,
  caption,
}: {
  rows: AnswerRow[];
  caption?: string;
}) {
  return (
    <div className="check-answers">
      {caption && <p className="muted small">{caption}</p>}
      <dl>
        {rows.map((r) => (
          <div className="check-row" key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
            <div className="check-change">
              {r.changeTo ? (
                <Link href={r.changeTo}>{r.changeLabel ?? "Change"}</Link>
              ) : (
                <span className="tiny muted">set by the register</span>
              )}
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Confirmation({
  heading,
  reference,
  referenceLabel = "Your reference",
  children,
  next,
  notDone,
}: {
  heading: string;
  reference?: string;
  referenceLabel?: string;
  children?: ReactNode;
  /** What happens next, in order. */
  next?: ReactNode[];
  /** What this did NOT do. Prevents a confirmation reading as more than it is. */
  notDone?: ReactNode;
}) {
  return (
    <div className="stack">
      <div className="confirm-panel">
        <h2>{heading}</h2>
        {reference && (
          <p className="confirm-ref">
            <span>{referenceLabel}</span>
            <strong className="mono">{reference}</strong>
          </p>
        )}
      </div>
      {children}
      {next && next.length > 0 && (
        <section className="stack-sm">
          <h2>What happens next</h2>
          <ol className="next-steps">
            {next.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ol>
        </section>
      )}
      {notDone && (
        <div className="callout warn">
          <h2>What this did not do</h2>
          {notDone}
        </div>
      )}
    </div>
  );
}

export function Callout({
  variant = "info",
  heading,
  children,
}: {
  variant?: "info" | "warn" | "danger" | "ok";
  heading?: string;
  children: ReactNode;
}) {
  return (
    <div className={`callout ${variant}`}>
      {heading && <h2>{heading}</h2>}
      {children}
    </div>
  );
}

/** The action bar at the foot of a task screen: primary action left, secondary beside it. */
export function TaskActions({ children }: { children: ReactNode }) {
  return <div className="task-actions">{children}</div>;
}
