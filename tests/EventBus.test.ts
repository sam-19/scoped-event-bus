/**
 * Scoped event bus tests.
 *
 * Dispatch is synchronous: dispatchScopedEvent calls every matching listener before it returns, so a
 * test asserts in its own body. An assertion deferred into a timer callback is not awaited by the
 * runner and is reached, if at all, during some later test.
 *
 * @package    scoped-event-bus
 * @copyright  2024 Sampsa Lohi
 * @license    MIT
 */

import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import EventBus from './EventBusTester'
import { getOrSetValue } from '../src/util'

type Listener = Mock<(event: Event) => void>

/** A listener that records the events it is given. */
const listener = () => vi.fn<(event: Event) => void>()

/** Detail of the last event `listener` received. */
const lastDetail = (listener: Listener) => (listener.mock.lastCall?.[0] as CustomEvent).detail

let bus: EventBus

beforeEach(() => {
    bus = new EventBus()
})

describe('Event bus setup', () => {
    test('a bus can be constructed with no listeners', () => {
        expect(bus).toBeTruthy()
        expect(bus.subscribers.size).toStrictEqual(0)
        expect(bus.patterns.size).toStrictEqual(0)
    })
})

describe('Global listeners', () => {
    test('a listener added without options receives every dispatch of its event', () => {
        const global = listener()
        bus.addEventListener('test', global)
        bus.dispatchScopedEvent('test')
        bus.dispatchScopedEvent('test', 'scope-1')
        expect(global).toBeCalledTimes(2)
        // Added through EventTarget rather than as a scoped subscriber.
        expect(bus.subscribers.size).toStrictEqual(0)
    })
    test('a listener does not receive dispatches of another event', () => {
        const global = listener()
        bus.addEventListener('test', global)
        bus.dispatchScopedEvent('test2')
        expect(global).not.toBeCalled()
    })
    test('options naming a subscriber, scope and phase register a scoped listener', () => {
        const scoped = listener()
        bus.addEventListener('test', scoped, { phase: 'after', scope: 'scope-1', subscriber: 'sub-1' })
        expect(bus.subscribers.get('test')?.length).toStrictEqual(1)
        bus.dispatchScopedEvent('test', 'scope-2')
        expect(scoped).not.toBeCalled()
        bus.dispatchScopedEvent('test', 'scope-1')
        expect(scoped).toBeCalledTimes(1)
    })
})

describe('Scoped listeners', () => {
    test('a scoped listener receives only its own scope', () => {
        const scoped = listener()
        bus.addScopedEventListener('test', scoped, 'sub-1', 'scope-1')
        expect(bus.subscribers.get('test')?.length).toStrictEqual(1)
        bus.dispatchScopedEvent('test')
        expect(scoped).not.toBeCalled()
        bus.dispatchScopedEvent('test', 'scope-2')
        expect(scoped).not.toBeCalled()
        bus.dispatchScopedEvent('test', 'scope-1')
        expect(scoped).toBeCalledTimes(1)
    })
    test('a listener registered without a scope receives every scope', () => {
        const unscoped = listener()
        bus.addScopedEventListener('test', unscoped, 'sub-1')
        bus.dispatchScopedEvent('test')
        bus.dispatchScopedEvent('test', 'scope-1')
        bus.dispatchScopedEvent('test', 'scope-2')
        expect(unscoped).toBeCalledTimes(3)
    })
    test('listeners of several scopes are held under one event key', () => {
        const first = listener()
        const second = listener()
        bus.addScopedEventListener('test', first, 'sub-1', 'scope-1')
        bus.addScopedEventListener('test', second, 'sub-2', 'scope-2')
        expect(bus.subscribers.get('test')?.length).toStrictEqual(2)
        bus.dispatchScopedEvent('test', 'scope-1')
        expect(first).toBeCalledTimes(1)
        expect(second).not.toBeCalled()
    })
    test('the same subscriber and callback are not registered twice for one scope', () => {
        const scoped = listener()
        bus.addScopedEventListener('test', scoped, 'sub-1', 'scope-1')
        bus.addScopedEventListener('test', scoped, 'sub-1', 'scope-1')
        expect(bus.subscribers.get('test')?.length).toStrictEqual(1)
        bus.dispatchScopedEvent('test', 'scope-1')
        expect(scoped).toBeCalledTimes(1)
    })
    test('registering without a scope replaces the same subscriber scoped registration', () => {
        const scoped = listener()
        bus.addScopedEventListener('test', scoped, 'sub-1', 'scope-1')
        bus.addScopedEventListener('test', scoped, 'sub-1')
        expect(bus.subscribers.get('test')?.length).toStrictEqual(1)
        bus.dispatchScopedEvent('test', 'scope-2')
        expect(scoped).toBeCalledTimes(1)
    })
    test('an array of events registers the listener for each of them', () => {
        const scoped = listener()
        bus.addScopedEventListener(['test', 'test2'], scoped, 'sub-1', 'scope-1')
        expect(bus.subscribers.get('test')?.length).toStrictEqual(1)
        expect(bus.subscribers.get('test2')?.length).toStrictEqual(1)
        bus.dispatchScopedEvent('test', 'scope-1')
        bus.dispatchScopedEvent('test2', 'scope-1')
        expect(scoped).toBeCalledTimes(2)
    })
    test('only the listeners of the dispatched phase are called', () => {
        const before = listener()
        const after = listener()
        bus.addScopedEventListener('test', before, 'sub-1', 'scope-1', 'before')
        bus.addScopedEventListener('test', after, 'sub-1', 'scope-1', 'after')
        bus.dispatchScopedEvent('test', 'scope-1', 'before')
        expect(before).toBeCalledTimes(1)
        expect(after).not.toBeCalled()
        bus.dispatchScopedEvent('test', 'scope-1', 'after')
        expect(before).toBeCalledTimes(1)
        expect(after).toBeCalledTimes(1)
    })
})

describe('Removing listeners', () => {
    test('removeScopedEventListener removes one listener and keeps the others', () => {
        const first = listener()
        const second = listener()
        bus.addScopedEventListener('test', first, 'sub-1', 'scope-1')
        bus.addScopedEventListener('test', second, 'sub-2', 'scope-2')
        bus.removeScopedEventListener('test', first, 'sub-1', 'scope-1')
        expect(bus.subscribers.get('test')?.length).toStrictEqual(1)
        bus.dispatchScopedEvent('test', 'scope-1')
        bus.dispatchScopedEvent('test', 'scope-2')
        expect(first).not.toBeCalled()
        expect(second).toBeCalledTimes(1)
    })
    test('the event key is dropped once its last listener is removed', () => {
        const scoped = listener()
        bus.addScopedEventListener('test', scoped, 'sub-1', 'scope-1')
        bus.removeScopedEventListener('test', scoped, 'sub-1', 'scope-1')
        expect(bus.subscribers.get('test')).not.toBeDefined()
    })
    test('removeEventListener removes a scoped listener only when the options name its subscriber', () => {
        const scoped = listener()
        bus.addScopedEventListener('test', scoped, 'sub-1', 'scope-1')
        // Without the options object the call reaches EventTarget, which knows nothing of the
        // scoped subscriber registry.
        bus.removeEventListener('test', scoped)
        expect(bus.subscribers.get('test')?.length).toStrictEqual(1)
        bus.removeEventListener('test', scoped, { scope: 'scope-1', subscriber: 'sub-1' })
        expect(bus.subscribers.get('test')).not.toBeDefined()
    })
    test('the returned function unsubscribes the listener it registered', () => {
        const scoped = listener()
        const unsubscribe = bus.addScopedEventListener('unsubscribe', scoped, 'unsub', 'unsub')
        expect(bus.subscribers.get('unsubscribe')?.length).toStrictEqual(1)
        unsubscribe()
        expect(bus.subscribers.get('unsubscribe')).not.toBeDefined()
    })
    test('removeAllScopedEventListeners removes every event of one subscriber', () => {
        const first = listener()
        const second = listener()
        bus.addScopedEventListener('test', first, 'sub-1', 'scope-1')
        bus.addScopedEventListener('test2', first, 'sub-1', 'scope-1')
        bus.addScopedEventListener('test', second, 'sub-2', 'scope-1')
        bus.removeAllScopedEventListeners('sub-1')
        expect(bus.subscribers.get('test')?.length).toStrictEqual(1)
        expect(bus.subscribers.get('test2')).not.toBeDefined()
        bus.dispatchScopedEvent('test', 'scope-1')
        expect(first).not.toBeCalled()
        expect(second).toBeCalledTimes(1)
    })
    test('removeAllScopedEventListeners can be limited to one scope', () => {
        const scoped = listener()
        bus.addScopedEventListener('test', scoped, 'sub-1', 'scope-1')
        bus.addScopedEventListener('test2', scoped, 'sub-1', 'scope-2')
        bus.removeAllScopedEventListeners('sub-1', 'scope-1')
        expect(bus.subscribers.get('test')).not.toBeDefined()
        expect(bus.subscribers.get('test2')?.length).toStrictEqual(1)
        bus.dispatchScopedEvent('test', 'scope-1')
        expect(scoped).not.toBeCalled()
        bus.dispatchScopedEvent('test2', 'scope-2')
        expect(scoped).toBeCalledTimes(1)
    })
    test('removeScope removes the listeners of that scope and leaves the rest', () => {
        const first = listener()
        const second = listener()
        bus.addScopedEventListener('test', first, 'sub-1', 'scope-1')
        bus.addScopedEventListener('test', second, 'sub-2', 'scope-2')
        bus.removeScope('scope-1')
        expect(bus.subscribers.get('test')?.length).toStrictEqual(1)
        bus.dispatchScopedEvent('test', 'scope-1')
        expect(first).not.toBeCalled()
        bus.dispatchScopedEvent('test', 'scope-2')
        expect(second).toBeCalledTimes(1)
    })
})

describe('Event details', () => {
    test('the dispatched scope and phase are carried in the event detail', () => {
        const scoped = listener()
        bus.addScopedEventListener('test', scoped, 'sub-1', 'scope-1')
        bus.dispatchScopedEvent('test', 'scope-1')
        expect(lastDetail(scoped).scope).toStrictEqual('scope-1')
        expect(lastDetail(scoped).phase).toStrictEqual('after')
    })
    test('custom detail properties reach the listener', () => {
        const scoped = listener()
        bus.addScopedEventListener('test', scoped, 'sub-1', 'scope-1')
        bus.dispatchScopedEvent('test', 'scope-1', 'after', { customProperty: true })
        expect(scoped).toBeCalledTimes(1)
        expect(lastDetail(scoped).customProperty).toStrictEqual(true)
    })
})

describe('Event hooks', () => {
    test('the before and after hooks register listeners of their own phase', () => {
        const before = listener()
        const after = listener()
        const hooks = bus.getEventHooks('test-2', 'sub-5')
        hooks.before(before)
        hooks.after(after)
        expect(bus.subscribers.get('test-2')?.length).toStrictEqual(2)
        bus.dispatchScopedEvent('test-2', undefined, 'before')
        expect(before).toBeCalledTimes(1)
        expect(after).not.toBeCalled()
        bus.dispatchScopedEvent('test-2')
        expect(before).toBeCalledTimes(1)
        expect(after).toBeCalledTimes(1)
    })
    test('unsubscribing one phase leaves the other registered', () => {
        const before = listener()
        const after = listener()
        const hooks = bus.getEventHooks('test-2', 'sub-5')
        hooks.before(before)
        hooks.after(after)
        hooks.unsubscribe('before')
        expect(bus.subscribers.get('test-2')?.length).toStrictEqual(1)
        bus.dispatchScopedEvent('test-2', undefined, 'before')
        bus.dispatchScopedEvent('test-2')
        expect(before).not.toBeCalled()
        expect(after).toBeCalledTimes(1)
    })
    test('unsubscribing with no phase removes both', () => {
        const before = listener()
        const after = listener()
        const hooks = bus.getEventHooks('test-2', 'sub-5')
        hooks.before(before)
        hooks.after(after)
        hooks.unsubscribe()
        expect(bus.subscribers.get('test-2')).not.toBeDefined()
        bus.dispatchScopedEvent('test-2', undefined, 'before')
        bus.dispatchScopedEvent('test-2')
        expect(before).not.toBeCalled()
        expect(after).not.toBeCalled()
    })
})

describe('Shorthand methods', () => {
    test('subscribe and unsubscribe act as their long-form names', () => {
        const scoped = listener()
        bus.subscribe('test-3', scoped, 'sub-6', 'scope-4')
        expect(bus.subscribers.get('test-3')?.length).toStrictEqual(1)
        bus.dispatchScopedEvent('test-3', 'scope-4')
        expect(scoped).toBeCalledTimes(1)
        bus.unsubscribe('test-3', scoped, 'sub-6', 'scope-4')
        expect(bus.subscribers.get('test-3')).not.toBeDefined()
        bus.dispatchScopedEvent('test-3', 'scope-4')
        expect(scoped).toBeCalledTimes(1)
    })
    test('unsubscribeAll removes every event of the subscriber', () => {
        const scoped = listener()
        bus.subscribe('test-3', scoped, 'sub-7', 'scope-4')
        bus.subscribe('test-4', scoped, 'sub-7', 'scope-4')
        bus.unsubscribeAll('sub-7')
        expect(bus.subscribers.get('test-3')).not.toBeDefined()
        expect(bus.subscribers.get('test-4')).not.toBeDefined()
        bus.dispatchScopedEvent('test-3', 'scope-4')
        bus.dispatchScopedEvent('test-4', 'scope-4')
        expect(scoped).not.toBeCalled()
    })
})

describe('Pattern listeners', () => {
    test('a pattern listener receives the events of its scope that match it', () => {
        const single = listener()
        const several = listener()
        bus.addScopedEventListener(/^regex-\d$/, single, 'regex-1', 'regex')
        bus.addScopedEventListener(/^regex-\d+$/, several, 'regex-2', 'regex')
        expect(bus.patterns.get('regex')?.length).toStrictEqual(2)
        bus.dispatchScopedEvent('regex-1', 'regex')
        bus.dispatchScopedEvent('regex-10', 'regex')
        expect(single).toBeCalledTimes(1)
        expect(several).toBeCalledTimes(2)
    })
    test('a pattern listener is not consulted for a dispatch that carries no scope', () => {
        const pattern = listener()
        bus.addScopedEventListener(/^regex-\d$/, pattern, 'regex-1', 'regex')
        bus.dispatchScopedEvent('regex-1')
        expect(pattern).not.toBeCalled()
    })
    test('a pattern registered without a scope is dropped', () => {
        const pattern = listener()
        bus.addScopedEventListener(/^regex-\d$/, pattern, 'regex-1')
        expect(bus.patterns.size).toStrictEqual(0)
        bus.dispatchScopedEvent('regex-1')
        bus.dispatchScopedEvent('regex-1', 'regex')
        expect(pattern).not.toBeCalled()
    })
    test('removeScope removes the patterns of that scope', () => {
        const pattern = listener()
        bus.addScopedEventListener(/^regex-\d$/, pattern, 'regex-1', 'regex')
        bus.removeScope('regex')
        expect(bus.patterns.get('regex')).not.toBeDefined()
        bus.dispatchScopedEvent('regex-1', 'regex')
        expect(pattern).not.toBeCalled()
    })
    test('the returned function unsubscribes a pattern listener', () => {
        const pattern = listener()
        const unsubscribe = bus.addScopedEventListener(/^regex-\d$/, pattern, 'regex-1', 'regex')
        unsubscribe()
        expect(bus.patterns.get('regex')).not.toBeDefined()
        bus.dispatchScopedEvent('regex-1', 'regex')
        expect(pattern).not.toBeCalled()
    })
})

describe('Debug callback', () => {
    test('a dispatched event is relayed to the debug callback', () => {
        const debug = listener()
        bus.debugCallback = debug
        bus.dispatchScopedEvent('test', 'scope-1')
        expect(debug).toBeCalled()
        expect((debug.mock.calls[0][0] as CustomEvent).detail.scope).toStrictEqual('scope-1')
    })
    /**
     * Current behaviour, pinned rather than endorsed: dispatchScopedEvent relays the event and then
     * calls dispatchEvent, which relays a second time. The second payload spreads an Event, which
     * copies no own properties, so it names neither the event nor its scope.
     */
    test('one scoped dispatch reaches the debug callback twice', () => {
        const debug = listener()
        bus.debugCallback = debug
        bus.dispatchScopedEvent('test', 'scope-1')
        expect(debug).toBeCalledTimes(2)
        const second = debug.mock.calls[1][0] as CustomEvent
        expect(second.type).not.toBeDefined()
        expect(second.detail.scope).not.toBeDefined()
    })
    test('clearing the debug callback stops the relay', () => {
        const debug = listener()
        bus.debugCallback = debug
        bus.debugCallback = null
        bus.dispatchScopedEvent('test', 'scope-1')
        expect(debug).not.toBeCalled()
    })
})

describe('Utilities', () => {
    test('getOrSetValue returns the stored value and seeds a missing key', () => {
        const map = new Map<string, number>()
        expect(getOrSetValue(map, 'a', 1)).toStrictEqual(1)
        expect(map.get('a')).toStrictEqual(1)
        expect(getOrSetValue(map, 'a', 2)).toStrictEqual(1)
        expect(map.get('a')).toStrictEqual(1)
    })
})
