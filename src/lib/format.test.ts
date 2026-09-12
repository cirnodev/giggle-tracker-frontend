import { describe, expect, it } from 'vitest'
import { formatAmount, formatDate, formatNumber, formatSigned, isUuid } from './format'

describe('format helpers', () => {
  it('renders unknown numeric values as an em dash', () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatAmount(undefined)).toBe('—')
  })

  it('adds a sign only to positive values', () => {
    expect(formatSigned(12.5, '%')).toMatch(/^\+12\.5%$/)
    expect(formatSigned(-4, '%')).toMatch(/^-4%$/)
  })

  it('validates UUID-shaped lookup IDs', () => {
    expect(isUuid('db2bda0c-963e-4d3a-92ee-a54a5cfc9e08')).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
  })

  it('does not render invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('—')
  })
})
