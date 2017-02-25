# easy-redux-fsm
[![CircleCI](https://circleci.com/gh/andrewosh/easy-redux-fsm/tree/master.svg?style=svg)](https://circleci.com/gh/andrewosh/easy-redux-fsm/tree/master)
> Specify action creators as a state/transition graph

## Overview
Defining complex key bindings involves lots of annoying state/transition management
that can quickly become unwieldy in Redux. It's nice to define states and 
transition functions as a graph, in one place, but there doesn't seem to be a 
simple way to do that out-of-the-box.

This package lets you split up large FSMs into smaller subcomponents, and define
state transitions as action creators.

Best shown with an example...

## Beefy Examples
We'll first define our FSM using the schema outlined below. Each state is a key
in an object, with successor states defined as children. In order to jump around
the tree, you can also define the next state using dot accessor syntax.

The state machine is defined using arrays instead of maps because inputs are checked
against the states' `accepts` values in order.

```
const fsm = require('easy-redux-fsm')

const machine = fsm([
  {
    name: 'A',
    accepts: 'a',
    action: function (state) {
      // Do something when 'a' is encountered
    },
    children: [
      {
        name: 'B',
        accepts: 'b',
        action: function (getState, dispatch, input) {
          // `input` will always be 'b'
          console.log(input)
        }
        // If `next` isn't specified and there aren't any children,
        // the FSM will terminate.
      },
      {
        name: 'CThroughF',
        accepts: /[c-f]/
        action: function (getState, dispatch, input) {
          // `input` will be 'c', 'd', 'e', or 'f'
          // `action` can be asynchronous
          return new Promise(...)
        },
        // If `next` is specified (in dot accessor syntax),
        // the FSM will jump to that state.
        next: 'a.b'
      }
    }
  },
  {
    name: 'B',
    fsm: otherMachineDescription
  }
])

const otherMachineDescription = [
  ...
]
```
The `fsm` function returns an action creator that you can easily integrate into your
Redux pipeline:
```
const machine = fsm('fsm1', machineDescription, options)

const initialState = {
  fsm1: machine.createEmpty(),
  ...
}

const rootReducer = combineReducers(
  fsm1: machine.reducer(),
  ...
)

createStore(rootReducer, initialState, applyMiddlware(machine.middleware()))
```

To trigger a state transition, dispatch an `fsm.actions.TRANSITION` action. 
Here's a complete example from start to finish:
```
const fsm = require('easy-redux-fsm')

const machine = fsm('fsm1', [
  {
    name: 'A'
    accepts: /.*/,
    action: function () {
      console.log('Hey!')
    },
    next: fsm.states.START
  }
])

const store = createStore(
  combineReducers({ fsm1: machine.reducer() }),
  { fsm1: fsm.createEmpty() },
  applyMiddleware(machine.middleware())
)

store.dispatch({
  type: fsm.actions.TRANSITION,
  key: 'fsm1',
  input: 'b'
})
// 'b' is logged

store.dispatch({
  type: fsm.actions.TRANSITION,
  key: 'fsm1',
  input: 'blahblah'
})
// 'blahblah' is logged

```

## Install
```
npm i easy-redux-fsm --save
```

## API
#### `new FSM(key, description)`
`key` - a unique identifier for this state machine
`description` - a machine description that defines states as objects
  with the above.

Constructs a new FSM with ID `key`, described by `description` (see the beefy
  example for a complete description of the available properties)

#### `fsm.handleInput(key, input)`
`key` {string} - the state machine that should handle input
`input` {string} - the input that will be passed to the FSM's transition function

Creates an action that can be dispatched to a Redux store to pass `input`
to the FSM specified by `key`.

#### `fsm.reducer()`
Makes a reducer function that can be used in `createStore`

#### `fsm.middleware()`
Makes a middleware function that will handle a state machine's internal
actions. Must be applied  with `applyMiddleware(middleware)`.

#### `fsm.createEmpty()`
Creates an empty Redux state for the FSM.

## License
MIT


