import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * False during SSR and until React has hydrated the page. Forms use it to stay
 * disabled until then, so an early click can not trigger a native submit or
 * a change React does not know about.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
