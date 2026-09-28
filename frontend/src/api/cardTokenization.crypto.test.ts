/** @jest-environment node */
/// <reference types="node" />

import { generateKeyPairSync } from 'node:crypto'
import { compactDecrypt } from 'jose'
import { tokenizeCard } from './cardTokenization'

test('encrypts the card with the supplied public key before the token bridge sees it', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const card = {
    number: '4'.repeat(16),
    cvc: '123',
    expMonth: '08',
    expYear: '30',
    cardHolder: 'Fixture Holder',
  }
  let encryptedPayload = ''
  const request = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
    if (input === '/checkout/tokenization-key')
      return new Response(JSON.stringify({ publicKey: pem }), { status: 200 })

    expect(input).toBe('/checkout/card-tokens')
    expect(options?.method).toBe('POST')
    const body = JSON.parse(String(options?.body)) as { payload: string }
    expect(Object.keys(body)).toEqual(['payload'])
    encryptedPayload = body.payload
    expect(encryptedPayload.split('.')).toHaveLength(5)
    expect(encryptedPayload).not.toBe(JSON.stringify(card))
    return new Response(JSON.stringify({ token: 'tok_fixture' }), { status: 201 })
  })

  try {
    await expect(
      tokenizeCard(card, 'pub_stag_fixture', new AbortController().signal),
    ).resolves.toBe('tok_fixture')

    const { plaintext, protectedHeader } = await compactDecrypt(encryptedPayload, privateKey)
    expect(protectedHeader).toEqual({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
    expect(JSON.parse(new TextDecoder().decode(plaintext))).toEqual({
      number: card.number,
      cvc: card.cvc,
      exp_month: card.expMonth,
      exp_year: card.expYear,
      card_holder: card.cardHolder,
    })
    expect(request).toHaveBeenCalledTimes(2)
  } finally {
    request.mockRestore()
  }
})
