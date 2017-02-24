// @flow
const test = require('tape')

const fsm = require('../index')

test('single state, single write', function (t) {
  const desiredInvocations = 3
  var numInvocations = 0
  const description = {
    'a': {
      transition: function () {
        numInvocations++
      },
      next: 'a'
    }
  }
  const machine = fsm(description)
  const stream = machine.end('a\na\na')
  stream.on('finish', function () {
    t.equal(numInvocations, desiredInvocations)
    t.end()
  })
})

test('single state, multiple writes', function (t) {
})

