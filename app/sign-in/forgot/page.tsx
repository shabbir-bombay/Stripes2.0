"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import type { EmailRequest, ResetPasswordRequest } from "@/lib/types";

/** Two steps: the email gets a 6-digit code, then the code and a new password. */
export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function sendCode(event?: FormEvent) {
    event?.preventDefault();
    return run(async () => {
      await api("/api/auth/forgot-password", "POST", { email } satisfies EmailRequest);
      setSent(true);
    });
  }

  function reset(event: FormEvent) {
    event.preventDefault();
    return run(async () => {
      await api("/api/auth/reset-password", "POST", { email, code, password } satisfies ResetPasswordRequest);
      router.replace(`/sign-in?reset=1&email=${encodeURIComponent(email)}`);
    });
  }

  return (
    <main className="page center">
      <h1>Reset your password</h1>
      {!sent ? (
        <form className="stack" onSubmit={sendCode}>
          <p className="lead">Enter your Pacific email and we&apos;ll send you a code.</p>
          <Field label="Pacific email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {error && <p role="alert" className="form-error">{error}</p>}
          <Button type="submit" disabled={busy}>{busy ? "Please wait…" : "Send code"}</Button>
        </form>
      ) : (
        <form className="stack" onSubmit={reset}>
          <p role="status" className="lead">
            If there&apos;s an account for {email}, we emailed it a 6-digit code. It may be in your junk folder.
          </p>
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
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p role="alert" className="form-error">{error}</p>}
          <Button type="submit" disabled={busy}>{busy ? "Please wait…" : "Change password"}</Button>
          <Button type="button" variant="secondary" onClick={() => sendCode()} disabled={busy}>Send a new code</Button>
        </form>
      )}
      <p className="switch">
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </main>
  );
}
