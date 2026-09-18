export const ROOT_INITIAL_STATE = Object.freeze({
  phase: 'observatory',
  view: '3d',
  locale: 'ja',
  theme: 'dark',
});

export function createRootEvent(type, payload) {
  return { type, payload };
}

export class EventChain {
  constructor(parent = null) {
    this.parent = parent;
    this.handlers = [];
  }
  use(handler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((item) => item !== handler);
    };
  }
  bubble(event, state) {
    for (const handler of this.handlers) {
      if (handler(event, state) === true) return true;
    }
    return this.parent?.bubble(event, state) ?? false;
  }
}

function transition(state, event) {
  switch (event.type) {
    case 'VIEW_SET':
      return event.payload === '2d' ||
        event.payload === 'ground' ||
        event.payload === '3d'
        ? { ...state, view: event.payload }
        : state;
    case 'LOCALE_SET':
      return event.payload === 'en' || event.payload === 'ja'
        ? { ...state, locale: event.payload }
        : state;
    case 'THEME_SET':
      return typeof event.payload === 'string'
        ? { ...state, theme: event.payload }
        : state;
    case 'LIVE_START':
      return { ...state, phase: 'live' };
    case 'LIVE_STOP':
      return { ...state, phase: 'observatory' };
    default:
      return state;
  }
}

export class RootMediator {
  constructor(initial = ROOT_INITIAL_STATE) {
    this.state = { ...initial };
    this.listeners = new Set();
    this.chain = new EventChain();
  }
  getSnapshot = () => this.state;
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  use(handler) {
    return this.chain.use(handler);
  }
  dispatch(event) {
    if (!event || typeof event.type !== 'string') return this.state;
    if (this.chain.bubble(event, this.state)) return this.state;
    const next = transition(this.state, event);
    if (next === this.state) return this.state;
    this.state = Object.freeze(next);
    for (const listener of this.listeners) listener();
    return this.state;
  }
}
