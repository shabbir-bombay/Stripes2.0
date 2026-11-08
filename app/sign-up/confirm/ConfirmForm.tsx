"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import type { ConfirmEmailRequest, EmailRequest } from "@/lib/types";

/** The 6-digit code from the email. Once it's confirmed, the person signs in. */
export function ConfirmForm({ email: initialEmail }: { email: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api("/api/auth/confirm", "POST", { email, code } satisfies ConfirmEmailRequest);
      router.replace(`/sign-in?confirmed=1&email=${encodeURIComponent(email)}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(undefined);
    setSent(undefined);
    try {
      await api("/api/auth/resend-code", "POST", { email } satisfies EmailRequest);
      setSent(`We sent a new code to ${email}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <p className="lead">
        We emailed a 6-digit code{initialEmail ? ` to ${initialEmail}` : ""}. It can take a minute, and it may be in your junk folder.
      </p>
      {!initialEmail && <Field label="Pacific email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
      <Field
        label="Code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        required
      />
      {sent && <p role="status" className="banner open">{sent}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Please wait…" : "Confirm"}</Button>
      <Button type="button" variant="secondary" onClick={resend} disabled={busy || !email}>Send a new code</Button>
    </form>
  );
}
