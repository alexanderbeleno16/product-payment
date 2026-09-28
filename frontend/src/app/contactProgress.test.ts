import { clearContactProgress, readContactProgress, writeContactProgress } from './contactProgress'
import { HEADPHONES_PRODUCT_ID } from '../features/checkout/productImages'
import { emptyCardForm } from '../features/checkout/cardForm'

beforeEach(() => sessionStorage.clear())

test('stores only contact and delivery fields in this tab', () => {
  const fullForm = { ...emptyCardForm,
    customerEmail: 'buyer@example.test', recipientName: 'Buyer', addressLine: 'Street 1', city: 'Bogotá',
    number: '4111111111111111', cvc: '123', cardHolder: 'Private', expMonth: '12', expYear: '29',
    policyAccepted: true, dataAccepted: true }
  writeContactProgress(HEADPHONES_PRODUCT_ID, fullForm)
  const stored = sessionStorage.getItem('shopifast-contact-progress')!
  expect(stored).toContain('buyer@example.test')
  for (const forbidden of ['4111111111111111', '123', 'Private', 'expMonth', 'expYear', 'policyAccepted', 'dataAccepted'])
    expect(stored).not.toContain(forbidden)
  expect(readContactProgress(HEADPHONES_PRODUCT_ID)).toEqual({
    customerEmail: 'buyer@example.test', recipientName: 'Buyer', addressLine: 'Street 1', city: 'Bogotá',
  })
  clearContactProgress()
  expect(readContactProgress(HEADPHONES_PRODUCT_ID)).toBeNull()
})

test('rejects contact progress for another product or unexpected stored fields', () => {
  writeContactProgress(HEADPHONES_PRODUCT_ID, { ...emptyCardForm })
  expect(readContactProgress('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBeNull()
  sessionStorage.setItem('shopifast-contact-progress', JSON.stringify({
    version: 1, productId: HEADPHONES_PRODUCT_ID, customerEmail: '', recipientName: '',
    addressLine: '', city: '', cardToken: 'forbidden',
  }))
  expect(readContactProgress(HEADPHONES_PRODUCT_ID)).toBeNull()
})

test('bounds every saved contact field and never writes for an invalid product id', () => {
  writeContactProgress(HEADPHONES_PRODUCT_ID, {
    customerEmail: 'e'.repeat(300), recipientName: 'n'.repeat(300),
    addressLine: 'a'.repeat(300), city: 'c'.repeat(300),
  })
  expect(readContactProgress(HEADPHONES_PRODUCT_ID)).toEqual({
    customerEmail: 'e'.repeat(254), recipientName: 'n'.repeat(120),
    addressLine: 'a'.repeat(240), city: 'c'.repeat(120),
  })
  const saved = sessionStorage.getItem('shopifast-contact-progress')
  writeContactProgress('not-a-product-id', {
    customerEmail: 'other@example.test', recipientName: 'Other', addressLine: 'Other', city: 'Other',
  })
  expect(sessionStorage.getItem('shopifast-contact-progress')).toBe(saved)
})
