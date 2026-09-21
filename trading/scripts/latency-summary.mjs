export function latencySummary(values) {
  const sorted = values.filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!sorted.length) return { available: false, samples: 0 };
  const percentile = fraction => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
  return { available: true, samples: sorted.length, mean_ms: sorted.reduce((a, b) => a + b, 0) / sorted.length, p50_ms: percentile(0.5), p95_ms: percentile(0.95), p99_ms: percentile(0.99), max_ms: sorted.at(-1) };
}
