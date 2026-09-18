'use client';
import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { RootMediator } from '@/lib/root-mediator.mjs';
const defaultMediator = new RootMediator();
const RootContext = createContext<RootMediator>(defaultMediator);
export function Root({ children }: { children: ReactNode }) {
  const [mediator] = useState(() => new RootMediator());
  return (
    <RootContext.Provider value={mediator}>{children}</RootContext.Provider>
  );
}
export function useRootMediator() {
  return useContext(RootContext);
}
export function useRootSnapshot(): {
  phase: string;
  view: string;
  locale: string;
  theme: string;
} {
  const mediator = useRootMediator();
  return useSyncExternalStore(
    mediator.subscribe,
    mediator.getSnapshot,
    mediator.getSnapshot,
  ) as { phase: string; view: string; locale: string; theme: string };
}
export function useRootEvent() {
  const mediator = useRootMediator();
  return (event: { type: string; payload?: unknown }) =>
    mediator.dispatch(event);
}
