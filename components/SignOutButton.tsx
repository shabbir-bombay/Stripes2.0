"use client";

import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { stopAlerts } from "./push";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await stopAlerts();
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
