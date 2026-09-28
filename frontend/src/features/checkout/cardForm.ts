export interface CardFormValues {
  number: string
  cardHolder: string
  expMonth: string
  expYear: string
  cvc: string
  customerEmail: string
  recipientName: string
  addressLine: string
  city: string
  policyAccepted: boolean
  dataAccepted: boolean
}

export type CardFormField = keyof CardFormValues
export type CardFormErrors = Partial<Record<CardFormField, string>>
export type CardBrand = 'visa' | 'mastercard' | 'unknown'

export interface TokenizedCardDelivery {
  cardToken: string
  cardBrand: Exclude<CardBrand, 'unknown'>
  cardLastFour: string
  customerEmail: string
  delivery: { recipientName: string; addressLine: string; city: string }
  consentTokens: { endUserPolicy: string; personalDataAuthorization: string }
}

export const emptyCardForm: CardFormValues = {
  number: '', cardHolder: '', expMonth: '', expYear: '', cvc: '',
  customerEmail: '', recipientName: '', addressLine: '', city: '',
  policyAccepted: false, dataAccepted: false,
}

export function cardBrand(number: string): CardBrand {
  const digits = number.replace(/\D/g, '')
  if (digits.startsWith('4')) return 'visa'
  const firstTwo = Number(digits.slice(0, 2))
  const firstFour = Number(digits.slice(0, 4))
  if (digits.length >= 2 && firstTwo >= 51 && firstTwo <= 55) return 'mastercard'
  if (digits.length >= 4 && firstFour >= 2221 && firstFour <= 2720) return 'mastercard'
  return 'unknown'
}

function passesLuhn(number: string): boolean {
  let sum = 0
  let double = false
  for (let index = number.length - 1; index >= 0; index--) {
    let digit = Number(number[index])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

export function validateCardForm(values: CardFormValues, now = new Date()): CardFormErrors {
  const errors: CardFormErrors = {}
  const digits = values.number.replace(/\D/g, '')
  if (cardBrand(digits) === 'unknown' || digits.length !== 16 || !passesLuhn(digits)) {
    errors.number = 'Ingresa un número válido de Visa o Mastercard.'
  }
  if (!values.cardHolder.trim() || values.cardHolder.trim().length > 120) {
    errors.cardHolder = 'Ingresa el nombre de la tarjeta (máximo 120 caracteres).'
  }
  const month = Number(values.expMonth)
  const year = Number(values.expYear)
  const currentYear = now.getFullYear()
  if (!/^(0[1-9]|1[0-2])$/.test(values.expMonth) || !/^\d{2}$/.test(values.expYear) ||
    currentYear - (currentYear % 100) + year < currentYear ||
    (currentYear - (currentYear % 100) + year === currentYear && month < now.getMonth() + 1) ||
    currentYear - (currentYear % 100) + year > currentYear + 20) {
    errors.expMonth = 'Ingresa una fecha de vencimiento vigente (MM/AA).'
  }
  if (!/^\d{3}$/.test(values.cvc)) errors.cvc = 'Ingresa los 3 dígitos del código de seguridad.'
  const email = values.customerEmail.trim()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.customerEmail = 'Ingresa un correo electrónico válido.'
  }
  if (!values.recipientName.trim() || values.recipientName.trim().length > 120) {
    errors.recipientName = 'Ingresa el nombre de quien recibe (máximo 120 caracteres).'
  }
  if (!values.addressLine.trim() || values.addressLine.trim().length > 240) {
    errors.addressLine = 'Ingresa la dirección de entrega (máximo 240 caracteres).'
  }
  if (!values.city.trim() || values.city.trim().length > 120) {
    errors.city = 'Ingresa la ciudad (máximo 120 caracteres).'
  }
  if (!values.policyAccepted) errors.policyAccepted = 'Debes aceptar los términos de uso.'
  if (!values.dataAccepted) errors.dataAccepted = 'Debes autorizar el tratamiento de datos.'
  return errors
}

export function maskedCardPreview(number: string): string {
  const visible = number.replace(/\D/g, '').slice(0, 8)
  return `${visible.padEnd(8, '•').replace(/(.{4})/g, '$1 ').trim()}  ••••  ••••`
}
