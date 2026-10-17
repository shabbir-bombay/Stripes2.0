import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { Field } from "@/components/Field";

export default function SignIn() {
  return (
    <main className="page center">
      <h1>Sign in</h1>
      <AuthForm endpoint="/api/auth/sign-in" submitLabel="Sign in">
        <Field label="Pacific email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      </AuthForm>
      <p className="switch">
        New to Stripes? <Link href="/sign-up">Create an account</Link>
      </p>
    </main>
  );
}
