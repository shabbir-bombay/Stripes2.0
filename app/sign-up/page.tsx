import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { Field } from "@/components/Field";

export default function SignUp() {
  return (
    <main className="page center">
      <h1>Create an account</h1>
      <AuthForm endpoint="/api/auth/sign-up" submitLabel="Create account">
        <Field label="Name" name="name" autoComplete="name" maxLength={80} required />
        <Field label="Pacific email" name="email" type="email" autoComplete="email" hint="Ends in @u.pacific.edu" required />
        <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} hint="At least 8 characters" required />
      </AuthForm>
      <p className="switch">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </main>
  );
}
