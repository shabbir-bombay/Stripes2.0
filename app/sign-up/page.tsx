import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { Field } from "@/components/Field";
import { Wordmark } from "@/components/Wordmark";

export default function SignUp() {
  return (
    <main className="auth">
      <Wordmark />
      <h1>Create your account</h1>
      <AuthForm endpoint="/api/auth/sign-up" submitLabel="Create account">
        <Field label="Name" name="name" autoComplete="name" placeholder="First and last name" maxLength={80} required />
        <Field
          label="Pacific email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tiger@u.pacific.edu"
          hint="Ends in @u.pacific.edu or @pacific.edu"
          required
        />
        <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} hint="At least 8 characters" required />
      </AuthForm>
      <p className="switch">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </main>
  );
}
