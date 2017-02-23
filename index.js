// @flow

// TODO: Flesh this out
type FSMDescription = Object

const states = {
  START: 'START',
  END: 'END'
}

/**
 * Constructs an FSM based on a description object.
 * (see the README for more details)
 *
 * @param {object} description - a tree of states that define the FSM
 */
module.exports = function fsm (description: FSMDescription) {
  var _state = states.START
  
}
