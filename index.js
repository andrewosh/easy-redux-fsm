// @flow
const assert = require('assert')
const Immutable = require('immutable')

// Flow types
type FSMDescription = [Node]
type FSMState = Immutable.Record<{
  stateName: string,
  transitioning: boolean,
  inputBuffer: ?[string],
}>
type FSMOptions = {
  cancelOnInput?: Boolean
}
type Node = {
  _fullName?: ?string,
  name: string,
  action: (state: ?any, input: ?string) => ?Promise<any>,
  accepts?: string | RegExp | (x: string) => Boolean,
  children?: [Node],
  next?: string
}

// States
const States = {
  START: 'START',
  END: 'END'
}

// Actions
const Actions = {
  _TRANSITIONED: 'TRANSITIONED',
  _TRANSITIONING: 'TRANSITIONING',
  _UPDATE_BUFFER: 'UPDATE_BUFFER',
  _PROCESS_BUFFER: 'PROCESS_INPUT',
  HANDLE_INPUT: 'HANDLE_INPUT'
}

/**
 * Constructs an FSM based on a description object.
 * (see the README for more details)
 *
 * @param {object} description - a tree of states that define the FSM
 * @param {object} options - options object
 */
function FSM (key: string, description: FSMDescription, options?: FSMOptions) {
  if (!(this instanceof FSM)) return new FSM(key, description, options)
  this.key = key
  this.options = options || {}
  this.description = description

  this._buildIndex()
}

/**
 * Build an index so that node lookups are fast.
 *
 * This method will also mutate the description object so that all nodes contain
 * an expanded name property with their complete prefixes.
 */
FSM.prototype._buildIndex = function () {
  this.index = {}
  this.index[FSM.States.START] = {
    name: FSM.States.START,
    children: this.description
  }
  this.index[FSM.States.END] = {
    name: FSM.States.END
  }

  const self = this
  function _indexNode (prefix: ?string, node: Node) {
    const newPrefix = (prefix) ? (prefix + '.' + node.name) : node.name
    node._fullName = newPrefix
    self.index[newPrefix] = node
    const children: ?[Node] = node.children
    if (children && children.length !== 0) {
      children.forEach(function (child) {
        _indexNode(newPrefix, child)
      })
    }
  }
  // All top-level states are successors to START.
  this.description.forEach(function (node) {
    _indexNode(null, node)
  })
}

/**
 * Create a transitioned action signifying that a transition has completed.
 */
FSM.prototype._transitioned = function (stateName) {
  return {
    type: FSM.Actions._TRANSITIONED,
    key: this.key,
    nextState: stateName
  }
}

/**
 * Create a transitioning action signifying that an async action is in progress.
 */
FSM.prototype._transitioning = function () {
  return {
    type: FSM.Actions._TRANSITIONING,
    key: this.key
  }
}

/**
 * Buffer input for processing once the in-progress async action is complete.
 */
FSM.prototype._updateBuffer = function (buffer) {
  return {
    type: FSM.Actions._UPDATE_BUFFER,
    key: this.key,
    buffer: buffer
  }
}

FSM.prototype._handleInput = function (getState, dispatch, key, input) {
  function _findMatchingChild (children: [Node], input: string): ?Node {
    if (!children || children.length === 0) {
      return null
    }
    for (var i = 0; i < children.length; i++) {
      const child = children[i]
      const accepts = child.accepts
      console.log('accepts:', accepts)
      console.log('input:', input)
      if (!accepts) return child
      if ((typeof accepts === 'string' && accepts === input) ||
          (typeof accepts === 'function' && accepts(input)) ||
          (accepts instanceof RegExp && accepts.test(input))) {
        return child
      }
    }
    return null
  }

  const nodePath = getState()[key].stateName
  const node= this.index[nodePath]
  if (!nodePath) {
    throw new Error('Attempting to read the value of nonexistent state machine: ' + key)
  }
  if (node.name === FSM.States.END) {
    const warning = 'State machine is in the END state and is not processing inputs.'
    return console.warn(warning)
  }

  // If a state doesn't specify any successors, immediately transition to END.
  if (!node.next && (!node.children || node.children.length === 0)) {
    return this._transition(FSM.States.END)
  }
  // If a state specifies an invalid successor, immediately transition to END.
  if (node.next && !this.index[node.next]) {
    console.warn('Attempting to transition into an invalid state:', node.next)
    return this._transition(FSM.States.END)
  }

  console.log('node.next:', node.next)
  console.log('matching children:', _findMatchingChild(node.children, input))
  console.log('children:', node.children)

  const successor = (node.next) ? this.index[node.next] : _findMatchingChild(node.children, input)
  console.log('successor:', successor)
  if (!successor) {
    throw new Error('Could not find a valid successor state for input: ' + input)
  }

  const promise = successor.action(getState, dispatch)
  if (promise) {
    if (!(promise instanceof Promise)) {
      throw new Error('Action must return null or a Promise.')
    }
    const self = this
    promise.then(function (res) {
      dispatch(self._transitioned(successor._fullName))
    })
    promise.catch(function (err) {
      // TODO: handle error?
      console.error(err)
      dispatch(self._transitioned(successor._fullName))
    })
    return this._transitioning()
  }
  console.log('toning...')
  dispatch(this._transitioned(successor._fullName))
}

/**
 * Creates an action to send input to the FSM specified by `key`.
 *
 * @param {string} key - the FSM key
 * @param {string} input - an input string
 */
FSM.handleInput = function (key, input) {
  return {
    type: FSM.Actions.HANDLE_INPUT,
    key: key,
    input: input
  }
}

/**
 * Create a Redux reducer for updating a state machine's internal state.
 */
FSM.prototype.reducer = function () {
  const self = this
  return function (state, action) {
    if (typeof state === 'undefined') {
      return self.createEmpty()
    }
    if (action.key !== self.key) {
      return state
    }
    switch (action.type) {
      case FSM.Actions._TRANSITIONED:
        return state.set('stateName', action.nextState)
                    .set('transitioning', false)
      case FSM.Actions._TRANSITIONING:
        return state.set('transitioning', true)
      case FSM.Actions._UPDATE_BUFFER:
        return state.set('inputBuffer', action.buffer)
      default:
        return state
    }
  }
}

/**
 * Creates an empty Redux state.
 */
FSM.prototype.createEmpty = function (): FSMState {
  return new Immutable.Record({
    stateName: FSM.States.START,
    transitioning: false,
    inputBuffer: new Immutable.List()
  })()
}

/**
 * Creates Redux middleware that intercepts actions for processing by a state
 * machine.
 */
FSM.prototype.middleware = function () {
  const self = this
  return store => next => action => {
    console.log('handling action:', action)
    if (action.key !== self.key) {
      return next(action)
    }
    const fsmState = store.getState()[self.key]
    assert(fsmState)
    switch (action.type) {

      case FSM.Actions.HANDLE_INPUT:
        assert(action.input)
        if (fsmState.transitioning) {
          console.log('fsmState:', fsmState)
          return next(self._updateBuffer(
                      fsmState.inputBuffer.unshift(action.input)))
        }
        const nextAction = self._handleInput(
                    store.getState, store.dispatch, action.key, action.input)
        if (nextAction) return next(nextAction)
        break

      case FSM.Actions._TRANSITIONED:
        next(action)
        const nextInput = fsmState.inputBuffer.last()
        console.log('TRANSITIONED and inputBuffer:', fsmState.inputBuffer)
        console.log('TRANSITIONED and next input:', nextInput)
        if (nextInput) {
          next(self._updateBuffer(fsmState.inputBuffer.pop()))
          const nextAction = self._handleInput(
                      store.getState, store.dispatch, action.key, nextInput)
          if (nextAction) return next(nextAction)
        }
        break

      default:
        return next(action)
    }
  }
}

FSM.States = States
FSM.Actions = Actions

module.exports = FSM
