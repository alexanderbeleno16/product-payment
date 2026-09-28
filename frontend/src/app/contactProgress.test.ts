import { clearContactProgress, readContactProgress, writeContactProgress } from './contactProgress'
import { HEADPHONES_PRODUCT_ID } from '../features/checkout/productImages'
import { emptyCardForm } from '../features/checkout/cardForm'

beforeEach(() => sessionStorage.clear())

test('stores only contact and delivery fields in this tab', () => {
  writeContactProgress(HEADPHONES_PRODUCT_ID, { ...emptyCardForm,
    customerEmail: 'buyer@example.test', recipientName: 'Buyer', addressLine: 'Street 1', city: 'Bogotá',
    number: '4111111111111111', cvc: '123', cardHolder: 'Private', expMonth: '12', expYear: '29',
    policyAccepted: true, dataAccepted: true })
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
