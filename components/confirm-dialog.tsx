"use client";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
export default function ConfirmDialog({
  open,
  title,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>
          This removes it from your notebook and any public pages. This cannot
          be undone.
        </AlertDialogDescription>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onConfirm();
                onClose();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
