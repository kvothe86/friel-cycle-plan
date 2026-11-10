import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** Small uppercase line above the title (date, phase, context). */
  eyebrow?: ReactNode;
  /** Right-aligned actions or status. */
  aside?: ReactNode;
}

export function PageHeader({ title, eyebrow, aside }: Props) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
      </div>
      {aside && <div className="page-header-aside">{aside}</div>}
    </header>
  );
}
