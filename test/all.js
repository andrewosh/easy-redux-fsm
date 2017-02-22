// @flow
const test = require('tape')

const fsm = require('../index')

test('single state, single write', function (t) {
  const desiredInvocations = 3
  var numInvocations = 0
  const description = {
    'a': {
      action: function () {
        numInvocations++
      },
      next: 'a'
    }
  }
  const fsm = easykeys(description)
  fsm.write('aaa', function )
  t.equal(numInvocations, desiredInvocations)
  t.end()
})



