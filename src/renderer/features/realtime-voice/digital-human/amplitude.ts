// Amplitude analysis utility for driving digital human mouth animation.
//
// Wraps a Web Audio API AnalyserNode to expose a single getAmplitude() that
// returns a normalized RMS value (0-1). The hook owning the analyser polls
// it via requestAnimationFrame to update the digital human's mouth path.
//
// Used for both mic amplitude (during 'listening') and playback amplitude
// (during 'speaking').

export interface AmplitudeAnalyzer {
  /** Returns the current RMS amplitude (0-1). Returns 0 if no signal. */
  getAmplitude(): number
  /** Stops the analyzer and disconnects the node. */
  dispose(): void
}

/**
 * Create an AmplitudeAnalyzer tapping the given source node.
 * The analyzer is passive - it does not alter the audio graph downstream.
 */
export function createAmplitudeAnalyzer(
  source: AudioNode,
  audioContext: AudioContext,
): AmplitudeAnalyzer {
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0.6
  // AnalyserNode must connect to destination to actually process samples
  // in some browsers. Use a zero-gain node so nothing is audible from this tap.
  const silentGain = audioContext.createGain()
  silentGain.gain.value = 0
  source.connect(analyser)
  analyser.connect(silentGain)
  silentGain.connect(audioContext.destination)

  const buffer = new Uint8Array(analyser.frequencyBinCount)

  return {
    getAmplitude() {
      analyser.getByteTimeDomainData(buffer)
      // Compute RMS amplitude. Byte data is 0-255 centered at 128.
      let sumSq = 0
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128
        sumSq += v * v
      }
      return Math.min(1, Math.sqrt(sumSq / buffer.length) * 2)
    },
    dispose() {
      try {
        source.disconnect(analyser)
        analyser.disconnect(silentGain)
        silentGain.disconnect(audioContext.destination)
      } catch {
        // Best-effort cleanup; nodes may already be disconnected.
      }
    },
  }
}
