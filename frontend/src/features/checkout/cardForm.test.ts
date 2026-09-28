import { cardBrand, emptyCardForm, maskedCardPreview, validateCardForm } from './cardForm'

function syntheticCard(prefix: string): string {
  const start = prefix.padEnd(15, '0')
  for (let digit = 0; digit < 10; digit++) {
    const candidate = `${start}${digit}`
    const values = candidate.split('').reverse().map((value, index) => {
      const number = Number(value)
      const doubled = index % 2 ? number * 2 : number
      return doubled > 9 ? doubled - 9 : doubled
    })
    if (values.reduce((sum, value) => sum + value, 0) % 10 === 0) return candidate
  }
  throw new Error('No synthetic card candidate')
}

const valid = {
  ...emptyCardForm,
  number: syntheticCard('4'),
  cardHolder: 'Persona de Prueba',
  expMonth: '12',
  expYear: '27',
  cvc: String(100 + 23),
  customerEmail: 'test@example.test',
  recipientName: 'Persona de Prueba',
  addressLine: 'Calle de Prueba 123',
  city: 'Bogotá',
  policyAccepted: true,
  dataAccepted: true,
}

test('recognizes Visa and both Mastercard ranges, rejecting other prefixes', () => {
  expect(cardBrand(valid.number)).toBe('visa')
  expect(cardBrand(syntheticCard('52'))).toBe('mastercard')
  expect(cardBrand(syntheticCard('2221'))).toBe('mastercard')
  expect(cardBrand(syntheticCard('2720'))).toBe('mastercard')
  expect(cardBrand(syntheticCard('2220'))).toBe('unknown')
  expect(cardBrand(syntheticCard('2721'))).toBe('unknown')
})

test('accepts a valid form but rejects invalid number, expiry, CVC, and separate consents', () => {
  const today = new Date(2026, 8, 1)
  expect(validateCardForm(valid, today)).toEqual({})
  const invalid = { ...valid, number: valid.number.slice(0, -1) + (valid.number.endsWith('0') ? '1' : '0'),
    expMonth: '08', expYear: '26', cvc: '1', policyAccepted: false, dataAccepted: false }
  const errors = validateCardForm(invalid, today)
  expect(errors.number).toBeDefined()
  expect(errors.expMonth).toBeDefined()
  expect(errors.cvc).toBeDefined()
  expect(errors.policyAccepted).toBeDefined()
  expect(errors.dataAccepted).toBeDefined()
})

test('shows only the first eight digits and masks the rest', () => {
  const preview = maskedCardPreview(valid.number)
  expect(preview).toContain(valid.number.slice(0, 8).replace(/(.{4})/g, '$1 ').trim())
  expect(preview).not.toContain(valid.number.slice(8))
})
