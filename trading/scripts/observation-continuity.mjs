// Sampling continuity is separate from WebSocket sequence continuity: suspension
// can pause the entire host without losing any sequence numbers.
export function observationContinuity(samples, maxGapMs = 15_000) {
  const gaps = [];
  let maxObservedGap = 0;
  let segmentStart = samples[0];
  let longestSegment = 0;
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1], current = samples[i];
    const elapsed = current.elapsed_ms - previous.elapsed_ms;
    maxObservedGap = Math.max(maxObservedGap, elapsed);
    if (elapsed > maxGapMs || elapsed < 0) {
      longestSegment = Math.max(longestSegment, previous.elapsed_ms - segmentStart.elapsed_ms);
      gaps.push({ from: previous.at, to: current.at, elapsed_ms: elapsed, command_delta: current.event_seq - previous.event_seq });
      segmentStart = current;
    }
  }
  if (samples.length) longestSegment = Math.max(longestSegment, samples.at(-1).elapsed_ms - segmentStart.elapsed_ms);
  return { max_allowed_gap_ms: maxGapMs, max_observed_gap_ms: maxObservedGap, gaps, longest_contiguous_sample_span_ms: longestSegment, continuous: samples.length >= 2 && gaps.length === 0 };
}
