import type { ReactNode } from "react";

/** Moldura das páginas de autenticação. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="container-store py-12">
      <div className="mx-auto max-w-md">
        <h1 className="type-h1 text-moss-900">{title}</h1>
        {description ? <p className="mt-3 type-body text-ink-muted">{description}</p> : null}
        <div className="mt-8">{children}</div>
        {footer ? (
          <div className="mt-8 border-t border-line pt-6 type-body text-ink">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
