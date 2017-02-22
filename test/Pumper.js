import test from 'ava'
import sinon from 'sinon'

import Pumper from '../lib/Pumper'
import createReadableStream from './helpers/ReadableStream'

test('should create a new Pumper', (t) => {
  const pumper = new Pumper()
  t.true(pumper.buffer instanceof Uint8Array)
  t.true(typeof pumper.onRead === 'function')
  t.is(pumper.done, false)
  t.is(pumper.cancelled, false)
})

test('should read from stream', (t) => {
  const reader = createReadableStream([
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ])
  const pumper = new Pumper()
  pumper.onRead = sinon.spy()
  return pumper.pump(reader).then(() => {
    t.deepEqual(pumper.onRead.args, [
      [{value: new Uint8Array([1, 2, 3]).buffer, done: false}],
      [{value: new Uint8Array([1, 2, 3, 4, 5, 6]).buffer, done: false}],
      [{value: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]).buffer, done: false}],
      [{value: null, done: true}],
    ])
  })
})

test('should cancel read stream', (t) => {
  const reader = createReadableStream([
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ])
  const pumper = new Pumper()
  pumper.onRead = sinon.spy()
  const pumpPromise = pumper.pump(reader)
  pumper.cancel()
  return pumpPromise.then(() => {
    t.true(reader.cancel.calledOnce)
    t.deepEqual(pumper.onRead.args, [])
  })
})
