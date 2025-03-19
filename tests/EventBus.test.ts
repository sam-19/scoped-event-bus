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
    'debug',
    'global',
    'scoped1',
    'scoped2',
    'scoped3',
    'custom',
    'beforeSubscriber',
    'afterSubscriber',
    'shorthand',
    'unsubscriber',
    'regex1',
    'regex2',
    'regex3',
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
        bus.debugCallback = listeners['debug']
        bus.addEventListener('test', listeners['global'])
    })
    test('Global events via EventTarget.', async () => {
        bus.dispatchScopedEvent('test')
        setTimeout(() => {
            expect(listeners['global']).toBeCalledTimes(1)
            expect(scopeMap.keys()).toEqual(['test'])
            expect(scopeMap.get('test')).toStrictEqual(1)
            bus.dispatchScopedEvent('test2')
            setTimeout(() => {
                expect(listeners['global']).toBeCalledTimes(1)
            }, 1)
        }, 1)
    })
    test('Scoped events.', () => {
        setTimeout(() => {
            bus.addScopedEventListener('test', listeners['scoped1'], 'sub-1', 'scope-1')
            expect(bus.subscribers.get('test')?.length).toEqual(1)
            bus.dispatchScopedEvent('test', 'scope-1')
            setTimeout(() => {
                expect(listeners['global']).toBeCalledTimes(2)
                expect(listeners['scoped1']).toBeCalledTimes(1)
                expect(scopeMap.keys()).toEqual(['test'])
                expect(scopeMap.get('test')).toStrictEqual(3)
                bus.addScopedEventListener('test', listeners['scoped2'], 'sub-1', 'scope-2')
                expect(bus.subscribers.get('test')?.length).toEqual(2)
                bus.dispatchScopedEvent('test', 'scope-2')
                setTimeout(() => {
                    expect(listeners['global']).toBeCalledTimes(3)
                    expect(listeners['scoped1']).toBeCalledTimes(1)
                    expect(listeners['scoped2']).toBeCalledTimes(1)
                    expect(scopeMap.keys()).toEqual(['test'])
                    expect(scopeMap.get('test')).toStrictEqual(5)
                }, 1)
            }, 1)
        }, 10)
    })
    test('Remove listener.', () => {
        setTimeout(() => {
            bus.addScopedEventListener('test', listeners['scoped3'], 'sub-2', 'scope-3')
            expect(bus.subscribers.get('test')?.length).toEqual(3)
            bus.dispatchScopedEvent('test', 'scope-3')
            bus.dispatchScopedEvent('test', 'scope-2')
            setTimeout(() => {
                expect(listeners['global']).toBeCalledTimes(4)
                expect(listeners['scoped2']).toBeCalledTimes(2)
                expect(listeners['scoped3']).toBeCalledTimes(1)
                bus.removeEventListener('test', listeners['scoped3'])
                expect(bus.subscribers.get('test')?.length).toEqual(2)
                bus.dispatchScopedEvent('test', 'scope-3')
                setTimeout(() => {
                    expect(listeners['global']).toBeCalledTimes(5)
                    expect(listeners['scoped3']).toBeCalledTimes(1)
                }, 1)
            }, 1)
        }, 20)
    })
    test('Remove scoped listener.', () => {
        setTimeout(() => {
            bus.removeScopedEventListener('test', listeners['scoped2'], 'sub-1', 'scope-2')
            expect(bus.subscribers.get('test')?.length).toEqual(1)
            bus.dispatchScopedEvent('test', 'scope-2')
            setTimeout(() => {
                expect(listeners['global']).toBeCalledTimes(5)
                expect(listeners['scoped2']).toBeCalledTimes(2)
                bus.addScopedEventListener('test', listeners['scoped2'], 'sub-1', 'scope-2')
                expect(bus.subscribers.get('test')?.length).toEqual(2)
                bus.dispatchScopedEvent('test', 'scope-2')
                setTimeout(() => {
                    expect(listeners['scoped2']).toBeCalledTimes(3)
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
                expect(listeners['scoped1']).toBeCalledTimes(1)
                expect(listeners['scoped2']).toBeCalledTimes(3)
                bus.addScopedEventListener('test', listeners['scoped1'], 'sub-1', 'scope-1')
                bus.addScopedEventListener('test', listeners['scoped2'], 'sub-1', 'scope-2')
                expect(bus.subscribers.get('test')?.length).toEqual(3)
            }, 1)
        }, 40)
    })
    test('Remove entire scope.', () => {
        setTimeout(() => {
            bus.removeScope('scope-1')
            bus.dispatchScopedEvent('test', 'scope-1')
            setTimeout(() => {
                expect(listeners['scoped1']).toBeCalledTimes(1)
                expect(bus.subscribers.get('test')?.length).toEqual(2)
            }, 1)
        }, 50)
    })
    test('Custom event details.', () => {
        setTimeout(() => {
            bus.addScopedEventListener('test', listeners['custom'], 'sub-4', 'scope-1')
            bus.dispatchScopedEvent('test', 'scope-1', 'after', { customProperty: true })
            setTimeout(() => {
                expect(listeners['custom']).toBeCalledTimes(1)
                expect(customProperty).toStrictEqual(true)
            }, 1)
        }, 60)
    })
    test('Event hooks.', () => {
        setTimeout(() => {
            listeners['global'].mockReset()
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
                        expect(listeners['global']).toBeCalledTimes(0)
                    }, 1)
                }, 1)
            }, 1)
        }, 70)
    })
    test('Shorthand functions.', () => {
        bus.subscribe('test-3', listeners['shorthand'], 'sub-6', 'scope-4')
        bus.subscribe('test-4', listeners['shorthand'], 'sub-7', 'scope-4')
        bus.dispatchScopedEvent('test-3')
        bus.dispatchScopedEvent('test-4')
        setTimeout(() => {
            expect(listeners['shorthand']).toBeCalledTimes(2)
            bus.unsubscribe('test-3', listeners['shorthand'], 'sub-6')
            bus.dispatchScopedEvent('test-3')
            setTimeout(() => {
                expect(listeners['shorthand']).toBeCalledTimes(2)
                bus.unsubscribeAll('sub-7')
                bus.dispatchScopedEvent('test-4')
                setTimeout(() => {
                    expect(listeners['shorthand']).toBeCalledTimes(2)
                }, 1)
            }, 1)
        }, 1)
    })
    test('RegExp listeners.', () => {
        bus.addScopedEventListener(/^regex-\d$/, listeners['regex1'], 'regex-1', 'regex')
        bus.addScopedEventListener(/^regex-\d+$/, listeners['regex2'], 'regex-2', 'regex')
        bus.dispatchScopedEvent('regex-1')
        bus.dispatchScopedEvent('regex10')
        setTimeout(() => {
            expect(listeners['regex1']).toBeCalledTimes(1)
            expect(listeners['regex2']).toBeCalledTimes(2)
            bus.removeScope('regex')
        }, 1)
    })
    test('Debug listener.', () => {
        expect(listeners['debug']).toBeCalledTimes(10)
    })
})
