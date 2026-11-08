import Link from "next/link";
import { ConfirmForm } from "./ConfirmForm";

export default async function Confirm({ searchParams }: PageProps<"/sign-up/confirm">) {
  const { email } = await searchParams;
  return (
    <main className="page center">
      <h1>Confirm your email</h1>
      <ConfirmForm email={typeof email === "string" ? email : ""} />
      <p className="switch">
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </main>
  );
}
