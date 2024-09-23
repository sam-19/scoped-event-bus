/**
 * Event types for the scoped event bus.
 * @package    scoped-event-bus
 * @copyright  2024 Sampsa Lohi
 * @license    MIT
 */

/**
 * This enum holds valid event types.
 *
 * You can extend it according to your needs:
 * ```
 * import EventTypes from ...
 * // List your own event types in another enum.
 * enum MyEventTypes {
 *   SOME_EVENT = 'some-event'
 * }
 * // Combine the types and the actual events.
 * type AllEventTypes = EventTypes | MyEventTypes
 * const ALL_EVENTS = { ...EventTypes, ...MyEventTypes }
 * ```
 */
export enum EventTypes {
    EVENTBUS_READY = 'eventbus-ready',
}

export default EventTypes