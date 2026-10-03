"use client";

import { Printer } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

export function PrintButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Button
      variant="secondary"
      className={className}
      icon={<Printer aria-hidden="true" strokeWidth={1.5} className="size-4" />}
      onClick={() => window.print()}
    >
      {children}
    </Button>
  );
}
