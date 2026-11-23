import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "tonal" | "quiet" | "danger" | "danger-quiet";
type Size = "normal" | "big" | "small";
type Style = { variant?: Variant; size?: Size };

const classes = ({ variant = "primary", size = "normal" }: Style, extra = "") =>
  ["button", variant, size === "normal" ? "" : size, extra].filter(Boolean).join(" ");

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & Style) {
  return <button className={classes({ variant, size }, className)} {...props} />;
}

/** A link that looks like a button, for moving to another page. */
export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & Style) {
  return <Link className={classes({ variant, size }, className)} {...props} />;
}
