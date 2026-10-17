import type { ReactNode } from "react";
import { RoleLayout } from "@/components/RoleLayout";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return <RoleLayout role="student">{children}</RoleLayout>;
}
