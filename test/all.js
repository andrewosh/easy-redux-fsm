const test = require('tape')
const redux = require('redux')

const fsm = require('../index')

/**
 * Utility function for create a testing store given one or many
 * FSM descriptions.
 *
 * @param {Array} machines - A list of key/description pairs
 */
function createTestStores (machines) {
  const reducers = {}
  const initialState = {}
  const middlewares = []

  machines.forEach(function (m) {
    var machine: fsm = fsm(m.key, m.description)
    reducers[m.key] = machine.reducer()
    initialState[m.key] = machine.createEmpty()
    middlewares.push(machine.middleware())
  })

  const rootReducer = redux.combineReducers(reducers)
  const middleware = redux.applyMiddleware.apply(null, middlewares)
  return redux.createStore(rootReducer, initialState, middleware)
}

test('single machine, single state, synchronous write', function (t) {
  const desiredInvocations = 3
  var numInvocations = 0
  const description = [{
    name: 'StateA',
    action: function () {
      numInvocations++
    },
    next: fsm.States.START
  }]
  const store = createTestStores([
    {
      key: 'fsm1',
      description: description
    }
  ])
  for (var i = 0; i < desiredInvocations; i++) {
    store.dispatch(fsm.handleInput('fsm1', 'hello!'))
  }
  t.equal(desiredInvocations, numInvocations)
  t.end()
})

test('single machine, single state, asynchronous write', function (t) {
  const desiredInvocations = 3
  var numInvocations = 0
  const description = [{
    name: 'StateA',
    action: function () {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          numInvocations++
          resolve()
        }, 100)
      })
    },
    next: fsm.States.START
  }]
  const store = createTestStores([
    {
      key: 'fsm1',
      description: description
    }
  ])
  for (var i = 0; i < desiredInvocations; i++) {
    store.dispatch(fsm.handleInput('fsm1', 'hello!'))
  }
  setTimeout(function () {
    t.equal(desiredInvocations, numInvocations)
    t.end()
  }, 400)
})

test('single machine, three states, ordered asynchronous write', function (t) {
  const desiredOutput = 'abc'
  var output = ''
  const description = [{
    name: 'StateA',
    action: function () {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          output += 'a'
          resolve()
        }, 100)
      })
    },
    children: [
      {
        name: 'StateB',
        action: function () {
          return new Promise(function (resolve, reject) {
            setTimeout(function () {
              output += 'b'
              resolve()
            }, 100)
          })
        },
        children: [
          {
            name: 'StateC',
            action: function () {
              return new Promise(function (resolve, reject) {
                setTimeout(function () {
                  output += 'c'
                  resolve()
                }, 100)
              })
            }
          }]
      }]
  }]
  const store = createTestStores([
    {
      key: 'fsm1',
      description: description
    }
  ])
  for (var i = 0; i < 3; i++) {
    store.dispatch(fsm.handleInput('fsm1', 'hello!'))
  }
  setTimeout(function () {
    t.equal(desiredOutput, output)
    t.end()
  }, 400)
})

test('single machine, two states, mixed sync and async', function (t) {
  const desiredOutput = 'ab'
  var output = ''
  const description = [{
    name: 'StateA',
    action: function () {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          output += 'a'
          resolve()
        }, 100)
      })
    },
    children: [
      {
        name: 'StateB',
        action: function () {
          output += 'b'
        }
      }]
  }]
  const store = createTestStores([
    {
      key: 'fsm1',
      description: description
    }
  ])
  for (var i = 0; i < 2; i++) {
    store.dispatch(fsm.handleInput('fsm1', 'hello!'))
  }
  setTimeout(function () {
    t.equal(desiredOutput, output)
    t.end()
  }, 300)
})

test('single machine, multiple children, mixed sync and async', function (t) {
  const desiredOutput = 'accb'
  var output = ''
  const description = [{
    name: 'StateA',
    action: function () {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          output += 'a'
          resolve()
        }, 100)
      })
    },
    children: [
      {
        name: 'StateB',
        accepts: 'c',
        action: function () {
          output += 'b'
        }
      },
      {
        name: 'StateC',
        accepts: /c.*b/,
        action: function () {
          output += 'c'
        },
        next: 'StateA'
      }
    ]
  }]
  const store = createTestStores([
    {
      key: 'fsm1',
      description: description
    }
  ])
  store.dispatch(fsm.handleInput('fsm1', 'first hello!'))
  store.dispatch(fsm.handleInput('fsm1', 'caaaab'))
  store.dispatch(fsm.handleInput('fsm1', 'caaaab'))
  store.dispatch(fsm.handleInput('fsm1', 'c'))
  setTimeout(function () {
    t.equal(desiredOutput, output)
    t.end()
  }, 600)
})

test('multiple machines, single state, synchronous', function (t) {
  const desiredInvocations = 6
  var numInvocations = 0
  const description = [{
    name: 'StateA',
    action: function () {
      numInvocations++
    },
    next: fsm.States.START
  }]
  const store = createTestStores([
    {
      key: 'fsm1',
      description: description
    },
    {
      key: 'fsm2',
      description: description
    }
  ])
  for (var i = 0; i < 3; i++) {
    store.dispatch(fsm.handleInput('fsm1', 'hello!'))
    store.dispatch(fsm.handleInput('fsm2', 'hello!'))
  }
  t.equal(desiredInvocations, numInvocations)
  t.end()
})

test('multiple machines, multiple states, asynchronous', function (t) {
  const desiredOutput = 'ab'
  var output1 = ''
  var output2 = ''
  const description1 = [{
    name: 'StateA',
    action: function () {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          output1 += 'a'
          resolve()
        }, 100)
      })
    },
    children: [
      {
        name: 'StateB',
        action: function () {
          return new Promise(function (resolve, reject) {
            setTimeout(function () {
              output1 += 'b'
              resolve()
            }, 100)
          })
        }
      }]
  }]
  const description2 = [{
    name: 'StateA',
    action: function () {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          output2 += 'a'
          resolve()
        }, 100)
      })
    },
    children: [
      {
        name: 'StateB',
        action: function () {
          return new Promise(function (resolve, reject) {
            setTimeout(function () {
              output2 += 'b'
              resolve()
            }, 100)
          })
        }
      }]
  }]

  const store = createTestStores([
    {
      key: 'fsm1',
      description: description1
    },
    {
      key: 'fsm2',
      description: description2
    }
  ])
  store.dispatch(fsm.handleInput('fsm1', 'hello!'))
  store.dispatch(fsm.handleInput('fsm2', 'hello!'))
  store.dispatch(fsm.handleInput('fsm1', 'hello!'))
  store.dispatch(fsm.handleInput('fsm2', 'hello!'))
  setTimeout(function () {
    t.equal(output1, desiredOutput)
    t.equal(output2, desiredOutput)
    t.end()
  }, 400)
})
