import { Provider } from 'react-redux'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeStore } from '../../app/store'
import { tokenizeCard } from '../../api/cardTokenization'
import CardDeliveryDialog from './CardDeliveryDialog'

jest.mock('../../api/cardTokenization', () => ({
  TokenizationError: class extends Error { reason = 'unavailable' },
  tokenizeCard: jest.fn(),
}))
const tokenizationMock = tokenizeCard as jest.MockedFunction<typeof tokenizeCard>

beforeEach(() => {
  tokenizationMock.mockReset()
  tokenizationMock.mockResolvedValue('opaque-test-token')
})

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const consents = {
  publicKey: 'pub_test_synthetic',
  endUserPolicy: { token: 'policy-synthetic', permalink: 'https://example.test/policy' },
  personalDataAuthorization: { token: 'data-synthetic', permalink: 'https://example.test/data' },
}

function mount(onPrepared = jest.fn()) {
  render(<Provider store={makeStore()}><CardDeliveryDialog onPrepared={onPrepared} /></Provider>)
  return onPrepared
}

function syntheticVisa(): string {
  const prefix = '4'.padEnd(15, '0')
  for (let digit = 0; digit < 10; digit++) {
    const candidate = `${prefix}${digit}`
    let sum = 0
    for (let index = 0; index < candidate.length; index++) {
      let value = Number(candidate[candidate.length - 1 - index])
      if (index % 2) value = value * 2 > 9 ? value * 2 - 9 : value * 2
      sum += value
    }
    if (sum % 10 === 0) return candidate
  }
  throw new Error('No synthetic candidate')
}

async function completeForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Número de tarjeta'), syntheticVisa())
  await user.type(screen.getByLabelText('Nombre en la tarjeta'), 'Persona de Prueba')
  await user.type(screen.getByLabelText('Mes de vencimiento (MM)'), '12')
  await user.type(screen.getByLabelText('Año de vencimiento (AA)'), '28')
  await user.type(screen.getByLabelText('Código de seguridad (CVC)'), '123')
  await user.type(screen.getByLabelText('Correo electrónico'), 'test@example.test')
  await user.type(screen.getByLabelText('Nombre de quien recibe'), 'Persona de Prueba')
  await user.type(screen.getByLabelText('Dirección de entrega'), 'Calle de Prueba 123')
  await user.type(screen.getByLabelText('Ciudad'), 'Bogotá')
  const [policy, data] = screen.getAllByRole('checkbox')
  await user.click(policy)
  await user.click(data)
}

test('opens a modal, loads separate unchecked consent links, and closes on Escape', async () => {
  const fetchMock = jest.fn(async () => response(consents))
  globalThis.fetch = fetchMock
  const opener = document.createElement('button')
  document.body.append(opener)
  opener.focus()
  const store = makeStore()
  render(<Provider store={store}><CardDeliveryDialog onPrepared={jest.fn()} /></Provider>)
  expect(screen.getByRole('dialog', { name: 'Tarjeta y entrega' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Tarjeta y entrega' })).toHaveFocus()
  expect(await screen.findByRole('link', { name: 'términos de uso' })).toHaveAttribute('href', consents.endUserPolicy.permalink)
  expect(screen.getByRole('link', { name: 'tratamiento de datos personales' })).toHaveAttribute('href', consents.personalDataAuthorization.permalink)
  expect(screen.getAllByRole('checkbox').every((control) => !(control as HTMLInputElement).checked)).toBe(true)
  const authorizations = screen.getByRole('group', { name: 'Autorizaciones' })
  expect(authorizations.nextElementSibling).toHaveClass('card-dialog__actions')
  expect(fetchMock).toHaveBeenCalledWith('/checkout/consents', expect.objectContaining({ cache: 'no-store' }))
  const dialog = screen.getByRole('dialog')
  dialog.dispatchEvent(new Event('cancel', { bubbles: false, cancelable: true }))
  await waitFor(() => expect(store.getState().checkout.step).toBe('product'))
  opener.remove()
})

test('keeps submission disabled on consent error and offers retry', async () => {
  const fetchMock = jest.fn().mockResolvedValueOnce(response(null, 503)).mockResolvedValueOnce(response(consents))
  globalThis.fetch = fetchMock
  mount()
  expect(await screen.findByText('No pudimos cargar los documentos vigentes.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Continuar al resumen' })).toBeDisabled()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByRole('link', { name: 'términos de uso' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Continuar al resumen' })).toBeEnabled()
})

test('validates form, detects brand, masks preview, and never displays the security code', async () => {
  globalThis.fetch = jest.fn(async () => response(consents))
  const user = userEvent.setup()
  const onPrepared = mount()
  await screen.findByRole('link', { name: 'términos de uso' })
  await user.click(screen.getByRole('button', { name: 'Continuar al resumen' }))
  expect(screen.getByLabelText('Número de tarjeta')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText('Número de tarjeta')).toHaveFocus()
  expect(onPrepared).not.toHaveBeenCalled()
  await user.type(screen.getByLabelText('Número de tarjeta'), '4')
  expect(screen.getByText('Visa', { selector: '.card-brand' })).toBeVisible()
  expect(document.querySelector('.card-preview__number')?.textContent).toContain('4•••')
  await user.type(screen.getByLabelText('Código de seguridad (CVC)'), String(100 + 23))
  expect(document.querySelector('.card-preview')).toHaveClass('card-preview--reverse')
  expect(document.querySelector('.card-preview__code')).toHaveTextContent('•••')
  expect(document.querySelector('.card-preview__code')).not.toHaveTextContent(String(100 + 23))
})

test('shows associated errors on blur and clears each visited field when corrected', async () => {
  globalThis.fetch = jest.fn(async () => response(consents))
  const user = userEvent.setup()
  mount()
  await screen.findByRole('link', { name: 'términos de uso' })
  for (const label of [
    'Número de tarjeta', 'Nombre en la tarjeta', 'Mes de vencimiento (MM)',
    'Año de vencimiento (AA)', 'Código de seguridad (CVC)', 'Correo electrónico',
    'Nombre de quien recibe', 'Dirección de entrega', 'Ciudad',
  ]) {
    const field = screen.getByLabelText(label)
    await user.click(field)
    await user.tab()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAttribute('aria-describedby')
    expect(document.getElementById(field.getAttribute('aria-describedby')!)).toBeVisible()
  }
  const month = screen.getByLabelText('Mes de vencimiento (MM)')
  await user.type(month, '31')
  expect(month).toHaveValue('31')
  expect(month).toHaveAttribute('aria-invalid', 'true')
  const year = screen.getByLabelText('Año de vencimiento (AA)')
  await user.type(year, '10')
  expect(year).toHaveValue('10')
  expect(year).toHaveAttribute('aria-invalid', 'true')
  await user.clear(month)
  await user.type(month, '12')
  await user.clear(year)
  await user.type(year, '28')
  expect(month).toHaveAttribute('aria-invalid', 'false')
  expect(year).toHaveAttribute('aria-invalid', 'false')
  const email = screen.getByLabelText('Correo electrónico')
  await user.type(email, 'asdasd@asdasd')
  expect(email).toHaveAttribute('aria-invalid', 'true')
  await user.clear(email)
  await user.type(email, 'persona@example.com')
  expect(email).toHaveAttribute('aria-invalid', 'false')
  const number = screen.getByLabelText('Número de tarjeta')
  await user.type(number, syntheticVisa())
  expect(number).toHaveAttribute('aria-invalid', 'false')
  await user.type(screen.getByLabelText('Ciudad'), 'Bogotá')
  expect(screen.getByLabelText('Ciudad')).toHaveAttribute('aria-invalid', 'false')
  expect(tokenizationMock).not.toHaveBeenCalled()
})

test('keeps field length affordances without silently changing invalid values', async () => {
  globalThis.fetch = jest.fn(async () => response(consents))
  const user = userEvent.setup()
  mount()
  for (const [label, length] of [
    ['Número de tarjeta', 23], ['Nombre en la tarjeta', 120],
    ['Mes de vencimiento (MM)', 2], ['Año de vencimiento (AA)', 2],
    ['Código de seguridad (CVC)', 3], ['Correo electrónico', 254],
    ['Nombre de quien recibe', 120], ['Dirección de entrega', 240], ['Ciudad', 120],
  ] as const) {
    expect(screen.getByLabelText(label)).toHaveAttribute('maxLength', String(length))
  }
  const month = screen.getByLabelText('Mes de vencimiento (MM)')
  await user.type(month, '31')
  await user.tab()
  expect(month).toHaveValue('31')
  expect(month).toHaveAttribute('aria-invalid', 'true')
})

test('bounds the card number to 16 digits while accepting grouped paste', async () => {
  globalThis.fetch = jest.fn(async () => response(consents))
  const user = userEvent.setup()
  const onPrepared = mount()
  await screen.findByRole('link', { name: 'términos de uso' })
  const number = screen.getByLabelText('Número de tarjeta')
  const card = syntheticVisa()
  await user.type(number, `${card}9`)
  expect(number).toHaveValue(card)
  await user.clear(number)
  await user.click(number)
  await user.paste(card.match(/.{4}/g)!.join(' '))
  expect(number).toHaveValue(card)
  expect(number).toHaveAttribute('aria-invalid', 'false')
  await user.clear(number)
  await user.paste(`${card}9`)
  expect(number).toHaveValue('')
  await user.type(number, '4x')
  await user.tab()
  expect(number).toHaveValue('4x')
  expect(number).toHaveAttribute('aria-invalid', 'true')
  await user.click(screen.getByRole('button', { name: 'Continuar al resumen' }))
  expect(number).toHaveFocus()
  expect(tokenizationMock).not.toHaveBeenCalled()
  expect(onPrepared).not.toHaveBeenCalled()
})

test('rejects malformed expiry and email at submit without tokenization', async () => {
  globalThis.fetch = jest.fn(async () => response(consents))
  const user = userEvent.setup()
  const onPrepared = mount()
  await screen.findByRole('link', { name: 'términos de uso' })
  await completeForm(user)
  const month = screen.getByLabelText('Mes de vencimiento (MM)')
  const year = screen.getByLabelText('Año de vencimiento (AA)')
  const email = screen.getByLabelText('Correo electrónico')
  await user.clear(month)
  await user.type(month, '31')
  await user.clear(year)
  await user.type(year, '10')
  await user.clear(email)
  await user.type(email, 'asdasd@asdasd')
  await user.click(screen.getByRole('button', { name: 'Continuar al resumen' }))
  expect(month).toHaveFocus()
  expect(month).toHaveAttribute('aria-invalid', 'true')
  expect(year).toHaveAttribute('aria-invalid', 'true')
  expect(email).toHaveAttribute('aria-invalid', 'true')
  expect(tokenizationMock).not.toHaveBeenCalled()
  expect(onPrepared).not.toHaveBeenCalled()
})

test('keeps native group legends and a live brand beside the card-number label', async () => {
  globalThis.fetch = jest.fn(async () => response(consents))
  const user = userEvent.setup()
  mount()
  await screen.findByRole('link', { name: 'términos de uso' })

  for (const title of ['Datos de la tarjeta', 'Contacto y entrega', 'Autorizaciones']) {
    const group = screen.getByRole('group', { name: title })
    expect(group.querySelector('legend')).toHaveTextContent(title)
  }

  const number = screen.getByLabelText('Número de tarjeta')
  const heading = number.previousElementSibling as HTMLElement
  expect(heading).toHaveClass('card-field__heading')
  expect(heading.querySelector('label')).toHaveTextContent('Número de tarjeta')
  expect(heading.querySelector('.card-brand')).toHaveTextContent('Visa o Mastercard')
  await user.click(heading.querySelector('label') as HTMLElement)
  expect(number).toHaveFocus()
  await user.type(number, '4')
  expect(heading.querySelector('.card-brand')).toHaveTextContent('Visa')
  await user.clear(number)
  await user.type(number, '2221')
  expect(heading.querySelector('.card-brand')).toHaveTextContent('Mastercard')
  expect(screen.getByLabelText('Código de seguridad (CVC)')).toHaveAttribute('type', 'password')
})

test('submits only after valid delivery and both explicit consents', async () => {
  globalThis.fetch = jest.fn(async () => response(consents))
  const user = userEvent.setup()
  const onPrepared = mount()
  await screen.findByRole('link', { name: 'términos de uso' })
  const card = syntheticVisa()
  await user.type(screen.getByLabelText('Número de tarjeta'), card)
  await user.type(screen.getByLabelText('Nombre en la tarjeta'), 'Persona de Prueba')
  await user.type(screen.getByLabelText('Mes de vencimiento (MM)'), '12')
  await user.type(screen.getByLabelText('Año de vencimiento (AA)'), '28')
  await user.type(screen.getByLabelText('Código de seguridad (CVC)'), String(100 + 23))
  await user.type(screen.getByLabelText('Correo electrónico'), 'test@example.test')
  await user.type(screen.getByLabelText('Nombre de quien recibe'), 'Persona de Prueba')
  await user.type(screen.getByLabelText('Dirección de entrega'), 'Calle de Prueba 123')
  await user.type(screen.getByLabelText('Ciudad'), 'Bogotá')
  await user.click(screen.getByRole('button', { name: 'Continuar al resumen' }))
  expect(onPrepared).not.toHaveBeenCalled()
  expect(screen.getAllByRole('checkbox').every((control) => control.getAttribute('aria-invalid') === 'true')).toBe(true)
  const [policy, data] = screen.getAllByRole('checkbox')
  await user.click(policy)
  await user.click(data)
  await user.click(screen.getByRole('button', { name: 'Continuar al resumen' }))
  await waitFor(() => expect(onPrepared).toHaveBeenCalledWith(expect.objectContaining({
    cardToken: 'opaque-test-token',
    cardBrand: 'visa',
    cardLastFour: card.slice(-4),
    acceptsEndUserPolicy: true,
    acceptsPersonalDataAuthorization: true,
    consentTokens: { endUserPolicy: consents.endUserPolicy.token, personalDataAuthorization: consents.personalDataAuthorization.token },
  })))
  expect(tokenizationMock).toHaveBeenCalledWith(expect.objectContaining({ number: card }), consents.publicKey, expect.any(AbortSignal))
  expect(onPrepared.mock.calls[0][0]).not.toHaveProperty('card')
  expect(document.querySelector('.card-preview__number')?.textContent).not.toContain(card.slice(8))
})

test('a tokenization failure is recoverable without entering the summary', async () => {
  globalThis.fetch = jest.fn(async () => response(consents))
  tokenizationMock.mockRejectedValueOnce(new Error('network unavailable'))
  const user = userEvent.setup()
  const onPrepared = mount()
  await screen.findByRole('link', { name: 'términos de uso' })
  await completeForm(user)
  await user.click(screen.getByRole('button', { name: 'Continuar al resumen' }))
  expect(await screen.findByText(/No pudimos proteger la tarjeta/)).toBeVisible()
  expect(onPrepared).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Continuar al resumen' }))
  await waitFor(() => expect(onPrepared).toHaveBeenCalledTimes(1))
  expect(tokenizationMock).toHaveBeenCalledTimes(2)
})

test('does not submit twice while tokenization is pending and aborts on close', async () => {
  globalThis.fetch = jest.fn(async () => response(consents))
  let complete!: (value: string) => void
  tokenizationMock.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
  const user = userEvent.setup()
  const onPrepared = mount()
  await screen.findByRole('link', { name: 'términos de uso' })
  await completeForm(user)
  const submit = screen.getByRole('button', { name: 'Continuar al resumen' })
  await user.click(submit)
  expect(submit).toBeDisabled()
  await user.click(submit)
  expect(tokenizationMock).toHaveBeenCalledTimes(1)
  const signal = tokenizationMock.mock.calls[0][2]
  await user.click(screen.getByRole('button', { name: 'Cerrar tarjeta y entrega' }))
  expect(signal.aborted).toBe(true)
  complete('opaque-test-token')
  expect(onPrepared).not.toHaveBeenCalled()
})
