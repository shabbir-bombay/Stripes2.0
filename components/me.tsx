"use client";

import { createContext, useContext, type ReactNode } from "react";

/** The signed-in person's name, from the layout, so pages can greet them without another request. */
const MeContext = createContext<{ name: string }>({ name: "" });

export const useMe = () => useContext(MeContext);

export function MeProvider({ name, children }: { name: string; children: ReactNode }) {
  return <MeContext.Provider value={{ name }}>{children}</MeContext.Provider>;
}
