# #895 paired light-presentation observations

Measured on 2026-10-15, 09:00:41–09:02:17 UTC, in an agreed local quiet
window. These are the actual measured materials, **not a later review SHA**:

| Side | Commit | Tree | Source fingerprint |
|---|---|---|---|
| Base | `fcef2752bfea5ef8292dc14495ad1bc3a6fed2e9` | `8b0ddc5bd0b528180ce07a3bdab605c09dd9fcbe` | `e181a93cc7a7d71273abb734f2b8c3640de89bf179088ee7563afcb73290ed8c` |
| Result | `b6f183533dc2e51abee97bb1933f4021ccbca096` | `a7e726948e43f4c484f7cd4f648467dc0dd7648c` | `ee8741e0aee72932150b965b7a7b97b33197d271f7ece5d58a8cb5dab6decf08` |

One invocation per side, in this order; each invocation made three cold
samples. No retries or discarded samples. Both source trees were clean,
excluding the freshly generated bundles. All six samples reached actual
Live runtime `ready` with an installed capture, `bootSoft=false`,
`booting=false`, continuity `steady`, 200 devices and 50 strips.

```sh
node demo/benchmark_light_presentation.mjs --root=/home/matysh/hp-bench-895-final-base-20261015 --output=/home/matysh/hp-batch-895-20261015/artifacts/895-final-base-perf.json
node demo/benchmark_light_presentation.mjs --root=/home/matysh/hp-batch-895-20261015 --output=/home/matysh/hp-batch-895-20261015/artifacts/895-final-result-perf.json
```

The same runner `fa368de684b968e8120f848a42376f84265dacb581a38519077a732216ec05d3`
from the result checkout observed both sides. Serialized scenario protocol
`1a918fc68c94e7c40f6f8a747b74eef7072a11eb6e8b151c2ac24d3c693a7d5e`,
fixture `60479a958f189fccd73a80d0b2ffc260b427c3e5312221d7d293437c83be3cd5`
and unchanged budget file
`2937d16ac424b29e7396ee257df4863f93e661aebfc9c421e0c743fa33f85f44`
identify the workload. Pins, environment and all per-file input hashes are
in the two input passports and `summary.json`.

The read-only comparison passed with no failures. Every S2 pair rebuilt
40,000 → 200 presentations (99.5% fewer); every sample had zero stale
stripes. Tick p95 was 26.3/24.3/24.9 → 12.6/14.2/22.5 ms. The slower third
result is retained, not replaced. Full CPU profiles, raw ticks and capture
samples for all four scenarios are preserved byte-for-byte in the gzip files.

| File | Bytes | SHA256 |
|---|---:|---|
| `base-perf.json.gz` | 427279 | `ffe5838db6a0155263fab2909cc0197f98edb1e1d655a928024b3e7d2b84c7b8` |
| `result-perf.json.gz` | 367535 | `7438c15bad99a86e4d2d72063bbf523242baf8dc817e0845f4f228f6770eb82c` |
| `summary.json` | 16345 | `d25d4959bd60a7ffc9d733ca8f9cfbf031ced2cb05181c1f424b89291cbead58` |
| `comparison.json` | 3532 | `ba44fcf6d5336ba5ff8040d9fcdbd44d8762e80211fb358bd99d2cd22823240c` |
| `base-inputs.json` | 42352 | `dcae90378af591eacefa300968e95ccd729af6e617ab9d8b9cd5e9abdfe53d1f` |
| `result-inputs.json` | 42448 | `e1107d62dc591c2b82c204cd8f5d21c6340ab8700e23ed7a137805cc10d75a19` |

Decompressed base: 9,214,807 bytes, SHA256
`1cf068cb66e9b6fd1c5abbd7ca428fe06e290ef70ff7b4fd751242114a2cb52c`.
Decompressed result: 7,887,774 bytes, SHA256
`775243024528df59521a37da523cacd46bf7d113cde7ec3d4315abfe18cc15ae`.
Decompression was checked against the unmodified original reports.

These are bounded paired wall-time and sampled-CPU observations, not a new
timing budget, OS CPU accounting, compositor/real-GPU or owner field
acceptance. They do not replace the official absolute seven-sample profiles.
Final accepted-base/input equivalence and final review/CI remain separate;
changed executable inputs require a new explicitly identified cohort. The
older pre-#867 receipts remain historical and were not upgraded to the new
Live-readiness observer. This evidence commit did not itself execute a new
benchmark.
