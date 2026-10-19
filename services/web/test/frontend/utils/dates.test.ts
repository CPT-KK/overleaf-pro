import { expect } from 'chai'
import { formatDate } from '../../../frontend/js/utils/dates'

describe('formatDate', function () {
  it('defaults to a numeric date and 24-hour time', function () {
    expect(formatDate(new Date(2026, 9, 19, 15, 4))).to.equal(
      '2026-10-19 15:04'
    )
  })

  it('pads midnight and single-digit dates', function () {
    expect(formatDate(new Date(2026, 0, 2, 0, 5))).to.equal(
      '2026-01-02 00:05'
    )
  })

  it('preserves an explicitly requested format', function () {
    expect(formatDate(new Date(2026, 9, 19, 15, 4), 'YYYY/MM/DD')).to.equal(
      '2026/10/19'
    )
  })

  it('returns N/A for missing dates', function () {
    expect(formatDate(null)).to.equal('N/A')
    expect(formatDate(undefined)).to.equal('N/A')
    expect(formatDate('')).to.equal('N/A')
  })
})
