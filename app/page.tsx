import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { sessionUser } from "@/lib/server/auth";

export default async function Home() {
  const user = await sessionUser();
  if (user && !user.suspended) redirect(`/${user.role}`);

  return (
    <main className="page center">
      <h1 className="brand">STRIPES</h1>
      <p className="lead">Cart rides across the Pacific campus.</p>
      <div className="stack">
        <ButtonLink href="/sign-in">Sign in</ButtonLink>
        <ButtonLink href="/sign-up" variant="secondary">
          Create account
        </ButtonLink>
      </div>
    </main>
  );
}
