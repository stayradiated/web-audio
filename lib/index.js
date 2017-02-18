import noop from 'nop'

function concatUint8Array (buffer1, buffer2) {
  const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength)
  tmp.set(new Uint8Array(buffer1), 0)
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength)
  return tmp.buffer
}

class Pumper {
  constructor (buffer) {
    this.buffer = buffer
    this.onUpdate = noop
    this.onDone = noop
  }

  append (buffer) {
    this.buffer = concatUint8Array(this.buffer, buffer)
  }

  pump (reader) {
    return reader.read().then((result) => {
      if (result.done) {
        this.onDone(this.buffer)
        return
      }

      const chunk = result.value
      this.append(chunk)
      this.onUpdate(this.buffer)

      return this.pump(reader)
    })
  }
}

export default class WebAudioStream {
  constructor (options) {
    const {
      context,
    } = options

    this.context = context
    this.audioSrc = null
    this.startTime = null
    this.pauseTime = null
    this.paused = false

    this.onProgress = noop
    this.onLoaded = noop

    this.onPlay = noop
    this.onPause = noop
    this.onEnd = noop
  }

  loadSrc (request) {
    return fetch(request).then((res) => {
      const data = new Uint8Array()
      const pumper = new Pumper(data)
      pumper.onUpdate = this.decodeAudioBuffer
      pumper.onDone = this.onLoaded
      pumper.pump(res.body.getReader())
    })
  }

  decodeAudioBuffer (buffer) {
    const {context} = this
    return context.decodeAudioData(buffer).then((audioBuffer) => {
      this.updateAudioBuffer(audioBuffer)
      this.onProgress()
    })
  }

  /**
   * updateAudioBuffer
   * =================
   *
   * @params audioBuffer - audio buffer to load
   *
   * Updates the current audio source with a new one from the specified audio
   * buffer. It does it's best to do this without anyone noticing that the
   * change has occured - even if the song is currently playing.
   *
   * This does not change the current time of the track.
   */

  updateAudioBuffer (audioBuffer) {
    const {context} = this

    const audioSrc = context.createBufferSource()
    audioSrc.buffer = audioBuffer
    audioSrc.connect(context.destination)
    audioSrc.on('end', this.pause)

    if (!this.paused) {
      const currentTime = this.currentTime()
      audioSrc.start(0, currentTime)
    }

    this.disposeAudioSrc()
    this.audioSrc = audioSrc
  }

  /**
   * buffered
   * ========
   *
   * How much of the current track is buffered.
   */

  buffered () {
    const {audioSrc} = this

    if (audioSrc == null) {
      return 0
    }

    return audioSrc.duration
  }

  /**
   * currentTime
   * ===========
   *
   * How much of the current track has been played.
   */

  currentTime () {
    const {context, audioSrc, startTime, pauseTime, paused} = this

    if (audioSrc == null || startTime == null) {
      return 0
    }

    const {duration} = audioSrc

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
    const {context, audioSrc, paused} = this

    if (!paused || audioSrc == null) {
      return
    }

    const currentTime = this.currentTime()
    audioSrc.start(0, currentTime)

    this.startTime = context.currentTime - this.currentTime()
    this.pauseTime = null
    this.paused = false

    this.onPlay()
  }

  /**
   * pause
   * =====
   *
   * Pause the current track.
   */

  pause () {
    const {context, paused, audioSrc} = this

    if (paused) {
      return
    }

    this.paused = true
    this.pauseTime = context.currentTime
    audioSrc.onended = null
    this.stop()

    this.onPause()
  }

  /**
   * stop
   * ====
   *
   * Stop the current track. Cannot be undone.
   */

  stop () {
    if (this.audioSrc != null) {
      this.disposeAudioSrc()
      this.onStop()
    }
  }

  /**
   * disposeAudioSrc
   * ===============
   *
   * Dispose the current audio source. Same as stopping the track, but doesn't
   * fire any events
   */

  disposeAudioSrc () {
    if (this.audioSrc != null) {
      this.audioSrc.stop()
      this.audioSrc.disconnect()
      this.audioSrc = null
    }
  }
}
