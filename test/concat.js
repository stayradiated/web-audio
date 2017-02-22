import test from 'ava'

import {concatUint8Array} from '../lib/concat'

test('concatUint8Array - two full arrays', (t) => {
  const result = concatUint8Array(
    new Uint8Array([1, 2, 3]),
    new Uint8Array([4, 5, 6]),
  )

  t.deepEqual(result, new Uint8Array([1, 2, 3, 4, 5, 6]))
})

test('concatUint8Array - first array empty', (t) => {
  const result = concatUint8Array(
    new Uint8Array([]),
    new Uint8Array([4, 5, 6]),
  )

  t.deepEqual(result, new Uint8Array([4, 5, 6]))
})

test('concatUint8Array - second array empty', (t) => {
  const result = concatUint8Array(
    new Uint8Array([1, 2, 3]),
    new Uint8Array([]),
  )

  t.deepEqual(result, new Uint8Array([1, 2, 3]))
})
