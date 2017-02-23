## easy-redux-fsm
Defining complex key bindings involves lots of annoying state/transition management
that can quickly become unwieldy. It's nice to define states and transition functions
as a graph, in one place, but there doesn't seem to be a simple way to do that out-of
-the-box with Redux.

This package lets you split up large FSMs into smaller subcomponents, and define
state transitions as reducers over your global state.

Best shown with an example...

### Beefy Example
We'll first define our FSM using the schema outlined below. Each state is a key
in an object, with successor states defined as children. In order to jump around
the tree, you can also define the next state using dot accessor syntax.

```
const fsm = require('easy-redux-fsm')

const machine = fsm({
  a: {
    accepts: 'a',
    action: function (state) {
      // Do something when 'a' is encountered
    },
    children: {
      b: {
        accepts: 'b',
        action: function (state, input) {
          // `input` will always be 'b'
          console.log(input)
        }
        // If `next` isn't specified and there aren't any children,
        // the FSM will terminate.
      },
      c: {
        accepts: /[c-f]/
        action: function (state, input) {
          // `input` will be 'c', 'd', 'e', or 'f'
        },
        // If `next` is specified (in dot accessor syntax),
        // the FSM will jump to that state.
        next: 'a.b'
      }
    }
  },
  b: otherMachine
})

const otherMachine = fsm({
  ...
})
```
The `fsm` function returns a "reducer-producer" (just a function that returns a reducer
given the key of its corresponding state), and you can easily integrate it into your
Redux pipeline. One nice way to do this is with the [reduce-reducers](https://github.com/acdlite/reduce-reducers) module:

```
const initialState = {
  fsm: fsm.createEmpty(),
  ...
}

const rootReducer = reduceReducers(
  machine('fsm'),
  ...
)

createStore(rootReducer, initialState)
```

To trigger a state transition, dispatch an `fsm.TRANSITION` action. Here's a complete
example from start to finish:
```
const fsm = require('easy-redux-fsm')

const machine = fsm({
  a: {
    accepts: /.*/,
    action: function () {
      console.log('Hey!')
    },
    next: fsm.START
  }
})

const store = createStore(machine('fsm1'), { fsm1: fsm.createEmpty() })

store.dispatch({
  type: fsm.TRANSITION,
  key: 'fsm1',
  input: 'b'
})
// 'b' is logged

store.dispatch({
  type: fsm.TRANSITION,
  key: 'fsm1',
  input: 'blahblah'
})
// 'blahblah' is logged

```

### Install
```
npm i easy-redux-fsm --save
```

### API
```
```

### License
MIT


