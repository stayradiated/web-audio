import test from 'ava'
import sinon from 'sinon'

import WebAudio from '../lib/WebAudio'
import createReadableStream from './helpers/ReadableStream'

const CURRENT_TIME = 100 // seconds

const secondsAgo = (seconds) => {
  return CURRENT_TIME - seconds
}

const createAudioBuffer = (duration = 5) => {
  return {
    duration,
  }
}

const createAudioSource = (buffer) => {
  return {
    buffer,
    connect: sinon.spy(),
    disconnect: sinon.spy(),
    start: sinon.spy(),
    stop: sinon.spy(),
  }
}

const createAudioContext = (audioBuffer, audioSource) => {
  return {
    currentTime: CURRENT_TIME,
    decodeAudioData: sinon.stub().returns(Promise.resolve(audioBuffer)),
    createBufferSource: sinon.stub().returns(audioSource),
    destination: null,
  }
}

test.beforeEach((t) => {
  const duration = 30
  const buffer = createAudioBuffer(duration)
  const source = createAudioSource(buffer)
  const context = createAudioContext(buffer, source)
  const audio = new WebAudio({context, throttleDecode: 0})

  t.context = {
    duration,
    buffer,
    source,
    context,
    audio,
  }
})

test('constructor', (t) => {
  const {context, audio} = t.context

  t.is(audio.context, context)
  t.is(audio.audioBuffer, null)
  t.is(audio.audioSource, null)
  t.is(audio.startTime, null)
  t.is(audio.pauseTime, null)
  t.is(audio.loading, false)
  t.is(audio.paused, true)
  t.is(audio.buffering, false)
  t.true(typeof audio.onProgress === 'function')
  t.true(typeof audio.onLoad === 'function')
  t.true(typeof audio.onPlay === 'function')
  t.true(typeof audio.onPause === 'function')
  t.true(typeof audio.onStop === 'function')
})

test('loadSource (paused)', (t) => {
  const {audio, context, buffer, source} = t.context

  const reader = createReadableStream([
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ])

  const request = {}

  const response = {
    body: {
      getReader: () => reader,
    },
  }

  global.fetch = sinon.stub()
  global.fetch.returns(Promise.resolve(response))

  audio.onLoad = sinon.spy()
  audio.onProgress = sinon.spy()

  return audio.loadSource(request).then(() => {
    t.deepEqual(global.fetch.args, [[request]])
    t.deepEqual(context.decodeAudioData.args, [
      [new Uint8Array([1, 2, 3]).buffer],
      [new Uint8Array([1, 2, 3, 4, 5, 6]).buffer],
      [new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]).buffer],
    ])
    t.false(audio.loading)
    t.true(audio.onLoad.calledOnce)
    t.is(audio.onProgress.callCount, 3)
    t.is(audio.audioBuffer, buffer)
    t.is(context.createBufferSource.callCount, 3)
    t.is(audio.audioSource, source)
    t.is(audio.audioSource.buffer, buffer)
    t.true(source.connect.calledWith(context.destination))
  })
})

test('buffered - no audio source', (t) => {
  const {audio} = t.context
  t.is(audio.buffered(), 0)
})

test('buffered - with audio source', (t) => {
  const {audio, source, duration} = t.context
  audio.audioSource = source
  t.is(audio.buffered(), duration)
})

test('currentTime - no audio source', (t) => {
  const {audio} = t.context
  t.is(audio.currentTime(), 0)
})

test('currentTime - with audio source (playing)', (t) => {
  const {audio, source} = t.context

  audio.paused = false
  audio.startTime = secondsAgo(10)

  audio.audioSource = source

  t.is(audio.currentTime(), 10)
})

test('currentTime - with completed audio source (playing)', (t) => {
  const {audio} = t.context

  audio.paused = false
  audio.startTime = secondsAgo(10)

  audio.audioSource = createAudioSource(createAudioBuffer(2))

  t.is(audio.currentTime(), 2)
})

test('currentTime - with audio source (paused)', (t) => {
  const {audio} = t.context

  audio.paused = true
  audio.startTime = secondsAgo(15)
  audio.pauseTime = secondsAgo(10)

  audio.audioSource = {
    buffer: {
      duration: 30, // seconds
    },
  }

  t.is(audio.currentTime(), 5)
})


test('currentTime - with completed audio source (paused)', (t) => {
  const {audio} = t.context

  audio.paused = true
  audio.startTime = secondsAgo(15)
  audio.pauseTime = secondsAgo(10)

  audio.audioSource = {
    buffer: {
      duration: 2, // seconds
    },
  }

  t.is(audio.currentTime(), 2)
})


test('play - no audio source', (t) => {
  const {audio} = t.context

  t.is(audio.paused, true)
  t.is(audio.buffering, false)

  audio.play()

  t.is(audio.paused, false)
  t.is(audio.buffering, true)
})

test('play - with audio source (playing)', (t) => {
  const {audio} = t.context

  audio.paused = false
  audio.audioSource = {}
  audio.onPlay = sinon.spy()

  audio.play()

  t.false(audio.onPlay.called)
})

test('play - with audio source (paused)', (t) => {
  const {audio, source} = t.context

  audio.paused = true
  audio.audioSource = source
  audio.startTime = secondsAgo(10)
  audio.pauseTime = secondsAgo(5)
  audio.onPlay = sinon.spy()

  audio.play()

  t.deepEqual(audio.audioSource.start.args, [
    [0, 5],
  ])
})

test('pause - without audio source', (t) => {
  const {audio} = t.context

  audio.paused = false
  audio.buffering = true
  audio.onPause = sinon.spy()

  audio.pause()

  t.true(audio.paused)
  t.false(audio.buffering)
  t.true(audio.onPause.notCalled)
})

test('pause - with audio source (paused)', (t) => {
  const {audio, source} = t.context

  audio.audioSource = source
  audio.paused = true
  audio.onPause = sinon.spy()

  audio.pause()

  t.true(audio.paused)
  t.false(audio.buffering)
  t.true(audio.onPause.notCalled)
})

test('pause - with audio source (playing)', (t) => {
  const {context, audio, source, buffer} = t.context

  audio.audioBuffer = buffer
  audio.audioSource = source
  audio.paused = false
  audio.onPause = sinon.spy()

  audio.pause()

  t.true(audio.paused)
  t.false(audio.buffering)

  t.true(context.createBufferSource.calledOnce)
  t.is(audio.audioSource, source)
  t.true(audio.onPause.calledOnce)
})

test('stop - without audio source', (t) => {
  const {audio} = t.context

  audio.onStop = sinon.spy()

  audio.stop()

  t.true(audio.onStop.notCalled)
})

test('stop - with audio source', (t) => {
  const {audio, source, buffer} = t.context

  audio.audioSource = source
  audio.audioBuffer = buffer
  audio.onStop = sinon.spy()

  audio.stop()

  t.true(source.stop.calledOnce)
  t.true(source.disconnect.calledOnce)
  t.is(audio.audioSource, null)

  t.is(audio.audioBuffer, null)
  t.is(audio.startTime, null)
  t.is(audio.pauseTime, null)
  t.false(audio.loading)
  t.true(audio.paused)
  t.false(audio.buffering)

  t.true(audio.onStop.calledOnce)
})
