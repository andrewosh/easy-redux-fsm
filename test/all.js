// @flow
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
    next: 'StateA'
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
    next: 'StateA'
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
