export default class MediaElement {
  constructor (options) {
    const {context} = options

    this.context = context
    this.audioElement = new Audio()
    this.audioElement.crossOrigin = 'anonymous'
    this.audioElement.autoplay = true

    this.audioSource = context.createMediaElementSource(this.audioElement)
    this.audioSource.connect(context.destination)
  }

  loadSource (audioSrc) {
    // NOTE: you must set crossOrigin before src
    this.audioElement.src = audioSrc
  }

  buffered () {
    const {buffered} = this.audioElement
    if (buffered.length <= 0) {
      return 0
    }
    return buffered.end(0)
  }

  currentTime () {
    return this.audioElement.currentTime
  }

  duration () {
    return this.audioElement.duration
  }

  paused () {
    return this.audioElement.paused
  }

  play () {
    return this.audioElement.play()
  }

  pause () {
    return this.audioElement.pause()
  }

  stop () {
    this.audioElement.pause()
    this.audioElement.currentTime = 0
    this.audioElement.src = ''
  }
}
