import type { ReactNode } from "react";
import { RoleLayout } from "@/components/RoleLayout";

export default function DriverLayout({ children }: { children: ReactNode }) {
  return <RoleLayout role="driver">{children}</RoleLayout>;
}
