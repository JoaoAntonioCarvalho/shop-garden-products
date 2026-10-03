"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ComponentProps, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { Button } from "@/components/admin/ui/button";
import { toast } from "@/components/ui/toast";
import type { AdminResult } from "@/server/admin/action";

type ActionButtonProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  action: () => Promise<AdminResult<unknown>>;
  /** Pede confirmação com este texto (ações destrutivas dizem o nome do item). */
  confirm?: { title: string; description: ReactNode; confirmLabel?: string };
  onDone?: () => void;
  /** Depois de concluir, vai para o endereço devolvido pela ação em data.redirect. */
  redirectOnDone?: boolean;
};

/** Botão que executa uma ação do admin, mostra o aviso com o nome da ação e atualiza a página. */
export function ActionButton({
  action,
  confirm,
  onDone,
  redirectOnDone,
  children,
  disabled,
  ...props
}: ActionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const result = await action();
      setOpen(false);
      if (result.ok) {
        toast(result.message);
        onDone?.();
        const target =
          redirectOnDone &&
          result.data &&
          typeof result.data === "object" &&
          "redirect" in result.data
            ? (result.data.redirect as string | undefined)
            : undefined;
        if (target) router.push(target);
        else router.refresh();
      } else {
        toast(result.error, { tone: "error", duration: 8000 });
      }
    });

  return (
    <>
      <Button
        {...props}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        onClick={() => (confirm ? setOpen(true) : run())}
      >
        {children}
      </Button>
      {confirm ? (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction disabled={pending} onClick={run}>
                {confirm.confirmLabel ?? confirm.title}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
