import { expect } from 'chai'
import {
  formatTime,
  formatTimeBasedOnYear,
} from '../../../../frontend/js/features/utils/format-date'

describe('numeric history dates', function () {
  it('includes the year and uses a 24-hour clock for recent dates', function () {
    expect(formatTimeBasedOnYear(new Date(2026, 9, 19, 15, 4))).to.equal(
      '2026-10-19 15:04'
    )
  })

  it('uses the same format for dates in previous years', function () {
    expect(formatTimeBasedOnYear(new Date(2020, 0, 2, 0, 5))).to.equal(
      '2020-01-02 00:05'
    )
  })

  it('preserves explicit UTC formatting across a date boundary', function () {
    expect(
      formatTime('2026-12-31T23:30:00-08:00', 'YYYY-MM-DD HH:mm', true)
    ).to.equal('2027-01-01 07:30')
  })
})
