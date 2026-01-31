# Class: GeminiAgent

Agent for Google Gemini models.

## Example

```typescript
const agent = new GeminiAgent({
  id: "1",
  name: "Assistant",
  description: "A helpful assistant",
  apiKey: process.env.GOOGLE_API_KEY,
});

const response = await agent.execute("Hello!");
```

## Extends

- [`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md)

## Constructors

### Constructor

> **new GeminiAgent**(`config`, `history?`): `GeminiAgent`

#### Parameters

##### config

`Omit`\<`AgentConfig`, `"vendor"`\>

##### history?

[`History`](../../../../history/History/classes/History.md)

#### Returns

`GeminiAgent`

#### Overrides

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`constructor`](../../../BaseAgent/classes/BaseAgent.md#constructor)

## Properties

### lastTokenUsage?

> `optional` **lastTokenUsage**: [`TokenUsage`](../../../BaseAgent/type-aliases/TokenUsage.md)

Token usage from the last execution (for metrics tracking)

***

### captureRejections

> `static` **captureRejections**: `boolean`

Sets or gets the default captureRejection value for all emitters.

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`captureRejections`](../../../BaseAgent/classes/BaseAgent.md#capturerejections)

***

### captureRejectionSymbol

> `readonly` `static` **captureRejectionSymbol**: *typeof* [`captureRejectionSymbol`](../../../BaseAgent/classes/BaseAgent.md#capturerejectionsymbol)

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`captureRejectionSymbol`](../../../BaseAgent/classes/BaseAgent.md#capturerejectionsymbol)

***

### defaultMaxListeners

> `static` **defaultMaxListeners**: `number`

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`defaultMaxListeners`](../../../BaseAgent/classes/BaseAgent.md#defaultmaxlisteners)

***

### errorMonitor

> `readonly` `static` **errorMonitor**: *typeof* [`errorMonitor`](../../../BaseAgent/classes/BaseAgent.md#errormonitor)

This symbol shall be used to install a listener for only monitoring `'error'`
events. Listeners installed using this symbol are called before the regular
`'error'` listeners are called.

Installing a listener using this symbol does not change the behavior once an
`'error'` event is emitted, therefore the process will still crash if no
regular `'error'` listener is installed.

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`errorMonitor`](../../../BaseAgent/classes/BaseAgent.md#errormonitor)

## Methods

### \[captureRejectionSymbol\]()?

> `optional` **\[captureRejectionSymbol\]**\<`K`\>(`error`, `event`, ...`args`): `void`

#### Type Parameters

##### K

`K`

#### Parameters

##### error

`Error`

##### event

`string` | `symbol`

##### args

...`AnyRest`

#### Returns

`void`

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`[captureRejectionSymbol]`](../../../BaseAgent/classes/BaseAgent.md#capturerejectionsymbol-1)

***

### addListener()

> **addListener**\<`K`\>(`eventName`, `listener`): `this`

Alias for `emitter.on(eventName, listener)`.

#### Type Parameters

##### K

`K`

#### Parameters

##### eventName

`string` | `symbol`

##### listener

(...`args`) => `void`

#### Returns

`this`

#### Since

v0.1.26

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`addListener`](../../../BaseAgent/classes/BaseAgent.md#addlistener)

***

### addTools()

> **addTools**(`tools`): `void`

#### Parameters

##### tools

[`Tool`](../../../../tools/Tool/classes/Tool.md)\<`unknown`\>[]

#### Returns

`void`

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`addTools`](../../../BaseAgent/classes/BaseAgent.md#addtools)

***

### clearHistory()

> **clearHistory**(): `void`

#### Returns

`void`

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`clearHistory`](../../../BaseAgent/classes/BaseAgent.md#clearhistory)

***

### emit()

> **emit**\<`K`\>(`eventName`, ...`args`): `boolean`

Synchronously calls each of the listeners registered for the event named`eventName`, in the order they were registered, passing the supplied arguments
to each.

Returns `true` if the event had listeners, `false` otherwise.

```js
import EventEmitter from 'node:events';
const myEmitter = new EventEmitter();

// First listener
myEmitter.on('event', function firstListener() {
  console.log('Helloooo! first listener');
});
// Second listener
myEmitter.on('event', function secondListener(arg1, arg2) {
  console.log(`event with parameters ${arg1}, ${arg2} in second listener`);
});
// Third listener
myEmitter.on('event', function thirdListener(...args) {
  const parameters = args.join(', ');
  console.log(`event with parameters ${parameters} in third listener`);
});

console.log(myEmitter.listeners('event'));

myEmitter.emit('event', 1, 2, 3, 4, 5);

// Prints:
// [
//   [Function: firstListener],
//   [Function: secondListener],
//   [Function: thirdListener]
// ]
// Helloooo! first listener
// event with parameters 1, 2 in second listener
// event with parameters 1, 2, 3, 4, 5 in third listener
```

#### Type Parameters

##### K

`K`

#### Parameters

##### eventName

`string` | `symbol`

##### args

...`AnyRest`

#### Returns

`boolean`

#### Since

v0.1.26

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`emit`](../../../BaseAgent/classes/BaseAgent.md#emit)

***

### eventNames()

> **eventNames**(): (`string` \| `symbol`)[]

Returns an array listing the events for which the emitter has registered
listeners. The values in the array are strings or `Symbol`s.

```js
import EventEmitter from 'node:events';
const myEE = new EventEmitter();
myEE.on('foo', () => {});
myEE.on('bar', () => {});

const sym = Symbol('symbol');
myEE.on(sym, () => {});

console.log(myEE.eventNames());
// Prints: [ 'foo', 'bar', Symbol(symbol) ]
```

#### Returns

(`string` \| `symbol`)[]

#### Since

v6.0.0

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`eventNames`](../../../BaseAgent/classes/BaseAgent.md#eventnames)

***

### execute()

> **execute**(`input`): `Promise`\<`string`\>

#### Parameters

##### input

`string`

#### Returns

`Promise`\<`string`\>

#### Overrides

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`execute`](../../../BaseAgent/classes/BaseAgent.md#execute)

***

### getDescription()

> **getDescription**(): `string`

#### Returns

`string`

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`getDescription`](../../../BaseAgent/classes/BaseAgent.md#getdescription)

***

### getHistoryEntries()

> **getHistoryEntries**(): [`HistoryEntry`](../../../../history/types/type-aliases/HistoryEntry.md)[]

#### Returns

[`HistoryEntry`](../../../../history/types/type-aliases/HistoryEntry.md)[]

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`getHistoryEntries`](../../../BaseAgent/classes/BaseAgent.md#gethistoryentries)

***

### getId()

> **getId**(): `string`

#### Returns

`string`

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`getId`](../../../BaseAgent/classes/BaseAgent.md#getid)

***

### getMaxListeners()

> **getMaxListeners**(): `number`

Returns the current max listener value for the `EventEmitter` which is either
set by `emitter.setMaxListeners(n)` or defaults to [EventEmitter.defaultMaxListeners](../../../BaseAgent/classes/BaseAgent.md#defaultmaxlisteners).

#### Returns

`number`

#### Since

v1.0.0

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`getMaxListeners`](../../../BaseAgent/classes/BaseAgent.md#getmaxlisteners)

***

### getModel()

> **getModel**(): `string`

#### Returns

`string`

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`getModel`](../../../BaseAgent/classes/BaseAgent.md#getmodel)

***

### getName()

> **getName**(): `string`

#### Returns

`string`

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`getName`](../../../BaseAgent/classes/BaseAgent.md#getname)

***

### getTools()

> **getTools**(): [`Tool`](../../../../tools/Tool/classes/Tool.md)\<`unknown`\>[]

#### Returns

[`Tool`](../../../../tools/Tool/classes/Tool.md)\<`unknown`\>[]

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`getTools`](../../../BaseAgent/classes/BaseAgent.md#gettools)

***

### getVendor()

> **getVendor**(): [`AgentVendor`](../../../AgentConfig/type-aliases/AgentVendor.md)

#### Returns

[`AgentVendor`](../../../AgentConfig/type-aliases/AgentVendor.md)

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`getVendor`](../../../BaseAgent/classes/BaseAgent.md#getvendor)

***

### listenerCount()

> **listenerCount**\<`K`\>(`eventName`, `listener?`): `number`

Returns the number of listeners listening to the event named `eventName`.

If `listener` is provided, it will return how many times the listener
is found in the list of the listeners of the event.

#### Type Parameters

##### K

`K`

#### Parameters

##### eventName

The name of the event being listened for

`string` | `symbol`

##### listener?

`Function`

The event handler function

#### Returns

`number`

#### Since

v3.2.0

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`listenerCount`](../../../BaseAgent/classes/BaseAgent.md#listenercount)

***

### listeners()

> **listeners**\<`K`\>(`eventName`): `Function`[]

Returns a copy of the array of listeners for the event named `eventName`.

```js
server.on('connection', (stream) => {
  console.log('someone connected!');
});
console.log(util.inspect(server.listeners('connection')));
// Prints: [ [Function] ]
```

#### Type Parameters

##### K

`K`

#### Parameters

##### eventName

`string` | `symbol`

#### Returns

`Function`[]

#### Since

v0.1.26

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`listeners`](../../../BaseAgent/classes/BaseAgent.md#listeners)

***

### off()

> **off**\<`K`\>(`eventName`, `listener`): `this`

Alias for `emitter.removeListener()`.

#### Type Parameters

##### K

`K`

#### Parameters

##### eventName

`string` | `symbol`

##### listener

(...`args`) => `void`

#### Returns

`this`

#### Since

v10.0.0

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`off`](../../../BaseAgent/classes/BaseAgent.md#off)

***

### on()

> **on**\<`K`\>(`eventName`, `listener`): `this`

Adds the `listener` function to the end of the listeners array for the
event named `eventName`. No checks are made to see if the `listener` has
already been added. Multiple calls passing the same combination of `eventName` and `listener` will result in the `listener` being added, and called, multiple
times.

```js
server.on('connection', (stream) => {
  console.log('someone connected!');
});
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

By default, event listeners are invoked in the order they are added. The`emitter.prependListener()` method can be used as an alternative to add the
event listener to the beginning of the listeners array.

```js
const myEE = new EventEmitter();
myEE.on('foo', () => console.log('a'));
myEE.prependListener('foo', () => console.log('b'));
myEE.emit('foo');
// Prints:
//   b
//   a
```

#### Type Parameters

##### K

`K`

#### Parameters

##### eventName

The name of the event.

`string` | `symbol`

##### listener

(...`args`) => `void`

The callback function

#### Returns

`this`

#### Since

v0.1.101

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`on`](../../../BaseAgent/classes/BaseAgent.md#on)

***

### once()

> **once**\<`K`\>(`eventName`, `listener`): `this`

Adds a **one-time**`listener` function for the event named `eventName`. The
next time `eventName` is triggered, this listener is removed and then invoked.

```js
server.once('connection', (stream) => {
  console.log('Ah, we have our first user!');
});
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

By default, event listeners are invoked in the order they are added. The`emitter.prependOnceListener()` method can be used as an alternative to add the
event listener to the beginning of the listeners array.

```js
const myEE = new EventEmitter();
myEE.once('foo', () => console.log('a'));
myEE.prependOnceListener('foo', () => console.log('b'));
myEE.emit('foo');
// Prints:
//   b
//   a
```

#### Type Parameters

##### K

`K`

#### Parameters

##### eventName

The name of the event.

`string` | `symbol`

##### listener

(...`args`) => `void`

The callback function

#### Returns

`this`

#### Since

v0.3.0

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`once`](../../../BaseAgent/classes/BaseAgent.md#once)

***

### prependListener()

> **prependListener**\<`K`\>(`eventName`, `listener`): `this`

Adds the `listener` function to the _beginning_ of the listeners array for the
event named `eventName`. No checks are made to see if the `listener` has
already been added. Multiple calls passing the same combination of `eventName` and `listener` will result in the `listener` being added, and called, multiple
times.

```js
server.prependListener('connection', (stream) => {
  console.log('someone connected!');
});
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Type Parameters

##### K

`K`

#### Parameters

##### eventName

The name of the event.

`string` | `symbol`

##### listener

(...`args`) => `void`

The callback function

#### Returns

`this`

#### Since

v6.0.0

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`prependListener`](../../../BaseAgent/classes/BaseAgent.md#prependlistener)

***

### prependOnceListener()

> **prependOnceListener**\<`K`\>(`eventName`, `listener`): `this`

Adds a **one-time**`listener` function for the event named `eventName` to the _beginning_ of the listeners array. The next time `eventName` is triggered, this
listener is removed, and then invoked.

```js
server.prependOnceListener('connection', (stream) => {
  console.log('Ah, we have our first user!');
});
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Type Parameters

##### K

`K`

#### Parameters

##### eventName

The name of the event.

`string` | `symbol`

##### listener

(...`args`) => `void`

The callback function

#### Returns

`this`

#### Since

v6.0.0

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`prependOnceListener`](../../../BaseAgent/classes/BaseAgent.md#prependoncelistener)

***

### rawListeners()

> **rawListeners**\<`K`\>(`eventName`): `Function`[]

Returns a copy of the array of listeners for the event named `eventName`,
including any wrappers (such as those created by `.once()`).

```js
const emitter = new EventEmitter();
emitter.once('log', () => console.log('log once'));

// Returns a new Array with a function `onceWrapper` which has a property
// `listener` which contains the original listener bound above
const listeners = emitter.rawListeners('log');
const logFnWrapper = listeners[0];

// Logs "log once" to the console and does not unbind the `once` event
logFnWrapper.listener();

// Logs "log once" to the console and removes the listener
logFnWrapper();

emitter.on('log', () => console.log('log persistently'));
// Will return a new Array with a single function bound by `.on()` above
const newListeners = emitter.rawListeners('log');

// Logs "log persistently" twice
newListeners[0]();
emitter.emit('log');
```

#### Type Parameters

##### K

`K`

#### Parameters

##### eventName

`string` | `symbol`

#### Returns

`Function`[]

#### Since

v9.4.0

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`rawListeners`](../../../BaseAgent/classes/BaseAgent.md#rawlisteners)

***

### removeAllListeners()

> **removeAllListeners**(`event?`): `this`

Removes all listeners, or those of the specified `eventName`.

It is bad practice to remove listeners added elsewhere in the code,
particularly when the `EventEmitter` instance was created by some other
component or module (e.g. sockets or file streams).

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Parameters

##### event?

`string` | `symbol`

#### Returns

`this`

#### Since

v0.1.26

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`removeAllListeners`](../../../BaseAgent/classes/BaseAgent.md#removealllisteners)

***

### removeListener()

> **removeListener**\<`K`\>(`eventName`, `listener`): `this`

Removes the specified `listener` from the listener array for the event named`eventName`.

```js
const callback = (stream) => {
  console.log('someone connected!');
};
server.on('connection', callback);
// ...
server.removeListener('connection', callback);
```

`removeListener()` will remove, at most, one instance of a listener from the
listener array. If any single listener has been added multiple times to the
listener array for the specified `eventName`, then `removeListener()` must be
called multiple times to remove each instance.

Once an event is emitted, all listeners attached to it at the
time of emitting are called in order. This implies that any`removeListener()` or `removeAllListeners()` calls _after_ emitting and _before_ the last listener finishes execution
will not remove them from`emit()` in progress. Subsequent events behave as expected.

```js
const myEmitter = new MyEmitter();

const callbackA = () => {
  console.log('A');
  myEmitter.removeListener('event', callbackB);
};

const callbackB = () => {
  console.log('B');
};

myEmitter.on('event', callbackA);

myEmitter.on('event', callbackB);

// callbackA removes listener callbackB but it will still be called.
// Internal listener array at time of emit [callbackA, callbackB]
myEmitter.emit('event');
// Prints:
//   A
//   B

// callbackB is now removed.
// Internal listener array [callbackA]
myEmitter.emit('event');
// Prints:
//   A
```

Because listeners are managed using an internal array, calling this will
change the position indices of any listener registered _after_ the listener
being removed. This will not impact the order in which listeners are called,
but it means that any copies of the listener array as returned by
the `emitter.listeners()` method will need to be recreated.

When a single function has been added as a handler multiple times for a single
event (as in the example below), `removeListener()` will remove the most
recently added instance. In the example the `once('ping')`listener is removed:

```js
const ee = new EventEmitter();

function pong() {
  console.log('pong');
}

ee.on('ping', pong);
ee.once('ping', pong);
ee.removeListener('ping', pong);

ee.emit('ping');
ee.emit('ping');
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Type Parameters

##### K

`K`

#### Parameters

##### eventName

`string` | `symbol`

##### listener

(...`args`) => `void`

#### Returns

`this`

#### Since

v0.1.26

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`removeListener`](../../../BaseAgent/classes/BaseAgent.md#removelistener)

***

### setMaxListeners()

> **setMaxListeners**(`n`): `this`

By default `EventEmitter`s will print a warning if more than `10` listeners are
added for a particular event. This is a useful default that helps finding
memory leaks. The `emitter.setMaxListeners()` method allows the limit to be
modified for this specific `EventEmitter` instance. The value can be set to`Infinity` (or `0`) to indicate an unlimited number of listeners.

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Parameters

##### n

`number`

#### Returns

`this`

#### Since

v0.3.5

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`setMaxListeners`](../../../BaseAgent/classes/BaseAgent.md#setmaxlisteners)

***

### addAbortListener()

> `static` **addAbortListener**(`signal`, `resource`): `Disposable`

**`Experimental`**

Listens once to the `abort` event on the provided `signal`.

Listening to the `abort` event on abort signals is unsafe and may
lead to resource leaks since another third party with the signal can
call `e.stopImmediatePropagation()`. Unfortunately Node.js cannot change
this since it would violate the web standard. Additionally, the original
API makes it easy to forget to remove listeners.

This API allows safely using `AbortSignal`s in Node.js APIs by solving these
two issues by listening to the event such that `stopImmediatePropagation` does
not prevent the listener from running.

Returns a disposable so that it may be unsubscribed from more easily.

```js
import { addAbortListener } from 'node:events';

function example(signal) {
  let disposable;
  try {
    signal.addEventListener('abort', (e) => e.stopImmediatePropagation());
    disposable = addAbortListener(signal, (e) => {
      // Do something when signal is aborted.
    });
  } finally {
    disposable?.[Symbol.dispose]();
  }
}
```

#### Parameters

##### signal

`AbortSignal`

##### resource

(`event`) => `void`

#### Returns

`Disposable`

Disposable that removes the `abort` listener.

#### Since

v18.18.0

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`addAbortListener`](../../../BaseAgent/classes/BaseAgent.md#addabortlistener)

***

### getEventListeners()

> `static` **getEventListeners**(`emitter`, `name`): `Function`[]

Returns a copy of the array of listeners for the event named `eventName`.

For `EventEmitter`s this behaves exactly the same as calling `.listeners` on
the emitter.

For `EventTarget`s this is the only way to get the event listeners for the
event target. This is useful for debugging and diagnostic purposes.

```js
import { getEventListeners, EventEmitter } from 'node:events';

{
  const ee = new EventEmitter();
  const listener = () => console.log('Events are fun');
  ee.on('foo', listener);
  getEventListeners(ee, 'foo'); // [listener]
}
{
  const et = new EventTarget();
  const listener = () => console.log('Events are fun');
  et.addEventListener('foo', listener);
  getEventListeners(et, 'foo'); // [listener]
}
```

#### Parameters

##### emitter

`EventEmitter`\<`DefaultEventMap`\> | `_DOMEventTarget`

##### name

`string` | `symbol`

#### Returns

`Function`[]

#### Since

v15.2.0, v14.17.0

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`getEventListeners`](../../../BaseAgent/classes/BaseAgent.md#geteventlisteners)

***

### getMaxListeners()

> `static` **getMaxListeners**(`emitter`): `number`

Returns the currently set max amount of listeners.

For `EventEmitter`s this behaves exactly the same as calling `.getMaxListeners` on
the emitter.

For `EventTarget`s this is the only way to get the max event listeners for the
event target. If the number of event handlers on a single EventTarget exceeds
the max set, the EventTarget will print a warning.

```js
import { getMaxListeners, setMaxListeners, EventEmitter } from 'node:events';

{
  const ee = new EventEmitter();
  console.log(getMaxListeners(ee)); // 10
  setMaxListeners(11, ee);
  console.log(getMaxListeners(ee)); // 11
}
{
  const et = new EventTarget();
  console.log(getMaxListeners(et)); // 10
  setMaxListeners(11, et);
  console.log(getMaxListeners(et)); // 11
}
```

#### Parameters

##### emitter

`EventEmitter`\<`DefaultEventMap`\> | `_DOMEventTarget`

#### Returns

`number`

#### Since

v18.17.0

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`getMaxListeners`](../../../BaseAgent/classes/BaseAgent.md#getmaxlisteners-2)

***

### ~~listenerCount()~~

> `static` **listenerCount**(`emitter`, `eventName`): `number`

A class method that returns the number of listeners for the given `eventName`registered on the given `emitter`.

```js
import { EventEmitter, listenerCount } from 'node:events';
const myEmitter = new EventEmitter();
myEmitter.on('event', () => {});
myEmitter.on('event', () => {});
console.log(listenerCount(myEmitter, 'event'));
// Prints: 2
```

#### Parameters

##### emitter

`EventEmitter`

The emitter to query

##### eventName

The event name

`string` | `symbol`

#### Returns

`number`

#### Since

v0.9.12

#### Deprecated

Since v3.2.0 - Use `listenerCount` instead.

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`listenerCount`](../../../BaseAgent/classes/BaseAgent.md#listenercount-2)

***

### on()

> `static` **on**(`emitter`, `eventName`, `options?`): `AsyncIterator`\<`any`\>

```js
import { on, EventEmitter } from 'node:events';

(async () => {
  const ee = new EventEmitter();

  // Emit later on
  process.nextTick(() => {
    ee.emit('foo', 'bar');
    ee.emit('foo', 42);
  });

  for await (const event of on(ee, 'foo')) {
    // The execution of this inner block is synchronous and it
    // processes one event at a time (even with await). Do not use
    // if concurrent execution is required.
    console.log(event); // prints ['bar'] [42]
  }
  // Unreachable here
})();
```

Returns an `AsyncIterator` that iterates `eventName` events. It will throw
if the `EventEmitter` emits `'error'`. It removes all listeners when
exiting the loop. The `value` returned by each iteration is an array
composed of the emitted event arguments.

An `AbortSignal` can be used to cancel waiting on events:

```js
import { on, EventEmitter } from 'node:events';
const ac = new AbortController();

(async () => {
  const ee = new EventEmitter();

  // Emit later on
  process.nextTick(() => {
    ee.emit('foo', 'bar');
    ee.emit('foo', 42);
  });

  for await (const event of on(ee, 'foo', { signal: ac.signal })) {
    // The execution of this inner block is synchronous and it
    // processes one event at a time (even with await). Do not use
    // if concurrent execution is required.
    console.log(event); // prints ['bar'] [42]
  }
  // Unreachable here
})();

process.nextTick(() => ac.abort());
```

#### Parameters

##### emitter

`EventEmitter`

##### eventName

`string`

The name of the event being listened for

##### options?

`StaticEventEmitterOptions`

#### Returns

`AsyncIterator`\<`any`\>

that iterates `eventName` events emitted by the `emitter`

#### Since

v13.6.0, v12.16.0

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`on`](../../../BaseAgent/classes/BaseAgent.md#on-2)

***

### once()

#### Call Signature

> `static` **once**(`emitter`, `eventName`, `options?`): `Promise`\<`any`[]\>

Creates a `Promise` that is fulfilled when the `EventEmitter` emits the given
event or that is rejected if the `EventEmitter` emits `'error'` while waiting.
The `Promise` will resolve with an array of all the arguments emitted to the
given event.

This method is intentionally generic and works with the web platform [EventTarget](https://dom.spec.whatwg.org/#interface-eventtarget) interface, which has no special`'error'` event
semantics and does not listen to the `'error'` event.

```js
import { once, EventEmitter } from 'node:events';

async function run() {
  const ee = new EventEmitter();

  process.nextTick(() => {
    ee.emit('myevent', 42);
  });

  const [value] = await once(ee, 'myevent');
  console.log(value);

  const err = new Error('kaboom');
  process.nextTick(() => {
    ee.emit('error', err);
  });

  try {
    await once(ee, 'myevent');
  } catch (err) {
    console.log('error happened', err);
  }
}

run();
```

The special handling of the `'error'` event is only used when `events.once()`is used to wait for another event. If `events.once()` is used to wait for the
'`error'` event itself, then it is treated as any other kind of event without
special handling:

```js
import { EventEmitter, once } from 'node:events';

const ee = new EventEmitter();

once(ee, 'error')
  .then(([err]) => console.log('ok', err.message))
  .catch((err) => console.log('error', err.message));

ee.emit('error', new Error('boom'));

// Prints: ok boom
```

An `AbortSignal` can be used to cancel waiting for the event:

```js
import { EventEmitter, once } from 'node:events';

const ee = new EventEmitter();
const ac = new AbortController();

async function foo(emitter, event, signal) {
  try {
    await once(emitter, event, { signal });
    console.log('event emitted!');
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Waiting for the event was canceled!');
    } else {
      console.error('There was an error', error.message);
    }
  }
}

foo(ee, 'foo', ac.signal);
ac.abort(); // Abort waiting for the event
ee.emit('foo'); // Prints: Waiting for the event was canceled!
```

##### Parameters

###### emitter

`_NodeEventTarget`

###### eventName

`string` | `symbol`

###### options?

`StaticEventEmitterOptions`

##### Returns

`Promise`\<`any`[]\>

##### Since

v11.13.0, v10.16.0

##### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`once`](../../../BaseAgent/classes/BaseAgent.md#once-2)

#### Call Signature

> `static` **once**(`emitter`, `eventName`, `options?`): `Promise`\<`any`[]\>

Creates a `Promise` that is fulfilled when the `EventEmitter` emits the given
event or that is rejected if the `EventEmitter` emits `'error'` while waiting.
The `Promise` will resolve with an array of all the arguments emitted to the
given event.

This method is intentionally generic and works with the web platform [EventTarget](https://dom.spec.whatwg.org/#interface-eventtarget) interface, which has no special`'error'` event
semantics and does not listen to the `'error'` event.

```js
import { once, EventEmitter } from 'node:events';

async function run() {
  const ee = new EventEmitter();

  process.nextTick(() => {
    ee.emit('myevent', 42);
  });

  const [value] = await once(ee, 'myevent');
  console.log(value);

  const err = new Error('kaboom');
  process.nextTick(() => {
    ee.emit('error', err);
  });

  try {
    await once(ee, 'myevent');
  } catch (err) {
    console.log('error happened', err);
  }
}

run();
```

The special handling of the `'error'` event is only used when `events.once()`is used to wait for another event. If `events.once()` is used to wait for the
'`error'` event itself, then it is treated as any other kind of event without
special handling:

```js
import { EventEmitter, once } from 'node:events';

const ee = new EventEmitter();

once(ee, 'error')
  .then(([err]) => console.log('ok', err.message))
  .catch((err) => console.log('error', err.message));

ee.emit('error', new Error('boom'));

// Prints: ok boom
```

An `AbortSignal` can be used to cancel waiting for the event:

```js
import { EventEmitter, once } from 'node:events';

const ee = new EventEmitter();
const ac = new AbortController();

async function foo(emitter, event, signal) {
  try {
    await once(emitter, event, { signal });
    console.log('event emitted!');
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Waiting for the event was canceled!');
    } else {
      console.error('There was an error', error.message);
    }
  }
}

foo(ee, 'foo', ac.signal);
ac.abort(); // Abort waiting for the event
ee.emit('foo'); // Prints: Waiting for the event was canceled!
```

##### Parameters

###### emitter

`_DOMEventTarget`

###### eventName

`string`

###### options?

`StaticEventEmitterOptions`

##### Returns

`Promise`\<`any`[]\>

##### Since

v11.13.0, v10.16.0

##### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`once`](../../../BaseAgent/classes/BaseAgent.md#once-2)

***

### setMaxListeners()

> `static` **setMaxListeners**(`n?`, ...`eventTargets?`): `void`

```js
import {
  setMaxListeners,
  EventEmitter
} from 'node:events';

const target = new EventTarget();
const emitter = new EventEmitter();

setMaxListeners(5, target, emitter);
```

#### Parameters

##### n?

`number`

A non-negative number. The maximum number of listeners per `EventTarget` event.

##### eventTargets?

...(`EventEmitter`\<`DefaultEventMap`\> \| `_DOMEventTarget`)[]

Zero or more {EventTarget} or {EventEmitter} instances. If none are specified, `n` is set as the default max for all newly created {EventTarget} and {EventEmitter}
objects.

#### Returns

`void`

#### Since

v15.4.0

#### Inherited from

[`BaseAgent`](../../../BaseAgent/classes/BaseAgent.md).[`setMaxListeners`](../../../BaseAgent/classes/BaseAgent.md#setmaxlisteners-2)
