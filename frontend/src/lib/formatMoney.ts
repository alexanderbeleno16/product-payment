const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'COP',
  currencyDisplay: 'code',
  maximumFractionDigits: 0,
})

export function formatMoney(cents: number): string {
  return money.format(cents / 100)
}
