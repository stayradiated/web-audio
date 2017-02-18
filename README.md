# Web Audio Stream

So you want the power of the Web Audio API but with support for streaming audio
files? Then this library is for you.

## Todo

 - Find out which browsers support ReadableStreams, because this library depends
on them.

## API Docs

This is just an example of how to use the library at the moment:

```
import WebAudioStream from 'web-audio-stream'

const stream = new WebAudioStream({
  context: new window.AudioContext(),
})

stream.loadSrc('/files/audio.mp3')
stream.play()

console.log(stream.audioSrc) // underlying audio source buffer
```
