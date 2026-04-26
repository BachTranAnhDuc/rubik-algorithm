// Client entry point. Will lazy-load three.js + R3F for the interactive 3D
// Visualizer; consumers reach this via `next/dynamic({ ssr: false })`.
//
// In v1 the client surface is intentionally limited to the SSR exports — the
// 3D Visualizer ships in a follow-up phase per plan 04 §3 (three.js scene)
// and §4 (React layer wrapping). Re-exporting the SVG views here keeps the
// import shape stable for downstream consumers.

export * from './ssr'
