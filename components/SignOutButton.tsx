"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { stopAlerts } from "./push";

export function SignOutButton({ variant = "secondary", className }: { variant?: ComponentProps<typeof Button>["variant"]; className?: string }) {
  const router = useRouter();

  async function signOut() {
    await stopAlerts();
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <Button variant={variant} className={className} onClick={signOut}>
      {variant !== "secondary" && <Icon name="signOut" small />}
      Sign out
    </Button>
  );
}
