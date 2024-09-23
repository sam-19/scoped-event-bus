/**
 * Event bus extension that exposes some internals for testing.
 * @package    scoped-event-bus
 * @copyright  2024 Sampsa Lohi
 * @license    MIT
 */

import EventBus from '../src/EventBus'

export default class EventBusTester extends EventBus {
    get subscribers () {
        return this._subscribers
    }
}