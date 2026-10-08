import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";
import type { Role } from "@shared/roles";
import { uuid } from "@/lib/uuid";

export interface Me {
  id: number;
  displayName: string;
  roles: Role[];
  activeCompanyId: number;
  companies: { id: number; name: string }[];
}

const MeContext = createContext<Me | null>(null);

export function MeProvider({ me, children }: { me: Me; children: ReactNode }) {
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside MeProvider");
  return me;
}

export function useHasRole(...roles: Role[]): boolean {
  const me = useMe();
  return roles.some((r) => me.roles.includes(r));
}

export type Base = (<T extends object>(input: T) => T & { requestId: string; companyId: number }) & { reset: () => void };

/**
 * Adds the idempotency key and the company shown on screen to a mutation
 * input. A retry with the same input reuses the same request id (so the
 * server applies it once); call reset() after success.
 */
export function useBase(): Base {
  const { activeCompanyId } = useMe();
  const last = useRef<{ key: string; id: string } | null>(null);
  const fn = useCallback(
    <T extends object>(input: T) => {
      const key = JSON.stringify(input);
      if (!last.current || last.current.key !== key) last.current = { key, id: uuid() };
      return { ...input, requestId: last.current.id, companyId: activeCompanyId };
    },
    [activeCompanyId],
  ) as Base;
  fn.reset = () => {
    last.current = null;
  };
  return fn;
}
