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
  _fullName: ?string,
  name: string,
  accepts: string | RegExp | (x: string) => Boolean,
  action: (state: ?any, input: ?string) => ?Promise<any>,
  children: ?[Node]
}

// States
const STATES = {
  START: 'START',
  END: 'END'
}

// Actions
const ACTIONS = {
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
function fsm (key: string, description: FSMDescription, options: FSMOptions) {
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
fsm.prototype._buildIndex = function () {
  this.index = Object.assign({}, STATES)

  const self = this
  function _indexNode (prefix: string, node: Node) {
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
  this.description.forEach(STATES.START, _indexNode)
}

/**
 * Create a transition action.
 */
fsm.prototype._transition = function (stateName) {
  return {
    type: ACTIONS._TRANSITIONED,
    key: this.key,
    nextState: stateName
  }
}

/**
 * Create a transitioning action signifying that an async action is in progress.
 */
fsm.prototype._transitioning = function () {
  return {
    type: ACTIONS._TRANSITIONING,
    key: this.key
  }
}

/**
 * Buffer input for processing once the in-progress async action is complete.
 */
fsm.prototype._updateBuffer = function (buffer) {
  return {
    type: ACTIONS._UPDATE_BUFFER,
    key: this.key,
    inputBuffer: buffer
  }
}

fsm.prototype._handleInput = function (getState, dispatch, key, input) {
  function _findMatchingChild (children: [Node], input: string): ?Node {
    if (!children || children.length === 0) {
      return null
    }
    children.forEach(function (child) {
      const accepts = child.accepts
      if ((typeof accepts === 'string' && accepts === input) ||
          (typeof accepts === 'function' && accepts(input)) ||
          (accepts instanceof RegExp && accepts.test(input))) {
        return child
      }
    })
    return null
  }

  const nodePath = getState()[key]
  const node= this.index[nodePath]

  if (!nodePath) {
    throw new Error('Attempted to read the value of nonexistent state machine: ' + key)
  }
  if (node.name === STATES.END) {
    const warning = 'State machine is in the END state and is not processing inputs.'
    return console.warn(warning)
  }

  // If a state doesn't specify any successors, immediately transition to END.
  if (!node.next && (!node.children || node.children.length === 0)) {
    return this._transition(STATES.END)
  }
  // If a state specifies an invalid successor, immediately transition to END.
  if (node.next && !this.index[node.next]) {
    return this._transition(STATES.END)
  }

  const successor = (node.next) ? node.next : _findMatchingChild(node.children, input)
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
      dispatch(self._transitioned(successor._fullName))
    })
    return this._transitioning() 
  }
  return self._transitioned(successor._fullName)
}

fsm.prototype.reducer = function () {
  const self = this
  return function (state, action) {
    if (action.key !== self.key) {
      return state
    }
    switch (action.type) {
      case ACTIONS._TRANSITIONED:
        return state.set('stateName', action.nextState)
                    .set('transitioning', false)
      case ACTIONS._TRANSITIONING:
        return state.set('transitioning', true)
      case ACTIONS._UPDATE_BUFFER:
        return state.set('inputBuffer', action.buffer)
      default:
        return state
    }
  }
}

fsm.prototype.createEmpty = function (): FSMState {
  return new Immutable.Record({
    stateName: STATES.START,
    transitioning: false,
    inputBuffer: new Immutable.List()
  })()
}

fsm.prototype.middleware = function () {
  const self = this
  return store => next => action => {
    if (action.key !== self.key) {
      return next(action)
    }
    switch (action.type) {
      case ACTIONS.HANDLE_INPUT:
        const fsmState = store.getState()[self.key]
        assert(action.input && fsmState)
        if (fsmState.transitioning) { 
          return next(self._updateBuffer(fsmState.inputBuffer.unshift(action.input)))
        }
        return next(self._handleInput(store.getState, store.dispatch, action.input))
      case ACTIONS._TRANSITIONED:
        next(action)
        const fsmState = store.getState()[self.key]
        assert(fsmState)
        const nextInput = fsmState.inputBuffer.get(0)  
        if (nextInput) {
          next(self._updateBuffer(fsmState.inputBuffer.shift()))
          return next(self._handleInput(store.getState, store.dispatch, nextInput))
        }
      default:
        return next(action)
  }
}

fsm.prototype.states = STATES
fsm.prototype.actions = ACTIONS

module.exports = exports
