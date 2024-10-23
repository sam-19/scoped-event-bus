/**
 * Scoped event bus tests.
 * @package    scoped-event-bus
 * @copyright  2024 Sampsa Lohi
 * @license    MIT
 */

import { describe, expect, test } from '@jest/globals'
import EventBus from './EventBusTester'
import { getOrSetValue } from '../src/util'

const scopeMap = new Map<string, number>()

let customProperty = false
const listeners = {} as { [key: string]: jest.Mock<void, [event: Event], any> }
const lKeys = [
    'globalListener',
    'scopedListener1',
    'scopedListener2',
    'scopedListener3',
    'customListener',
    'beforeSubscriber',
    'afterSubscriber',
    'shorthandListener',
    'unsubscriber',
    'regexListener1',
    'regexListener2',
    'regexListener3',
]
for (const key of lKeys) {
    listeners[key] = jest.fn((event: Event) => {
        if (typeof (event as any).detail === 'undefined') {
            return
        }
        const custEv = event as CustomEvent
        const scopeEvents = getOrSetValue(scopeMap, custEv.detail.scope, 0)
        scopeMap.set(custEv.detail.scope, scopeEvents + 1)
        if (custEv.detail.customProperty) {
            customProperty = true
        }
    })
}

const bus = new EventBus()
describe('Event bus setup', () => {
    test('Event bus can be constructed.', () => {
        expect(bus).toBeTruthy()
        bus.addEventListener('test', listeners['globalListener'])
    })
    test('Global events via EventTarget.', async () => {
        bus.dispatchScopedEvent('test')
        setTimeout(() => {
            expect(listeners['globalListener']).toBeCalledTimes(1)
            expect(scopeMap.keys()).toEqual(['test'])
            expect(scopeMap.get('test')).toStrictEqual(1)
            bus.dispatchScopedEvent('test2')
            setTimeout(() => {
                expect(listeners['globalListener']).toBeCalledTimes(1)
            }, 1)
        }, 1)
    })
    test('Scoped events.', () => {
        setTimeout(() => {
            bus.addScopedEventListener('test', listeners['scopedListener1'], 'sub-1', 'scope-1')
            expect(bus.subscribers.get('test')?.length).toEqual(1)
            bus.dispatchScopedEvent('test', 'scope-1')
            setTimeout(() => {
                expect(listeners['globalListener']).toBeCalledTimes(2)
                expect(listeners['scopedListener1']).toBeCalledTimes(1)
                expect(scopeMap.keys()).toEqual(['test'])
                expect(scopeMap.get('test')).toStrictEqual(3)
                bus.addScopedEventListener('test', listeners['scopedListener2'], 'sub-1', 'scope-2')
                expect(bus.subscribers.get('test')?.length).toEqual(2)
                bus.dispatchScopedEvent('test', 'scope-2')
                setTimeout(() => {
                    expect(listeners['globalListener']).toBeCalledTimes(3)
                    expect(listeners['scopedListener1']).toBeCalledTimes(1)
                    expect(listeners['scopedListener2']).toBeCalledTimes(1)
                    expect(scopeMap.keys()).toEqual(['test'])
                    expect(scopeMap.get('test')).toStrictEqual(5)
                }, 1)
            }, 1)
        }, 10)
    })
    test('Remove listener.', () => {
        setTimeout(() => {
            bus.addScopedEventListener('test', listeners['scopedListener3'], 'sub-2', 'scope-3')
            expect(bus.subscribers.get('test')?.length).toEqual(3)
            bus.dispatchScopedEvent('test', 'scope-3')
            bus.dispatchScopedEvent('test', 'scope-2')
            setTimeout(() => {
                expect(listeners['globalListener']).toBeCalledTimes(4)
                expect(listeners['scopedListener2']).toBeCalledTimes(2)
                expect(listeners['scopedListener3']).toBeCalledTimes(1)
                bus.removeEventListener('test', listeners['scopedListener3'])
                expect(bus.subscribers.get('test')?.length).toEqual(2)
                bus.dispatchScopedEvent('test', 'scope-3')
                setTimeout(() => {
                    expect(listeners['globalListener']).toBeCalledTimes(5)
                    expect(listeners['scopedListener3']).toBeCalledTimes(1)
                }, 1)
            }, 1)
        }, 20)
    })
    test('Remove scoped listener.', () => {
        setTimeout(() => {
            bus.removeScopedEventListener('test', listeners['scopedListener2'], 'sub-1', 'scope-2')
            expect(bus.subscribers.get('test')?.length).toEqual(1)
            bus.dispatchScopedEvent('test', 'scope-2')
            setTimeout(() => {
                expect(listeners['globalListener']).toBeCalledTimes(5)
                expect(listeners['scopedListener2']).toBeCalledTimes(2)
                bus.addScopedEventListener('test', listeners['scopedListener2'], 'sub-1', 'scope-2')
                expect(bus.subscribers.get('test')?.length).toEqual(2)
                bus.dispatchScopedEvent('test', 'scope-2')
                setTimeout(() => {
                    expect(listeners['scopedListener2']).toBeCalledTimes(3)
                }, 1)
            }, 1)
        }, 30)
    })
    test ('Unsubsribe method.', () => {
        const unsubscribe = bus.addScopedEventListener('unsubscribe', listeners['unsubscriber'], 'unsub', 'unsub')
        expect(bus.subscribers.get('unsubscribe')?.length).toEqual(1)
        unsubscribe()
        expect(bus.subscribers.get('unsubscribe')).not.toBeDefined()
    })
    test('Remove all scoped listeners.', () => {
        setTimeout(() => {
            bus.removeAllScopedEventListeners('sub-1')
            expect(bus.subscribers.get('test')?.length).toEqual(1)
            bus.dispatchScopedEvent('test', 'scope-1')
            bus.dispatchScopedEvent('test', 'scope-2')
            setTimeout(() => {
                expect(listeners['scopedListener1']).toBeCalledTimes(1)
                expect(listeners['scopedListener2']).toBeCalledTimes(3)
                bus.addScopedEventListener('test', listeners['scopedListener1'], 'sub-1', 'scope-1')
                bus.addScopedEventListener('test', listeners['scopedListener2'], 'sub-1', 'scope-2')
                expect(bus.subscribers.get('test')?.length).toEqual(3)
            }, 1)
        }, 40)
    })
    test('Remove entire scope.', () => {
        setTimeout(() => {
            bus.removeScope('scope-1')
            bus.dispatchScopedEvent('test', 'scope-1')
            setTimeout(() => {
                expect(listeners['scopedListener1']).toBeCalledTimes(1)
                expect(bus.subscribers.get('test')?.length).toEqual(2)
            }, 1)
        }, 50)
    })
    test('Custom event details.', () => {
        setTimeout(() => {
            bus.addScopedEventListener('test', listeners['customListener'], 'sub-4', 'scope-1')
            bus.dispatchScopedEvent('test', 'scope-1', 'after', { customProperty: true })
            setTimeout(() => {
                expect(listeners['customListener']).toBeCalledTimes(1)
                expect(customProperty).toStrictEqual(true)
            }, 1)
        }, 60)
    })
    test('Event hooks.', () => {
        setTimeout(() => {
            listeners['globalListener'].mockReset()
            const hooks = bus.getEventHooks('test-2', 'sub-5')
            hooks.before(listeners['beforeSubscriber'])
            hooks.after(listeners['afterSubscriber'])
            bus.dispatchScopedEvent('test-2')
            expect(bus.subscribers.get('test-2')?.length).toStrictEqual(2)
            expect(listeners['beforeSubscriber']).toBeCalledTimes(1)
            setTimeout(() => {
                expect(listeners['afterSubscriber']).toBeCalledTimes(1)
                hooks.unsubscribe('before')
                bus.dispatchScopedEvent('test-2')
                setTimeout(() => {
                    expect(listeners['beforeSubscriber']).toBeCalledTimes(1)
                    expect(listeners['afterSubscriber']).toBeCalledTimes(2)
                    hooks.unsubscribe()
                    bus.dispatchScopedEvent('test-2')
                    setTimeout(() => {
                        expect(listeners['afterSubscriber']).toBeCalledTimes(2)
                        expect(listeners['globalListener']).toBeCalledTimes(0)
                    }, 1)
                }, 1)
            }, 1)
        }, 70)
    })
    test('Shorthand functions.', () => {
        bus.subscribe('test-3', listeners['shorthandListener'], 'sub-6', 'scope-4')
        bus.subscribe('test-4', listeners['shorthandListener'], 'sub-7', 'scope-4')
        bus.dispatchScopedEvent('test-3')
        bus.dispatchScopedEvent('test-4')
        setTimeout(() => {
            expect(listeners['shorthandListener']).toBeCalledTimes(2)
            bus.unsubscribe('test-3', listeners['shorthandListener'], 'sub-6')
            bus.dispatchScopedEvent('test-3')
            setTimeout(() => {
                expect(listeners['shorthandListener']).toBeCalledTimes(2)
                bus.unsubscribeAll('sub-7')
                bus.dispatchScopedEvent('test-4')
                setTimeout(() => {
                    expect(listeners['shorthandListener']).toBeCalledTimes(2)
                }, 1)
            }, 1)
        }, 1)
    })
    test('RegExp listeners.', () => {
        bus.addScopedEventListener(/^regex-\d$/, listeners['regexListener1'], 'regex-1', 'regex')
        bus.addScopedEventListener(/^regex-\d+$/, listeners['regexListener2'], 'regex-2', 'regex')
        bus.dispatchScopedEvent('regex-1')
        bus.dispatchScopedEvent('regex10')
        setTimeout(() => {
            expect(listeners['regexListener1']).toBeCalledTimes(1)
            expect(listeners['regexListener2']).toBeCalledTimes(2)
            bus.removeScope('regex')
        }, 1)
    })
})