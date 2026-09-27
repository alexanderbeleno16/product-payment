import { formatMoney } from './formatMoney'

test('formats whole Colombian pesos in the local grouping style', () => {
  expect(formatMoney(12_990_000)).toMatch(/^COP\s*129\.900$/)
})

test('preserves nonzero centavos instead of rounding to whole pesos', () => {
  expect(formatMoney(12_990_025)).toMatch(/^COP\s*129\.900,25$/)
})
