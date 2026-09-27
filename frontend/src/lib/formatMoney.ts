const wholePesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  currencyDisplay: 'code',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const fractionalPesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  currencyDisplay: 'code',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(cents: number): string {
  return (cents % 100 === 0 ? wholePesos : fractionalPesos).format(cents / 100)
}
