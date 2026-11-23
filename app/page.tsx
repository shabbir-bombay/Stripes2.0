import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { Wordmark } from "@/components/Wordmark";
import { sessionUser } from "@/lib/server/auth";

export default async function Home() {
  const user = await sessionUser();
  if (user && !user.suspended) redirect(`/${user.role}`);

  return (
    <main className="auth">
      <h1 className="sr-only">Stripes</h1>
      <Wordmark />
      <div className="stack">
        <ButtonLink href="/sign-in">Sign in</ButtonLink>
        <ButtonLink href="/sign-up" variant="tonal">
          Create account
        </ButtonLink>
      </div>
    </main>
  );
}
