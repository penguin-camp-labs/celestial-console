import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EventChain,
  RootMediator,
  ROOT_INITIAL_STATE,
  createRootEvent,
} from '../lib/root-mediator.mjs';

test('RootMediator applies state-machine transitions and publishes one snapshot per handled event', () => {
  const mediator = new RootMediator();
  const seen = [];
  const stop = mediator.subscribe(() => seen.push(mediator.getSnapshot()));
  assert.deepEqual(mediator.getSnapshot(), ROOT_INITIAL_STATE);
  mediator.dispatch(createRootEvent('VIEW_SET', '2d'));
  assert.equal(mediator.getSnapshot().view, '2d');
  mediator.dispatch(createRootEvent('VIEW_SET', 'orrery'));
  assert.equal(mediator.getSnapshot().view, 'orrery');
  mediator.dispatch(createRootEvent('LOCALE_SET', 'en'));
  assert.equal(mediator.getSnapshot().locale, 'en');
  mediator.dispatch(createRootEvent('UNKNOWN', true));
  assert.equal(seen.length, 3);
  stop();
});

test('EventChain bubbles from the nearest view handler to the Root transition', () => {
  const parent = new EventChain();
  const child = new EventChain(parent);
  const calls = [];
  parent.use((event) => {
    calls.push('root');
    return event.type === 'ROOT_ONLY';
  });
  child.use((event) => {
    calls.push('view');
    return event.type === 'VIEW_ONLY';
  });
  assert.equal(child.bubble({ type: 'VIEW_ONLY' }, {}), true);
  assert.deepEqual(calls, ['view']);
  assert.equal(child.bubble({ type: 'ROOT_ONLY' }, {}), true);
  assert.deepEqual(calls, ['view', 'view', 'root']);
});
