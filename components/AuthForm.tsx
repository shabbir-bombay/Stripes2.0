"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ApiError, Me } from "@/lib/types";
import { Button } from "./Button";

/** Posts the form's fields as JSON to a sign-in or sign-up endpoint, then opens the user's home page. */
export function AuthForm({ endpoint, submitLabel, children }: { endpoint: string; submitLabel: string; children: ReactNode }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      const data: Me | ApiError = await response.json().catch(() => ({ error: "Something went wrong. Try again." }));
      if ("error" in data) throw new Error(data.error);
      router.replace(`/${data.role}`);
    } catch (e) {
      setError(e instanceof TypeError ? "Couldn't reach Stripes. Check your connection and try again." : (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      {children}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Please wait…" : submitLabel}
      </Button>
    </form>
  );
}
