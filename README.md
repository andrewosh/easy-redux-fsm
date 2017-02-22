## easy-fsm
Defining complex key bindings involves lots of annoying state/transition management
that can quickly become unwieldy. This package lets you split up large FSMs into
small subcomponents, and define state transitions using simple string matching, regexes,
or dot accessor syntax.

### Overview

All FSMs are implemented as Transform streams which can handle utf-8 encoded,
newline-delimited input. As an example:

`someMachine.write('a\nhello\nb\nc')` will process inputs 'a', 'hello', 'b', and
'c' in that order.

### Beefy Example
```
const fsm = require('easy-fsm')

const aMachine = fsm({
  transition: function () {
    // Do something when transitioning into machine 'a'
    console.log('In state a')
  },
  // Transitions can be defined as strings or numbers, which will do exact matching
  'b': {
    transition: function (input) {
      // Transitions can handle their input
      console.log('In state ab, input is:', input) 
    },
    'a': {
      transition: function (input, cb) {
        // Transitions can be async
        console.log('in state aba') 
        return cb()
      },
      // States can explicitly define the next state in property dot notation
      next: 'a.b'
    }
  },
  // Transitions can also be defined using a regex
  /b*a/: {
    transition: function (input) {
      // The input here can be bja, bia, bca...
    }
    // If a state does not specify either a `next` property, or other substates,
    // then the machine will terminate.
  }
  // You can directly include sub-FSMs as properties
  'c': cMachine,
  'd': dMachine
})

const cMachine = fsm({
  transition: function () {
    ... 
  }
})

const dMachine = fsm({
  transition: function () {
    ...
  }
})

aMachine.write('aaabbccdddd')
aMachine.on('finish', function () {
  // Called once all input events have been processed
})
```

### Installation
```
npm i easy-key-bindings --save
```

### API
```
```

### License
MIT


