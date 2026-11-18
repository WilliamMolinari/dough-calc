import { createContext, useContext, type ReactNode } from "react";
import type { TempUnit } from "../lib/types";

const TempUnitContext = createContext<TempUnit>("c");

/** Temperature is a display preference; components read it instead of drilling it. */
export function TempUnitProvider({
  value,
  children,
}: {
  value: TempUnit;
  children: ReactNode;
}) {
  return <TempUnitContext.Provider value={value}>{children}</TempUnitContext.Provider>;
}

export function useTempUnit(): TempUnit {
  return useContext(TempUnitContext);
}
