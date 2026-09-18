import messages from './messages.en.json' with { type: 'json' };
let locale = 'ja';
const listeners = new Set();
export const getLocale = () => locale;
export const subscribeLocale = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function setLocale(value) {
  const next = value === 'en' ? 'en' : 'ja';
  if (next === locale) return;
  locale = next;
  listeners.forEach((listener) => listener());
}
const escape = (s) =>
  Array.from(s, (c) => ('\\^$.*+?()[]{}|'.includes(c) ? '\\' + c : c)).join('');
const pattern = new RegExp(
  Object.keys(messages)
    .filter((s) => s !== '日本語')
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|'),
  'g',
);
export function translateText(text) {
  if (locale !== 'en') return text;
  return messages[text] ?? text.replace(pattern, (key) => messages[key]);
}
