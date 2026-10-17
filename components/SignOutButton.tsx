"use client";

import { useRouter } from "next/navigation";
import { Button } from "./Button";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={signOut}>
      Sign out
    </Button>
  );
}
