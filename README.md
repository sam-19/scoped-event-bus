Scoped Event Bus
================

## Installation

`npm i scoped-event-bus`

## Basic usage

```javascript
import EventBus from 'scoped-event-bus'

const bus = new EventBus()
// Vanilla JavaScript event listener.
bus.addEventListener('some-event', (event) => {
    console.log('Generic event.')
    // Do something...
})
// Scoped event listener will only trigger on events dispatched from the same scope.
bus.addScopedEventListener(
    'some-event',
    (event) => {
        console.log('Scoped event.')
        // Do something...
    },
    'some-source', // This merely identifies the source of the listener.
    'some-scope' // This is the scope of the events.
)
// Now we dispatch some event.
bus.dispatchScopedEvent('some-event', 'some-scope')
/* Console:
 * > Generic event.
 * > Scoped event.
 */
// Omitting scope will make the event behave like an ordinary JavaScipt CustomEvent.
bus.dispatchScopedEvent('some-event')
/* Console:
 * > Generic event.
 */
```