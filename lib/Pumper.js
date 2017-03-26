import noop from 'nop'

import {concatUint8Array} from './concat'

/**
 * Pumper
 * =====
 *
 * Create a new pumper, that will fill `buffer` with data.
 * `onRead` will be called as the buffer is filled.
 *
 * @private
 * @class Pumper
 * @property {Uint8Array} buffer
 * @property {Boolean} cancelled
 * @property {Boolean} done
 * @property {Function} onRead
 */

export default class Pumper {

  constructor () {
    this.buffer = new Uint8Array()
    this.cancelled = false
    this.done = false
    this.onRead = noop
    this.onDone = noop
  }

  /**
   * append
   * ======
   *
   * @private
   *
   * Append some bytes to the buffer being collected.
   */

  _append (buffer) {
    this.buffer = concatUint8Array(this.buffer, buffer)
  }

  /**
   * pump
   * ====
   *
   * Start reading from a stream.
   *
   * @param {ReadableStream} reader
   */

  pump (reader) {
    return reader.read().then((result) => {
      const {value, done} = result

      if (this.cancelled) {
        reader.cancel()
        return
      }

      if (done) {
        this.done = true
        this.onDone()
        return
      }

      this._append(value)
      this.onRead(this.buffer.buffer)

      return this.pump(reader)
    })
  }

  /**
   * cancel
   * ======
   *
   * Stop reading from the stream.
   */

  cancel () {
    this.cancelled = true
    this.clear()
  }

  /**
   * clear
   * =====
   *
   * Discard the current contents in the buffer
   */

  clear () {
    this.buffer = new Uint8Array()
  }
}

