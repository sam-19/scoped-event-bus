/**
 * Scoped event bus types.
 * @package    scoped-event-bus
 * @copyright  2024 Sampsa Lohi
 * @license    MIT
 */

/**
 * Scoped event bus is an extension of JavaScript's `EventTarget`.
 *
 * It implements the same `addEventListener` and `removeEventListener` methods and allows setting listeners for events
 * originating from specific _scopes_ of the application. Such scoped event listeners will additionally include the
 * name of the event _subscriber_, an identifier of the object or script the listener belongs to. Listeners can be
 * matched against a subscriber's name for mass removal.
 *
 * In addition to the `scope` and `subscriber` properties, the ScopedEventBus also supports adding separate listeners
 * for _before_ and _after_ an event occurs. Obviously, not all event emitters are required support this feature.\
 * Broadcasting events _before_ they happen allows other parts of the application to prevent the event from carrying
 * out by calling the `preventDefault()` method (may be useful e.g. for checking complex requirements).
 *
 * Although the name of this package is **scoped** event bus, the scope of an event is always optional; if no scope
 * is declared, the event is treated as a custom event by the inherited EventTarget.
 */
export interface ScopedEventBus {
    /**
     * Debug callback for verbose logging of all events.
     *
     * **NOTE!** Depending on the implementation, debug feedback may generate a large amount of console log output, may
     * expose sensitive event detail information, and use excessive amounts of memory. Not to be used in production.
     */
    debugCallback: null|ScopedEventCallback
    /**
     * Appends an event listener for events whose type attribute value is `type`. The callback argument sets the
     * `callback` that will be invoked when the event is dispatched.
     *
     * The `options` argument sets listener-specific options. For compatibility this can be a boolean, in which case
     * the method behaves exactly as if the value was specified as `options`'s capture.
     *
     * When set to true, `options`'s capture prevents `callback` from being invoked when the event's eventPhase
     * attribute value is `BUBBLING_PHASE`. When false (or not present), `callback` will not be invoked when event's
     * eventPhase attribute value is `CAPTURING_PHASE`. Either way, `callback` will be invoked if event's eventPhase
     * attribute value is `AT_TARGET`.
     *
     * When set to true, `options`'s passive indicates that the `callback` will not cancel the event by invoking
     * `preventDefault()`. This is used to enable performance optimizations described in § 2.8 Observing event
     * listeners.
     *
     * When set to true, `options`'s once indicates that the `callback` will only be invoked once after which the event
     * listener will be removed.
     *
     * For a **scoped** event listener, the `options` object must include the name of the `subscriber` and optionally
     * the event `phase` when the callback should be fired (default is _after_):
     * `{ subscriber: string, phase?: 'before' | 'after' }`.
     *
     * If an AbortSignal is passed for `options`'s signal, then the event listener will be removed when signal is
     * aborted.
     *
     * The event listener is appended to target's event listener list and is not appended if it has the same type,
     * callback, and capture.
     * @param type - Type (name) of the event.
     * @param callback - Method to call when the event occurs.
     * @param options - Optional event listener options.
     */
    addEventListener: EventTarget['addEventListener']
    /**
     * Add a listener for an `event` or list of events. The listener can optionally be limited to trigger only if the
     * event originates from a specific `scope`.
     * @param event - Event or list of events to listen for, as either string (for exact match) or RegExp.
     * @param callback - Method to call when event occurs.
     * @param subscriber - Name of the subscriber.
     * @param scope - Optional scope to limit the listener to (omitted will listen to all scopes).
     * @param phase - Event phase to trigger the callback in (optional, default _after_).
     * @returns A method to remove the added event listener(s).
     */
    addScopedEventListener (
        event: string|RegExp|(string|RegExp)[],
        callback: ScopedEventCallback,
        subscriber: string,
        scope?: string,
        phase?: ScopedEventPhase,
    ): ScopedEventUnsubscriber
    /**
     * Dispatch an `event` that can optinally declare a specific `scope`.
     * @param event - Name of the event.
     * @param scope - Optional scope where the event originates from.
     * @param phase - Event phase (optional, default _after_).
     * @param detail - Optional `CustomEvent` details.
     * @returns True if the event was not canceled, false if it was.
     */
    dispatchScopedEvent (
        event: string,
        scope?: string,
        phase?: ScopedEventPhase,
        detail?: { [key: string]: unknown },
    ): boolean
    /**
     * Get methods for adding listeners to the `before` and `after` phases of a specific `event`.
     * The `unsubscribe` method returned alongside the hooks can be used to unsubscribe from both phases.
     * @param event - Name of the event.
     * @param subscriber - Name of the subscriber.
     * @param scope - Optional scope to limit the hooks to.
     */
    getEventHooks (event: string, subscriber: string, scope?: string): ScopedEventHooks
    /**
     * Remove all event listeners by the `subscriber`, optinally limited to a specific `scope`.
     * @param subscriber - Name of the subscriber.
     * @param scope - Optional scope of the listeners (omitted will match any scope).
     */
    removeAllScopedEventListeners (subscriber: string, scope?: string): void
    /**
     * Removes the event listener in target's event listener list with the same `type`, `callback`, and `options`.
     * @param type - Type (name) of the event.
     * @param callback - The callback to remove.
     * @param options - Optional `removeEventListener` options.
     */
    removeEventListener: EventTarget['removeEventListener']
    /**
     * Remove all event listeners registered to the given `scope` and remove the `scope`'s entry from listener map.
     * @param scope - Name of the scope.
     */
    removeScope (scope: string): void
    /**
     * Remove the listener for the given `event`(s).
     * @param event - Event or list of events to match.
     * @param callback - Callback of the listener.
     * @param subscriber - Name of the subscriber.
     * @param scope - Optional scope of the listener (omitted will match any scope).
     * @param phase - Optional phase of the event (omitted or undefined will match any phase).
     */
    removeScopedEventListener (
        event: string|RegExp|(string|RegExp)[],
        callback: ScopedEventCallback,
        subscriber: string,
        scope?: string,
        phase?: ScopedEventPhase,
    ): void
    /**
     * Alias for `addScopedEventListener`.
     */
    subscribe: ScopedEventBus['addScopedEventListener']
    /**
     * Alias for `removeScopedEventListener`.
     */
    unsubscribe: ScopedEventBus['removeScopedEventListener']
    /**
     * Alias for `removeAllScopedEventListeners`.
     */
    unsubscribeAll: ScopedEventBus['removeAllScopedEventListeners']
}
/**
 * CustomEvent `detail` properties for scoped events.
 */
export type ScopedEvent = Event & {
    detail: {
        phase: ScopedEventPhase
        scope?: string
        [key: string]: unknown
    }
}
/**
 * Callback function for scoped events.
 */
export type ScopedEventCallback = (event: ScopedEvent) => void
/**
 * Hooks for setting listeners for the `before` and `after` phases of the event.
 *
 * `unsubscribe()` will remove this subscriber's listeners for a specific `phase`, or all listeners if omitted.
 * It does not keep track which listeners were set with the `before` and `after` methods, but will simply remove any
 * listeners added by this subscriber.
 *
 * @example
 * hooks.before((event) => {
 *   // Do something before the event carries out.
 *   event.preventDefault() // May cancel the event before it finishes.
 * })
 * hooks.after((event) => {
 *   // React to an event that has occurred (default JavaScript event listener behaviour).
 * })
 * ...
 * // Finally, remove all listeners.
 * hooks.unsubscribe()
 */
export type ScopedEventHooks = {
    /**
     * Add a `callback` to be executed before the event takes place.
     * @param callback - The callback to execute.
     */
    after: (callback: ScopedEventCallback) => void
    /**
     * Add a `callback` to be executed after the event has taken place.
     * @param callback - The callback to execute.
     */
    before: (callback: ScopedEventCallback) => void
    /**
     * Remove all event listeners for this subscriber, optionally for the given `phase`.
     */
    unsubscribe: ScopedEventUnsubscriber
}
/**
 * A listener entry in the event bus listener map.
 */
export type ScopedEventListener = {
    callback: ScopedEventCallback
    phase: ScopedEventPhase
    scope?: string
    subscriber?: string,
}
/**
 * Event listener options specific to scoped event listeners.
 */
export type ScopedEventListenerOptions = {
    phase?: ScopedEventPhase
    scope?: string
    subscriber?: string
}
/**
 * Phase of the scoped event.
 */
export type ScopedEventPhase = 'after' | 'before'
/**
 * Calling this method will remove the event listeners added by the `subscribe` method that returned it.
 */
export type ScopedEventUnsubscriber = (phase?: ScopedEventPhase) => void
