import noop from 'nop'
import throttle from 'lodash.throttle'

import Pumper from './Pumper'

/**
 * WebAudio
 * ========
 *
 * Create a new WebAudio instance, to manage playback of a streaming music
 * track.
 *
 * @class WebAudio
 * @param {Object} options
 * @param {AudioContext} options.context - An instance of window.AudioContext.
 * @param {Number} [options.throttleDecode = 500] - Number of milliseconds to
 * throttle calls to the decode function, set this number too low and the
 * browser will be tasked to decode many chunks, set it too high and there will
 * be a delay after the chunk has been downloaded.
 * @param {Number} [options.minLoadDuration = 1] - Minimum number of seconds
 * required for a chunk of the track to be loaded, before it is played. This is
 * useful to prevent a pause half a second after playback has started.
 * @property {AudioContext} context
 * @property {AudioBuffer} audioBuffer
 * @property {AudioBufferSourceNode} audioSource
 * @property {Boolean} loading - Is a file currently being downloaded?
 * @property {Boolean} paused - Is the audio track currently paused (i.e not
 * playing)?
 * @property {Boolean} buffering - Have we reached the end of the buffer?
 * @property {Function} onProgress - Triggered when the audio buffer updates.
 * @property {Function} onLoad - Triggered when we finish decoding the entire
 * file.
 * @property {Function} onPlay - Triggered after starting playback.
 * @property {Function} onPause - Triggered after pausing playback.
 * @property {Function} onStop - Triggered after stopping playback.
 */

export default class WebAudio {
  constructor (options) {
    const {
      context,
      throttleDecode = 500, // milliseconds
      minLoadDuration = 1, // seconds
    } = options

    this._pumper = null

    this.context = context
    this.throttleDecode = throttleDecode
    this.minLoadDuration = minLoadDuration

    this.audioBuffer = null
    this.audioSource = null

    this.startTime = null
    this.pauseTime = null

    this.loading = false
    this.paused = true
    this.buffering = false

    this.onProgress = noop
    this.onLoad = noop
    this.onPlay = noop
    this.onPause = noop
    this.onStop = noop
  }

  /**
   * decodeAudioBuffer
   * ================
   *
   * @private
   *
   * @param {Object} result
   * @param {Uint8Array} result.value
   * @param {Boolean} result.done
   *
   * Decode a data array into an audio buffer.
   */

  _decodeAudioBuffer (value) {
    const {context} = this

    return context.decodeAudioData(value).then((audioBuffer) => {
      // don't try and load anything less than the MIN_DURATION
      if (audioBuffer.duration >= this.minLoadDuration) {
        this._updateAudioBuffer(audioBuffer)
        this.onProgress()
      }
    })
  }

  /**
   * updateAudioBuffer
   * =================
   *
   * @private
   * @param {AudioBuffer} audioBuffer - audio buffer to load
   *
   * Updates the current audio source with a new one from the specified audio
   * buffer. It does it's best to do this without anyone noticing that the
   * change has occured - even if the song is currently playing.
   *
   * This does not change the current time of the track.
   */

  _updateAudioBuffer (audioBuffer) {
    this.audioBuffer = audioBuffer

    this._disposeAudioSource()

    const audioSource = this._createAudioSource()
    this.audioSource = audioSource

    if (!this.paused || this.buffering) {
      this._playAudioBuffer()
    }
  }

  /**
   * createAudioSource
   * ==============
   *
   * @private
   *
   * Create a new audio srouce from the current audio buffer
   */

  _createAudioSource () {
    const {context, audioBuffer} = this

    if (audioBuffer == null) {
      return null
    }

    const audioSource = context.createBufferSource()
    audioSource.buffer = audioBuffer
    audioSource.connect(context.destination)
    audioSource.onended = this._handleBufferEnded.bind(this)
    return audioSource
  }

  /**
   * handleBufferEnded
   * =================
   *
   * @private
   *
   */

  _handleBufferEnded () {
    if (this.loading) {
      this.buffering = true
    }

    this.pause()
  }

  /**
   * playAudioBuffer
   * ===============
   *
   * @private
   */

  _playAudioBuffer () {
    const {context, audioSource} = this

    const currentTime = this.currentTime()
    audioSource.start(0, currentTime)

    this.startTime = context.currentTime - this.currentTime()
    this.pauseTime = null
    this.paused = false
    this.buffering = false
  }

  /**
   * disposeAudioSource
   * ============
   *
   * @private
   *
   * Stop the current audio source. Same as stopping the track, but doesn't
   * fire any events
   */

  _disposeAudioSource () {
    if (this.audioSource != null) {
      try {
        this.audioSource.stop()
      } catch (err) {
        // don't worry, be happy
      }

      this.audioSource.disconnect()
      this.audioSource = null
    }
  }

  _disposePumper () {
    if (this._pumper != null) {
      this._pumper.cancel()
    }
  }

  _disposeAudioBuffer () {
    this.audioBuffer = null
    this.startTime = null
    this.pauseTime = null
    this.loading = false
    this.paused = true
    this.buffering = false
  }

  /** PUBLIC **/

  loadSource (request) {
    this.loading = true
    this._disposePumper()

    const handleDecode = (result) => {
      const {value, done} = result

      if (done) {
        this._lastDecodePromise.then(() => {
          this.loading = false
          this.onLoad()
        })
        return null
      }

      this._lastDecodePromise = this._decodeAudioBuffer(value)
    }

    return fetch(request).then((res) => {
      this._pumper = new Pumper()
      this._pumper.onRead = throttle(handleDecode, this.throttleDecode)
      return this._pumper.pump(res.body.getReader())
    })
  }

  /**
   * buffered
   * ========
   *
   * How much of the current track is buffered. Value is in seconds.
   */

  buffered () {
    const {audioSource} = this

    if (audioSource == null) {
      return 0
    }

    const {duration} = audioSource.buffer

    return duration
  }

  /**
   * currentTime
   * ===========
   *
   * How much of the current track has been played. Value is in seconds.
   */

  currentTime () {
    const {context, audioSource, startTime, pauseTime, paused} = this

    if (audioSource == null || startTime == null) {
      return 0
    }

    const {duration} = audioSource.buffer

    if (paused) {
      const timeSincePause = pauseTime - startTime
      return Math.min(timeSincePause, duration)
    }

    const timeSinceStart = context.currentTime - startTime
    return Math.min(timeSinceStart, duration)
  }

  /**
   * play
   * ====
   *
   * Play the current track. If it has been paused, resume it, else start from
   * the beginning
   */

  play () {
    const {audioSource, paused} = this

    if (audioSource == null) {
      this.paused = false
      this.buffering = true
      return
    }

    if (!paused) {
      return
    }

    this._playAudioBuffer()

    this.onPlay()
  }

  /**
   * pause
   * =====
   *
   * Pause the current track.
   */

  pause () {
    const {context, paused, audioSource} = this

    if (audioSource == null) {
      this.paused = true
      this.buffering = false
      return
    }

    if (paused) {
      return
    }

    this.paused = true
    this.pauseTime = context.currentTime

    audioSource.onended = null
    this._disposeAudioSource()
    this.audioSource = this._createAudioSource()

    this.onPause()
  }

  /**
   * stop
   * ====
   *
   * Stop the current track. Cannot be undone.
   */

  stop () {
    if (this.audioSource != null) {
      this._disposeAudioSource()
      this._disposePumper()
      this._disposeAudioBuffer()
      this.onStop()
    }
  }
}
