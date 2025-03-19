/**
 * Event bus.
 * @package    scoped-event-bus
 * @copyright  2024 Sampsa Lohi
 * @license    MIT
 */

import { getOrSetValue } from './util'
import type {
    ScopedEventBus,
    ScopedEventCallback,
    ScopedEventListener,
    ScopedEventListenerOptions,
    ScopedEventPhase,
} from './types'

import EventTypes from './EventTypes'
export { EventTypes }


export default class EventBus extends EventTarget implements ScopedEventBus {

    _debugCallback = null as null|ScopedEventCallback
    _patterns = new Map<string, { listener: ScopedEventListener, pattern: RegExp }[]>()
    _subscribers = new Map<string, ScopedEventListener[]>()

    set debugCallback (value: null|ScopedEventCallback) {
        this._debugCallback = value
    }
    get debugCallback () {
        return this._debugCallback
    }

    /**
     * Check if the given `listener` matches the given parameters.
     * @param listener - The listener to check.
     * @param callback - Event callback function.
     * @param subscriber - Name of the subscriber.
     * @param scope - Optional scope of the event.
     * @param phase - Optional phase of the event.
     * @returns `true` if matches, `false` otherwise.
     */
    #isListenerMatch (
        listener: ScopedEventListener,
        callback: ScopedEventCallback,
        subscriber: string,
        scope?: string,
        phase?: ScopedEventPhase,
    ) {
        return (
            listener.callback === callback &&
            listener.subscriber === subscriber &&
            (!phase || listener.phase === phase) &&
            (!scope || listener.scope === scope)
        )
    }

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
        event: string|RegExp|(string|RegExp)[],
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
            if (typeof e === 'string') {
                const subscribers = getOrSetValue(this._subscribers, e, [])
                for (let i=0; i<subscribers.length; i++) {
                    const s = subscribers[i]
                    if (this.#isListenerMatch(s, callback, subscriber, scope, phase)) {
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
            } else if (scope) {
                const regexes = getOrSetValue(this._patterns, scope, [])
                for (let i=0; i<regexes.length; i++) {
                    const r = regexes[i]
                    if (
                        this.#isListenerMatch(r.listener, callback, subscriber, scope, phase) &&
                        r.pattern.source === e.source
                    ) {
                        // Don't add the same subscriber multiple times.
                        continue event_loop
                    }
                }
                regexes.push({
                    listener: {
                        callback: callback,
                        phase: phase,
                        scope: scope,
                        subscriber: subscriber,
                    },
                    pattern: e,
                })
            }
        }
        return () => this.removeScopedEventListener(event, callback, subscriber, scope, phase)
    }
    dispatchEvent (event: Event): boolean {
        if (this._debugCallback) {
            this._debugCallback({ ...event, detail: { phase: 'after' } })
        }
        return super.dispatchEvent(event)
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
                    if (sub.scope === scope && sub.phase === phase) {
                        sub.callback(e)
                    }
                }
            }
            // See if this scope has any patterned listeners and inform those.
            const patterns = this._patterns.get(scope)
            if (patterns) {
                for (const regex of patterns) {
                    if (event.match(regex.pattern) && regex.listener.phase === phase) {
                        regex.listener.callback(e)
                    }
                }
            }
        }
        // Relay event to possible debug listener.
        if (this._debugCallback) {
            this._debugCallback(e)
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
                this.addScopedEventListener(event, callback, subscriber, scope, 'after')
            },
            before: (callback: ScopedEventCallback) => {
                this.addScopedEventListener(event, callback, subscriber, scope, 'before')
            },
            unsubscribe: (phase?: ScopedEventPhase) => {
                const listeners = this._subscribers.get(event)
                if (listeners) {
                    for (const listener of [...listeners]) {
                        this.removeScopedEventListener(event, listener.callback, subscriber, scope, phase)
                    }
                }
                if (scope) {
                    const regexes = this._patterns.get(scope)
                    if (regexes) {
                        for (const regex of [...regexes]) {
                            this.removeScopedEventListener(event, regex.listener.callback, subscriber, scope, phase)
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
        if (scope) {
            const regexes = this._patterns.get(scope)
            if (regexes) {
                for (let i=0; i<regexes.length; i++) {
                    if (regexes[i].listener.subscriber === subscriber) {
                        regexes.splice(i, 1)
                        if (!regexes.length) {
                            // Remove empty keys from the map.
                            this._subscribers.delete(scope)
                            break
                        }
                        i--
                    }
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
        this._patterns.delete(scope)
    }
    removeScopedEventListener (
        event: string|RegExp|(string|RegExp)[],
        callback: ScopedEventCallback,
        subscriber: string,
        scope?: string,
        phase?: ScopedEventPhase
    ) {
        if (!Array.isArray(event)) {
            event = [event]
        }
        for (const e of event) {
            if (typeof e === 'string') {
                const subscribers = this._subscribers.get(e)
                if (subscribers) {
                    for (let i=0; i<subscribers.length; i++) {
                        if (this.#isListenerMatch(subscribers[i], callback, subscriber, scope, phase)) {
                            subscribers.splice(i, 1)
                            if (!subscribers.length) {
                                // Remove empty keys from the map.
                                this._subscribers.delete(e)
                            }
                            break
                        }
                    }
                }
            } else if (scope) {
                const regexes = this._patterns.get(scope)
                if (regexes) {
                    for (let i=0; i<regexes.length; i++) {
                        if (
                            this.#isListenerMatch(regexes[i].listener, callback, subscriber, scope, phase) &&
                            regexes[i].pattern.source === e.source
                        ) {
                            regexes.splice(i, 1)
                            if (!regexes.length) {
                                // Remove empty keys from the map.
                                this._patterns.delete(scope)
                            }
                        }
                    }
                }
            }
        }
    }
    subscribe = this.addScopedEventListener
    unsubscribe = this.removeScopedEventListener
    unsubscribeAll = this.removeAllScopedEventListeners
}
