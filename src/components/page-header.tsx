import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-5">
      {eyebrow ? <p className="mb-1 text-xs font-semibold tracking-[0.2em] text-sage">{eyebrow}</p> : null}
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm leading-6 text-ink/60">{subtitle}</p> : null}
    </header>
  );
}
