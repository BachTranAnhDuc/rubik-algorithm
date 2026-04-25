import { describe, expect, it } from 'vitest'

import { err, isErr, isOk, mapOk, ok, type Result, unwrap } from './result'

describe('Result', () => {
  it('ok wraps a value', () => {
    const r = ok(42)
    expect(r.ok).toBe(true)
    expect(isOk(r)).toBe(true)
    expect(isErr(r)).toBe(false)
  })

  it('err wraps an error', () => {
    const r = err('boom')
    expect(r.ok).toBe(false)
    expect(isErr(r)).toBe(true)
    expect(isOk(r)).toBe(false)
  })

  it('unwrap returns the value for Ok', () => {
    expect(unwrap(ok('hi'))).toBe('hi')
  })

  it('unwrap throws for Err', () => {
    expect(() => unwrap(err('boom'))).toThrow(/boom/)
  })

  it('mapOk transforms an Ok value, leaves Err untouched', () => {
    const r1: Result<number, string> = ok(2)
    const mapped = mapOk(r1, (n) => n * 3)
    expect(mapped).toEqual(ok(6))

    const r2: Result<number, string> = err('boom')
    const mapped2 = mapOk(r2, (n) => n * 3)
    expect(mapped2).toEqual(err('boom'))
  })
})
