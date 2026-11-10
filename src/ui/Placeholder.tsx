import type { ReactNode } from 'react';

interface Props {
  title: string;
  milestone: string;
  children?: ReactNode;
}

/** Temporary screen body until the screen's milestone lands. */
export function Placeholder({ title, milestone, children }: Props) {
  return (
    <section>
      <h1>{title}</h1>
      {children}
      <p className="muted">Coming in {milestone} (see PLAN.md §7).</p>
    </section>
  );
}
