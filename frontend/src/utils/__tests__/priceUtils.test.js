import { describe, it, expect } from 'vitest'
import { getStatusConfig, formatChange } from '../priceUtils'

describe('getStatusConfig', () => {
  it('returns DEAL config for DEAL status', () => {
    const cfg = getStatusConfig('DEAL')
    expect(cfg.label).toBe('DEAL')
    expect(cfg.className).toBe('badge-deal')
    expect(cfg.color).toBe('#3fb950')
  })

  it('returns HOLD config for HOLD status', () => {
    const cfg = getStatusConfig('HOLD')
    expect(cfg.label).toBe('HOLD')
    expect(cfg.className).toBe('badge-hold')
    expect(cfg.color).toBe('#f85149')
  })

  it('returns RECOVERY config', () => {
    const cfg = getStatusConfig('RECOVERY_DEAL')
    expect(cfg.className).toBe('badge-recovery')
    expect(cfg.color).toBe('#bc8cff')
  })

  it('returns STABLE config for STABLE', () => {
    expect(getStatusConfig('STABLE').className).toBe('badge-stable')
  })

  it('falls back to STABLE for unknown status', () => {
    expect(getStatusConfig('UNKNOWN').className).toBe('badge-stable')
  })
})

describe('formatChange', () => {
  it('formats negative change with minus sign', () => {
    expect(formatChange(-1.5)).toBe('-$1.50')
  })

  it('formats positive change with plus sign', () => {
    expect(formatChange(0.75)).toBe('+$0.75')
  })

  it('returns empty string for null', () => {
    expect(formatChange(null)).toBe('')
  })

  it('formats zero as stable', () => {
    expect(formatChange(0)).toBe('+$0.00')
  })
})
