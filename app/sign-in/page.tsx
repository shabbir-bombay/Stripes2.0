import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { Field } from "@/components/Field";

const DONE: Record<string, string> = {
  confirmed: "Your email is confirmed. Sign in to start.",
  reset: "Your password is changed. Sign in with the new one.",
};

export default async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const done = Object.keys(DONE).find((key) => params[key] === "1");
  const email = typeof params.email === "string" ? params.email : undefined;

  return (
    <main className="page center">
      <h1>Sign in</h1>
      {done && <p role="status" className="banner open">{DONE[done]}</p>}
      <AuthForm endpoint="/api/auth/sign-in" submitLabel="Sign in">
        <Field label="Pacific email" name="email" type="email" autoComplete="email" defaultValue={email} required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      </AuthForm>
      <p className="switch">
        <Link href="/sign-in/forgot">Forgot your password?</Link>
      </p>
      <p className="switch">
        New to Stripes? <Link href="/sign-up">Create an account</Link>
      </p>
    </main>
  );
}
