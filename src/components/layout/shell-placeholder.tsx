import type { ReactNode } from 'react';

type ShellPlaceholderProps = Readonly<{
  body: string;
  eyebrow: string;
  title: string;
  children?: ReactNode;
}>;

export function ShellPlaceholder({
  body,
  children,
  eyebrow,
  title,
}: ShellPlaceholderProps) {
  return (
    <section className="shell-placeholder">
      <p className="shell-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{body}</p>
      {children}
    </section>
  );
}
