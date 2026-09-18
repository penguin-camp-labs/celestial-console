import { useSyncExternalStore } from 'react';
import {
  getLocale,
  subscribeLocale,
  setLocale,
  translateText,
} from '@/lib/i18n.mjs';
export { setLocale };
export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, () => 'ja');
}
export function t<T>(value: T): T {
  return typeof value === 'string' ? (translateText(value) as T) : value;
}
