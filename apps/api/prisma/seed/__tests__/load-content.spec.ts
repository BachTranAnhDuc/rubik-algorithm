import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadContent } from '../load-content'

const FIXTURE_ROOT = join(__dirname, 'fixtures', 'sample-tree')

describe('loadContent', () => {
  it('walks the tree and parses every yaml file into a typed bundle', async () => {
    const bundle = await loadContent(FIXTURE_ROOT)

    expect(bundle.puzzles).toHaveLength(1)
    expect(bundle.puzzles[0].data.slug).toBe('3x3')

    expect(bundle.methods).toHaveLength(1)
    expect(bundle.methods[0].puzzleSlug).toBe('3x3')
    expect(bundle.methods[0].data.slug).toBe('cfop')

    expect(bundle.sets).toHaveLength(1)
    expect(bundle.sets[0].puzzleSlug).toBe('3x3')
    expect(bundle.sets[0].methodSlug).toBe('cfop')
    expect(bundle.sets[0].data.slug).toBe('pll')

    expect(bundle.cases).toHaveLength(1)
    const tperm = bundle.cases[0]
    expect(tperm.setSlug).toBe('pll')
    expect(tperm.data.slug).toBe('t-perm')
    expect(tperm.data.variants[0].is_primary).toBe(true)
  })

  it('throws when the root directory does not exist', async () => {
    await expect(loadContent('/nonexistent/path/to/content')).rejects.toThrow(/does not exist/)
  })
})
