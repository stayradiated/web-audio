import sinon from 'sinon'

const toUint8Array = (value) => new Uint8Array(value)

export default function createReadableStream (chunks) {
  const iterator = chunks.map(toUint8Array).entries()
  return {
    read: () => {
      const {value, done} = iterator.next()
      return Promise.resolve({
        value: done ? null : value[1],
        done,
      })
    },
    cancel: sinon.spy(),
  }
}
