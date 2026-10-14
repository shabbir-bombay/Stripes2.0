import { ButtonLink } from "@/components/Button";

export default function Home() {
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
