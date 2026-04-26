import { SOLVED_STATE, applyAlgorithm, invertAlgorithm } from '@rubik/cube-core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { F2LView } from './F2LView'
import { OLLView } from './OLLView'
import { PLLView } from './PLLView'
import { TopView } from './TopView'

describe('TopView (SSR)', () => {
  it('renders an svg element with the requested viewBox', () => {
    const html = renderToStaticMarkup(<TopView state={SOLVED_STATE} size={200} />)
    expect(html).toContain('<svg')
    expect(html).toContain('viewBox="0 0 200 200"')
  })

  it('emits 21 sticker rects on the default top-view layout', () => {
    const html = renderToStaticMarkup(<TopView state={SOLVED_STATE} />)
    const rects = html.match(/<rect /g) ?? []
    expect(rects).toHaveLength(21)
  })

  it('uses the white sticker color for the U center', () => {
    const html = renderToStaticMarkup(<TopView state={SOLVED_STATE} />)
    expect(html).toContain('#ffffff')
  })

  it('renders a custom title in <title>', () => {
    const html = renderToStaticMarkup(<TopView state={SOLVED_STATE} title="T-perm" />)
    expect(html).toContain('<title>T-perm</title>')
  })
})

describe('PLLView (SSR)', () => {
  it('renders pure SVG with no client JS markers', () => {
    const tperm = applyAlgorithm(
      SOLVED_STATE,
      invertAlgorithm("R U R' U' R' F R2 U' R' U' R U R' F'"),
    )
    const html = renderToStaticMarkup(<PLLView state={tperm} />)
    expect(html).toContain('<svg')
    expect(html).not.toContain('useState')
    expect(html).not.toContain('onClick')
  })
})

describe('OLLView (SSR)', () => {
  it('without highlight, renders state colors as-is', () => {
    const sune = applyAlgorithm(
      SOLVED_STATE,
      invertAlgorithm("R U R' U R U2 R'"),
    )
    const html = renderToStaticMarkup(<OLLView state={sune} />)
    expect(html).toContain('<svg')
  })

  it('with highlightOriented, masks non-U U-face stickers as neutral', () => {
    const sune = applyAlgorithm(
      SOLVED_STATE,
      invertAlgorithm("R U R' U R U2 R'"),
    )
    const masked = renderToStaticMarkup(<OLLView state={sune} highlightOriented />)
    const unmasked = renderToStaticMarkup(<OLLView state={sune} />)
    expect(masked).not.toBe(unmasked)
  })
})

describe('F2LView (SSR)', () => {
  it('renders an extended grid (taller than top view)', () => {
    const html = renderToStaticMarkup(<F2LView state={SOLVED_STATE} size={200} />)
    expect(html).toContain('<svg')
    const viewBoxMatch = html.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
    expect(viewBoxMatch).not.toBeNull()
    const width = Number(viewBoxMatch![1])
    const height = Number(viewBoxMatch![2])
    expect(height).toBeGreaterThan(width)
  })
})
