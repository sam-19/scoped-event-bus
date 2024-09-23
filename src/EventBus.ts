/**
 * Event bus.
 * @package    scoped-event-bus
 * @copyright  2024 Sampsa Lohi
 * @license    MIT
 */

import { getOrSetValue } from './util'
import {
    ScopedEventBus,
    type ScopedEventCallback,
    type ScopedEventListener,
    type ScopedEventListenerOptions,
    type ScopedEventPhase,
} from './types'

import EventTypes from './EventTypes'
export { EventTypes }


export default class EventBus extends EventTarget implements ScopedEventBus {
    protected _subscribers = new Map<string, ScopedEventListener[]>()
    addEventListener (type: string, callback: unknown, options?: unknown): void {
        if (typeof callback !== 'function') {
            return
        }
        const scopedOpts = options as ScopedEventListenerOptions
        if (options && typeof options === 'object' && scopedOpts.subscriber) {
            const scopedOpts = options as ScopedEventListenerOptions
            if (scopedOpts?.phase && scopedOpts.scope && scopedOpts.subscriber) {
                this.addScopedEventListener(
                    type,
                    callback as ScopedEventCallback,
                    scopedOpts.subscriber,
                    scopedOpts.scope,
                    scopedOpts.phase
                )
            } else {
                super.addEventListener(type, callback as EventListener, options)
            }
        } else {
            super.addEventListener(type, callback as EventListener, options as AddEventListenerOptions)
        }
    }
    addScopedEventListener (
        event: string|string[],
        callback: ScopedEventCallback,
        subscriber: string,
        scope?: string,
        phase: ScopedEventPhase = 'after',
    ) {
        if (!Array.isArray(event)) {
            event = [event]
        }
        event_loop:
        for (const e of event) {
            const subscribers = getOrSetValue(this._subscribers, e, [])
            for (let i=0; i<subscribers.length; i++) {
                const s = subscribers[i]
                if (
                    s.subscriber === subscriber &&
                    s.phase === phase &&
                    s.callback === callback
                ) {
                    if (!s.scope || s.scope === scope) {
                        // Don't add the same subscriber multiple times.
                        continue event_loop
                    } else if (!scope) {
                        // Replace all narrow context subscribers with the global context subscriber.
                        subscribers.splice(i, 1)
                    }
                }
            }
            subscribers.push({
                callback: callback,
                phase: phase,
                scope: scope,
                subscriber: subscriber,
            })
        }
        return () => this.removeScopedEventListener(event, callback, subscriber, scope, phase)
    }
    dispatchScopedEvent (
        event: string,
        scope?: string,
        phase: ScopedEventPhase = 'after',
        detail?: { [key: string]: unknown }
    ) {
        const e = new CustomEvent(event, { detail: { phase: phase, scope: scope, ...detail } })
        if (scope) {
            // Inform the listeners that are only subscribed to this scope.
            const subs = this._subscribers.get(event)
            if (subs) {
                for (const sub of subs) {
                    if (sub.scope === scope) {
                        sub.callback(e)
                    }
                }
            }
        }
        // Dispatch a global event if it is not a 'before' event that has been cancelled.
        if (phase === 'after' || !e.cancelable || !e.defaultPrevented) {
            return this.dispatchEvent(e)
        }
        return false
    }
    getEventHooks (event: string, subscriber: string, scope?: string) {
        const hooks = {
            after: (callback: ScopedEventCallback) => {
                this.subscribe(event, callback, subscriber, scope, 'after')
            },
            before: (callback: ScopedEventCallback) => {
                this.subscribe(event, callback, subscriber, scope, 'before')
            },
            unsubscribe: (phase?: ScopedEventPhase) => {
                const listeners = this._subscribers.get(event)
                if (listeners) {
                    for (let i=0; i<listeners.length; i++) {
                        const listener = listeners[i]
                        if (
                            listener.subscriber === subscriber && listener.scope === scope &&
                            (!phase || listener.phase === phase)
                        ) {
                            this.unsubscribe(event, listener.callback, subscriber, scope, listener.phase)
                            i--
                        }
                    }
                }
            }
        }
        return hooks
    }
    removeAllScopedEventListeners (subscriber: string, scope?: string) {
        for (const [key, subscribers] of this._subscribers) {
            for (let i=0; i<subscribers.length; i++) {
                if (
                    subscribers[i].subscriber === subscriber &&
                    (!scope || subscribers[i].scope === scope)
                ) {
                    subscribers.splice(i, 1)
                    if (!subscribers.length) {
                        // Remove empty keys from the map.
                        this._subscribers.delete(key)
                        break
                    }
                    i--
                }
            }
        }
    }
    removeEventListener (
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: unknown
    ): void {
        if (typeof callback !== 'function') {
            return
        }
        if (typeof options === 'object') {
            const scopedOpts = options as ScopedEventListenerOptions
            if (scopedOpts && typeof scopedOpts === 'object' && scopedOpts.subscriber) {
                this.removeScopedEventListener(
                    type, callback, scopedOpts.subscriber, scopedOpts.scope, scopedOpts.phase
                )
            } else {
                super.removeEventListener(type, callback, options as EventListenerOptions)
            }
        } else {
            super.removeEventListener(type, callback, options as EventListenerOptions)
        }
    }
    removeScope (scope: string) {
        for (const [key, subscribers] of this._subscribers) {
            for (let i=0; i<subscribers.length; i++) {
                if (subscribers[i].scope === scope) {
                    subscribers.splice(i, 1)
                    if (!subscribers.length) {
                        // Remove empty keys from the map.
                        this._subscribers.delete(key)
                        break
                    }
                    i--
                }
            }
        }
    }
    removeScopedEventListener (
        event: string|string[],
        callback: ScopedEventCallback,
        subscriber: string,
        scope?: string,
        phase?: ScopedEventPhase
    ) {
        if (!Array.isArray(event)) {
            event = [event]
        }
        for (const e of event) {
            const subscribers = this._subscribers.get(e)
            if (subscribers) {
                for (let i=0; i<subscribers.length; i++) {
                    if (
                        subscribers[i].callback === callback &&
                        subscribers[i].subscriber === subscriber &&
                        (!phase || subscribers[i].phase === phase) &&
                        (!scope || subscribers[i].scope === scope)
                    ) {
                        subscribers.splice(i, 1)
                        if (!subscribers.length) {
                            // Remove empty keys from the map.
                            this._subscribers.delete(e)
                        }
                        break
                    }
                }
            }
        }
    }
    subscribe = this.addScopedEventListener
    unsubscribe = this.removeScopedEventListener
    unsubscribeAll = this.removeAllScopedEventListeners
}