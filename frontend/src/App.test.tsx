import { Provider } from 'react-redux'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { tokenizeCard } from './api/cardTokenization'
import { makeStore } from './app/store'
import { markPaymentSubmissionRejected, readPaymentRecovery, writePaymentRecovery } from './app/paymentRecovery'
import type { Product } from './api/checkoutApi'
import {
  HEADPHONES_PRODUCT_ID,
  SPEAKER_PRODUCT_ID,
} from './features/checkout/productImages'
import { paymentStorageFailed } from './features/checkout/paymentSlice'

jest.mock('./api/cardTokenization', () => ({
  TokenizationError: class extends Error { reason = 'unavailable' },
  tokenizeCard: jest.fn(),
}))

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const headphones: Product = {
  id: HEADPHONES_PRODUCT_ID,
  name: 'Audífonos inalámbricos',
  description: 'Audífonos de diadema para escuchar música en casa o durante tus desplazamientos.',
  currency: 'COP',
  priceCents: 12_990_000,
  stock: 2,
}

const speaker: Product = {
  id: SPEAKER_PRODUCT_ID,
  name: 'Parlante portátil',
  description: 'Parlante compacto que puedes llevar contigo para escuchar tus canciones favoritas.',
  currency: 'COP',
  priceCents: 7_990_000,
  stock: 8,
}

const additionalProductSeeds = [
  ['9b135df6-299a-43c1-a33f-6f3a0fc9281a', 'Mochila urbana negra', 15_990_000, 14],
  ['ee4216cd-55e7-42c1-9c25-398c385955ad', 'Billetera compacta de cuero marrón', 6_990_000, 22],
  ['aa6cc46a-7dd1-4f36-a884-8e75088851b9', 'Termo de viaje de acero oscuro', 8_490_000, 18],
  ['79e9bec3-9a34-43fe-a5d4-b11e22f20f89', 'Ratón inalámbrico gris grafito', 5_990_000, 16],
  ['19777d45-8fe4-4a48-ba25-ff41b30c5816', 'Lámpara de escritorio LED negra', 11_990_000, 11],
  ['934c2c27-f973-43a1-b6e1-3feb06800c0c', 'Teclado mecánico compacto gris oscuro', 18_990_000, 9],
  ['2f5bea3c-9169-4172-a395-6afa0448009a', 'Batería externa portátil negra', 10_990_000, 13],
  ['14746114-cb12-446c-8386-3c7bce2bd966', 'Soporte plegable para teléfono gris', 3_990_000, 24],
] as const
const additionalProducts: Product[] = additionalProductSeeds.map(([id, name, priceCents, stock]) => ({
  id,
  name,
  description: `Descripción detallada de ${name} para el uso diario.`,
  currency: 'COP',
  priceCents,
  stock,
}))

function installApi(products: Product[] = [headphones, speaker]) {
  const fetchMock = jest.fn(async (input: string) => {
    if (input === '/products') return response(products)
    if (input.startsWith('/products/')) {
      const id = input.slice('/products/'.length)
      const product = products.find((item) => item.id === id)
      return product ? response(product) : response(null, 404)
    }
    if (input.startsWith('/checkout/quote?')) {
      const query = new URL(input, 'http://localhost').searchParams
      const product = products.find((item) => item.id === query.get('productId'))
      if (!product) return response(null, 404)
      const quantity = Number(query.get('quantity'))
      return response({
        productId: product.id,
        quantity,
        currency: 'COP',
        unitPriceCents: product.priceCents,
        productAmountCents: product.priceCents * quantity,
        baseFeeCents: 200_000,
        deliveryFeeCents: 500_000,
        totalCents: product.priceCents * quantity + 700_000,
      })
    }
    if (input === '/checkout/consents') return response({
      publicKey: 'pub_test_synthetic',
      endUserPolicy: { token: 'policy-synthetic', permalink: 'https://example.test/policy' },
      personalDataAuthorization: { token: 'data-synthetic', permalink: 'https://example.test/data' },
    })
    return response(null, 404)
  })
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock,
    writable: true,
  })
  return fetchMock
}

function renderCheckout(persist = false) {
  const store = makeStore(persist)
  const mounted = render(
    <Provider store={store}>
      <App />
    </Provider>,
  )
  return { ...mounted, store }
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

async function openProduct(name: string) {
  await userEvent.setup().click(
    await screen.findByRole('button', { name: `Ver producto: ${name}` }),
  )
  return screen.findByRole('heading', { name, level: 1 })
}

test('shows a server catalog and opens one authoritative product quote', async () => {
  const fetchMock = installApi()
  renderCheckout()

  expect(screen.getByRole('status')).toHaveTextContent('Cargando productos')
  expect(await screen.findByRole('heading', { name: 'Parlante portátil' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Audífonos inalámbricos' })).toBeVisible()
  expect(screen.getAllByText('ShopiFast').length).toBeGreaterThan(0)
  expect(fetchMock).toHaveBeenCalledWith('/products', expect.objectContaining({ cache: 'no-store' }))

  expect(await openProduct('Audífonos inalámbricos')).toHaveFocus()
  expect(screen.getByRole('navigation', { name: 'Ruta de navegación' })).toHaveTextContent('Catálogo')
  expect(screen.getByText('2 unidades disponibles')).toBeVisible()
  expect(screen.getByText(headphones.description)).toBeVisible()
  expect(screen.getByRole('img', { name: 'Audífonos inalámbricos negros de diadema' })).toBeVisible()
  expect(screen.queryByText('Cálculo del producto')).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Progreso de la compra' })).not.toBeInTheDocument()

  const payButton = screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' })
  await waitFor(() => expect(payButton).toBeEnabled())
  expect(screen.getByText('Subtotal del producto (1 unidad)')).toBeVisible()
  expect(fetchMock.mock.calls.some(([path]) => path.startsWith('/checkout/quote?'))).toBe(true)

  await userEvent.setup().click(payButton)
  expect(screen.getByRole('heading', { name: 'Tarjeta y entrega' })).toHaveFocus()
  expect(screen.getByRole('dialog', { name: 'Tarjeta y entrega' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Audífonos inalámbricos', level: 1 })).toBeVisible()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Volver al producto' }))
  expect(await screen.findByRole('heading', { name: 'Audífonos inalámbricos', level: 1 })).toBeVisible()
  expect(payButton).toHaveFocus()
})

test('tokenizes in the dialog, requires a separate confirmation, and clears secrets on refresh', async () => {
  sessionStorage.clear()
  const fetchMock = installApi()
  jest.mocked(tokenizeCard).mockResolvedValue('opaque-test-token')
  const user = userEvent.setup()
  const { store, unmount } = renderCheckout(true)
  await openProduct('Audífonos inalámbricos')
  const payButton = screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' })
  await waitFor(() => expect(payButton).toBeEnabled())
  await user.click(payButton)
  await screen.findByRole('link', { name: 'términos de uso' })
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
  await user.click(screen.getByRole('button', { name: 'Continuar al resumen' }))
  expect(await screen.findByRole('heading', { name: 'Revisa tu compra' })).toHaveFocus()
  expect(screen.queryByRole('dialog', { name: 'Tarjeta y entrega' })).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('contentinfo')).toHaveTextContent('COP'))
  expect(screen.getByRole('contentinfo')).toHaveTextContent('Total estimado')
  expect(screen.getByText(/Visa terminada en/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Confirmar y pagar' })).toBeEnabled()
  expect(jest.mocked(tokenizeCard)).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls.some(([path]) => path.startsWith('/checkouts'))).toBe(false)
  const sharedState = JSON.stringify(store.getState())
  expect(sharedState).not.toContain('opaque-test-token')
  expect(sharedState).not.toContain('acceptsEndUserPolicy')
  expect(sharedState).not.toContain(syntheticVisa())
  expect(sharedState).not.toContain('123')
  expect(sessionStorage.getItem('shopifast-checkout-progress')).toBe(JSON.stringify({
    version: 2, productId: HEADPHONES_PRODUCT_ID, quantity: 1, step: 'summary',
  }))
  const safeProgress = [...Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.getItem(sessionStorage.key(index)!) ?? '')].join('\n')
  expect(safeProgress).not.toContain('opaque-test-token')
  expect(safeProgress).not.toContain(syntheticVisa())
  expect(safeProgress).not.toContain('policy-synthetic')
  expect(safeProgress).not.toContain('data-synthetic')
  unmount()
  const reloaded = makeStore(true)
  render(<Provider store={reloaded}><App /></Provider>)
  expect(await screen.findByRole('heading', { name: 'Revisa tu compra' })).toBeVisible()
  expect(reloaded.getState().checkout.step).toBe('summary')
  expect(screen.queryByRole('dialog', { name: 'Tarjeta y entrega' })).not.toBeInTheDocument()
  expect(screen.getByText('test@example.test')).toBeVisible()
  expect(await screen.findByRole('heading', { name: 'Audífonos inalámbricos', level: 2 })).toBeVisible()
  expect(screen.getByText(/Por seguridad, la tarjeta no se guarda/)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Confirmar y pagar' })).not.toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([path]) => path === '/checkouts')).toBe(false)
  await waitFor(() => expect(fetchMock.mock.calls.filter(([path]) => path.startsWith('/checkout/quote?')).length).toBeGreaterThanOrEqual(2))
  await user.click(screen.getByRole('button', { name: 'Ingresar tarjeta para continuar' }))
  expect(screen.getByRole('dialog', { name: 'Tarjeta y entrega' })).toBeVisible()
  expect(screen.getByLabelText('Correo electrónico')).toHaveValue('test@example.test')
  expect(screen.getByLabelText('Número de tarjeta')).toHaveValue('')
  await user.click(screen.getByRole('button', { name: 'Volver al resumen' }))
  expect(screen.getByRole('heading', { name: 'Revisa tu compra' })).toBeVisible()
  expect(fetchMock.mock.calls.some(([path]) => path === '/checkouts')).toBe(false)
})

test('recovers an existing payment by original key after refresh without a new POST', async () => {
  sessionStorage.clear()
  const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  expect(writePaymentRecovery({ productId: HEADPHONES_PRODUCT_ID, quantity: 1, idempotencyKey: key })).toBe(true)
  const fetchMock = installApi()
  const originalFetch = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((input: string) => input === '/checkouts/status'
    ? Promise.resolve(response({
      reference: `txn_${key}`, paymentStatus: 'APPROVED', fulfillmentStatus: 'STOCK_UNAVAILABLE',
    }))
    : originalFetch(input))
  renderCheckout(true)
  expect(await screen.findByText(/El pago fue aprobado, pero no hubo existencias/, {}, { timeout: 4000 })).toBeVisible()
  expect(screen.getByText(`txn_${key}`)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Volver al producto' })).not.toBeInTheDocument()
  expect(readPaymentRecovery()?.idempotencyKey).toBe(key)
  expect(fetchMock.mock.calls.some(([path]) => path === '/checkouts')).toBe(false)
  expect(fetchMock.mock.calls.some(([path]) => path === '/checkouts/status')).toBe(true)
  sessionStorage.clear()
})

test('retains approved stock-exception tracking on manual recheck and refresh', async () => {
  sessionStorage.clear()
  const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  expect(writePaymentRecovery({ productId: HEADPHONES_PRODUCT_ID, quantity: 1, idempotencyKey: key })).toBe(true)
  const fetchMock = installApi()
  const originalFetch = fetchMock.getMockImplementation()!
  let fulfillmentStatus = 'STOCK_UNAVAILABLE'
  fetchMock.mockImplementation((input: string) => input === '/checkouts/status'
    ? Promise.resolve(response({ reference: `txn_${key}`, paymentStatus: 'APPROVED', fulfillmentStatus }))
    : originalFetch(input))
  const first = renderCheckout(true)
  expect(await screen.findByRole('heading', { name: 'Tu pedido necesita atención' }, { timeout: 4000 })).toBeVisible()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Consultar estado' }))
  await waitFor(() => expect(fetchMock.mock.calls.filter(([path]) => path === '/checkouts/status')).toHaveLength(2))
  expect(readPaymentRecovery()?.idempotencyKey).toBe(key)
  expect(screen.queryByRole('button', { name: 'Volver al producto' })).not.toBeInTheDocument()
  first.unmount()
  renderCheckout(true)
  expect(await screen.findByRole('heading', { name: 'Tu pedido necesita atención' }, { timeout: 4000 })).toBeVisible()
  fulfillmentStatus = 'CREATED'
  await userEvent.setup().click(screen.getByRole('button', { name: 'Consultar estado' }))
  expect(await screen.findByText('Pago aprobado y entrega creada.')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Estado de tu compra' })).toHaveFocus()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Volver al producto' }))
  expect(await screen.findByRole('heading', { name: 'Audífonos inalámbricos', level: 1 })).toBeVisible()
  expect(readPaymentRecovery()).toBeNull()
  expect(fetchMock.mock.calls.some(([path]) => path === '/checkouts')).toBe(false)
  sessionStorage.clear()
}, 12_000)

test('rejected checkout is retryable after refresh only when status confirms no transaction', async () => {
  sessionStorage.clear()
  const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  expect(writePaymentRecovery({ productId: HEADPHONES_PRODUCT_ID, quantity: 1, idempotencyKey: key })).toBe(true)
  expect(markPaymentSubmissionRejected(key)).toBe(true)
  const fetchMock = installApi()
  const originalFetch = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((input: string) => input === '/checkouts/status'
    ? Promise.resolve(response(null, 404)) : originalFetch(input))
  renderCheckout(true)
  expect(await screen.findByRole('heading', { name: 'No se inició el pago' }, { timeout: 4000 })).toBeVisible()
  expect(readPaymentRecovery()).toBeNull()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Volver al producto' }))
  expect(await screen.findByRole('heading', { name: 'Audífonos inalámbricos', level: 1 })).toBeVisible()
  expect(fetchMock.mock.calls.some(([path]) => path === '/checkouts')).toBe(false)
  sessionStorage.clear()
})

test('an unreadable existing recovery blocks another purchase without clearing its record', async () => {
  sessionStorage.clear()
  sessionStorage.setItem('shopifast-payment-recovery', '{')
  installApi()
  const store = makeStore()
  store.dispatch(paymentStorageFailed())
  render(<Provider store={store}><App /></Provider>)
  expect(screen.getByRole('heading', { name: 'No se pudo continuar' })).toBeVisible()
  expect(screen.getByText(/Existe una solicitud previa que no podemos leer/)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Volver al producto' })).not.toBeInTheDocument()
  expect(sessionStorage.getItem('shopifast-payment-recovery')).toBe('{')
  expect(screen.queryByRole('button', { name: 'Confirmar y pagar' })).not.toBeInTheDocument()
  sessionStorage.clear()
})

test('keeps an approved payment open until delivery is confirmed, then reloads product stock', async () => {
  sessionStorage.clear()
  const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  expect(writePaymentRecovery({ productId: HEADPHONES_PRODUCT_ID, quantity: 1, idempotencyKey: key })).toBe(true)
  const fetchMock = installApi([{ ...headphones, stock: 1 }, speaker])
  const originalFetch = fetchMock.getMockImplementation()!
  let statusCalls = 0
  fetchMock.mockImplementation((input: string) => {
    if (input === '/checkouts/status') {
      statusCalls += 1
      return Promise.resolve(response({ reference: `txn_${key}`, paymentStatus: 'APPROVED',
        fulfillmentStatus: statusCalls === 1 ? 'NOT_STARTED' : 'CREATED' }))
    }
    return originalFetch(input)
  })
  renderCheckout(true)
  expect(await screen.findByText('Pago aprobado. La entrega aún no está confirmada.', {}, { timeout: 4000 })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Volver al producto' })).not.toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Consultar estado' }))
  expect(await screen.findByText('Pago aprobado y entrega creada.')).toBeVisible()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Volver al producto' }))
  expect(await screen.findByText('1 unidad disponible')).toBeVisible()
  expect(fetchMock.mock.calls.some(([path]) => path === '/checkouts')).toBe(false)
  sessionStorage.clear()
})

test('bounds automatic status checks without creating another payment', async () => {
  jest.useFakeTimers()
  try {
    sessionStorage.clear()
    const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    expect(writePaymentRecovery({ productId: HEADPHONES_PRODUCT_ID, quantity: 1, idempotencyKey: key })).toBe(true)
    const fetchMock = installApi()
    const originalFetch = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((input: string) => input === '/checkouts/status'
      ? Promise.resolve(response({ reference: `txn_${key}`, paymentStatus: 'PENDING', fulfillmentStatus: 'NOT_STARTED' }))
      : originalFetch(input))
    renderCheckout(true)
    await act(async () => { await Promise.resolve() })
    for (let check = 0; check < 3; check++) {
      await act(async () => { await jest.advanceTimersByTimeAsync(2500) })
    }
    expect(fetchMock.mock.calls.filter(([path]) => path === '/checkouts/status')).toHaveLength(3)
    await act(async () => { await jest.advanceTimersByTimeAsync(10_000) })
    expect(fetchMock.mock.calls.filter(([path]) => path === '/checkouts/status')).toHaveLength(3)
    expect(fetchMock.mock.calls.some(([path]) => path === '/checkouts')).toBe(false)
  } finally {
    jest.useRealTimers()
    sessionStorage.clear()
  }
})

test('shows exactly two product accordions with description open and verified details on demand', async () => {
  installApi()
  const user = userEvent.setup()
  renderCheckout()
  await openProduct('Audífonos inalámbricos')

  const description = screen.getByText('Descripción', { selector: 'summary' })
  const characteristics = screen.getByText('Características del producto', { selector: 'summary' })
  expect(document.querySelectorAll('.product-accordions details')).toHaveLength(2)
  expect(description.closest('details')).toHaveAttribute('open')
  expect(characteristics.closest('details')).not.toHaveAttribute('open')
  expect(screen.getByText(headphones.description)).toBeVisible()

  await user.click(characteristics)
  expect(characteristics.closest('details')).toHaveAttribute('open')
  expect(screen.getByText('Conexión')).toBeVisible()
  expect(screen.getByText('Inalámbrica')).toBeVisible()

  await user.click(description)
  expect(description.closest('details')).not.toHaveAttribute('open')
})

test('does not invent characteristics for a product outside the demo catalog', async () => {
  const extra: Product = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Producto personalizado',
    description: 'Descripción provista por el servidor.',
    currency: 'COP',
    priceCents: 100_000,
    stock: 1,
  }
  installApi([extra])
  renderCheckout()
  await openProduct(extra.name)
  await userEvent.setup().click(screen.getByText('Características del producto', { selector: 'summary' }))
  expect(screen.getByText('No hay características verificadas para este producto.')).toBeVisible()
})

test('shows ten server products with optimized loading priorities and opens a new product', async () => {
  const products = [headphones, speaker, ...additionalProducts]
  const fetchMock = installApi(products)
  const user = userEvent.setup()
  renderCheckout()

  expect(await screen.findByRole('heading', { name: 'Soporte plegable para teléfono gris' })).toBeVisible()
  const cards = screen.getAllByRole('article')
  expect(cards).toHaveLength(10)
  const firstStock = cards[0].querySelector('.catalog-card__stock')
  expect(firstStock?.children).toHaveLength(2)
  expect(firstStock?.children[0]).toHaveTextContent('Stock:')
  expect(firstStock?.children[1]).toHaveTextContent('2')
  expect(within(cards[0]).getByText('2')).toHaveClass('catalog-card__stock-value')
  expect(within(cards[2]).getByText('14')).toHaveClass('catalog-card__stock-value')
  expect(cards[0].querySelector('img')).toHaveAttribute('loading', 'eager')
  expect(cards[0].querySelector('img')).toHaveAttribute('fetchpriority', 'high')
  expect(cards[1].querySelector('img')).toHaveAttribute('loading', 'eager')
  expect(cards[9].querySelector('img')).toHaveAttribute('loading', 'lazy')
  expect(cards[9].querySelector('img')).toHaveAttribute('width', '768')
  expect(cards[9].querySelector('img')).toHaveAttribute('height', '768')
  expect(cards[9].querySelector('img')).toHaveAttribute('src', '/phone-stand.webp')
  expect(screen.queryByText('Ver producto')).not.toBeInTheDocument()
  expect(within(cards[2]).getByRole('button', { name: 'Ver producto: Mochila urbana negra' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Ver producto: Mochila urbana negra' }))
  expect(await screen.findByRole('heading', { name: 'Mochila urbana negra', level: 1 })).toHaveFocus()
  expect(screen.getByText(products[2].description)).toBeVisible()
  expect(screen.getByText('14 unidades disponibles')).toBeVisible()
  expect(screen.getByRole('img', { name: 'Mochila urbana negra de frente' })).toHaveAttribute('src', '/urban-backpack.webp')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' })).toBeEnabled())
  expect(screen.getAllByText('COP 159.900').length).toBeGreaterThan(0)
  expect(fetchMock.mock.calls.some(([path]) => path.includes(`productId=${products[2].id}&quantity=1`))).toBe(true)

  await user.click(screen.getByRole('button', { name: 'Catálogo' }))
  expect(await screen.findByRole('heading', { name: 'Explora nuestros productos' })).toHaveFocus()
  expect(screen.getAllByRole('article')).toHaveLength(10)
})

test('sorts a copy by both price directions and restores original server order', async () => {
  const products = [headphones, speaker, ...additionalProducts]
  installApi(products)
  const user = userEvent.setup()
  renderCheckout()

  expect(await screen.findByRole('heading', { name: 'Explora nuestros productos' })).toBeVisible()
  const firstCard = () => screen.getAllByRole('article')[0]
  expect(firstCard()).toHaveTextContent('Audífonos inalámbricos')

  const sortTrigger = screen.getByRole('button', { name: 'Ordenar' })
  expect(sortTrigger).toHaveAttribute('aria-expanded', 'false')
  await user.click(sortTrigger)
  const sortOptions = screen.getByRole('group', { name: 'Opciones de orden' })
  expect(within(sortOptions).getByRole('button', { name: 'Orden predeterminado' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(sortOptions).getByRole('button', { name: 'Precio: menor a mayor' })).toHaveAttribute('aria-pressed', 'false')
  await user.click(within(sortOptions).getByRole('button', { name: 'Precio: mayor a menor' }))
  expect(sortTrigger).toHaveAttribute('aria-expanded', 'false')
  expect(sortTrigger).toHaveFocus()
  expect(firstCard()).toHaveTextContent('Teclado mecánico compacto gris oscuro')
  expect(firstCard().querySelector('img')).toHaveAttribute('fetchpriority', 'high')
  expect(firstCard().querySelector('img')).toHaveAttribute('loading', 'eager')
  expect(screen.getAllByRole('article')[9]).toHaveTextContent('Soporte plegable para teléfono gris')

  await user.click(sortTrigger)
  const ascending = within(screen.getByRole('group', { name: 'Opciones de orden' })).getByRole('button', { name: 'Precio: menor a mayor' })
  expect(within(screen.getByRole('group', { name: 'Opciones de orden' })).getByRole('button', { name: 'Precio: mayor a menor' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(ascending)
  expect(sortTrigger).toHaveAccessibleDescription('Precio: menor a mayor')
  expect(sortTrigger).toHaveFocus()
  expect(firstCard()).toHaveTextContent('Soporte plegable para teléfono gris')
  expect(screen.getAllByRole('article')[9]).toHaveTextContent('Teclado mecánico compacto gris oscuro')
  await user.click(sortTrigger)
  expect(within(screen.getByRole('group', { name: 'Opciones de orden' })).getByRole('button', { name: 'Precio: menor a mayor' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(within(screen.getByRole('group', { name: 'Opciones de orden' })).getByRole('button', { name: 'Orden predeterminado' }))
  expect(firstCard()).toHaveTextContent('Audífonos inalámbricos')
  expect(products[0]).toBe(headphones)
})

test('closes the sort choices on Escape or outside click without losing keyboard focus', async () => {
  installApi()
  const user = userEvent.setup()
  renderCheckout()
  await screen.findByRole('heading', { name: 'Explora nuestros productos' })

  const sortTrigger = screen.getByRole('button', { name: 'Ordenar' })
  sortTrigger.focus()
  await user.keyboard('{Enter}')
  expect(sortTrigger).toHaveAttribute('aria-expanded', 'true')
  await user.keyboard('{Escape}')
  expect(sortTrigger).toHaveFocus()
  expect(screen.queryByRole('group', { name: 'Opciones de orden' })).not.toBeInTheDocument()

  await user.keyboard(' ')
  expect(sortTrigger).toHaveAttribute('aria-expanded', 'true')
  await user.click(document.body)
  expect(sortTrigger).toHaveAttribute('aria-expanded', 'false')

  sortTrigger.focus()
  await user.keyboard('{Enter}')
  await user.tab()
  expect(screen.getByRole('button', { name: 'Orden predeterminado' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Precio: mayor a menor' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Precio: menor a mayor' })).toHaveFocus()
  await user.tab()
  expect(sortTrigger).toHaveAttribute('aria-expanded', 'false')
})

test('opens a product with the full-card native button using the keyboard', async () => {
  installApi()
  const user = userEvent.setup()
  renderCheckout()

  expect(await screen.findByRole('heading', { name: 'Audífonos inalámbricos', level: 2 })).toBeVisible()
  await user.tab()
  expect(screen.getByRole('button', { name: 'ShopiFast: ir al catálogo' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Ordenar' })).toHaveFocus()
  await user.tab()
  const firstCard = screen.getAllByRole('article')[0]
  expect(within(firstCard).getByRole('button', { name: 'Ver producto: Audífonos inalámbricos' })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(await screen.findByRole('heading', { name: 'Audífonos inalámbricos', level: 1 })).toHaveFocus()
})

test('opens the catalog when the store mark or wordmark is activated from a product', async () => {
  installApi()
  const user = userEvent.setup()
  renderCheckout()
  await openProduct('Audífonos inalámbricos')

  const brand = screen.getByRole('button', { name: 'ShopiFast: ir al catálogo' })
  expect(brand).toContainElement(screen.getByText('ShopiFast'))
  await user.click(brand)
  expect(await screen.findByRole('heading', { name: 'Explora nuestros productos' })).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Ver producto: Audífonos inalámbricos' })).toBeVisible()
})

test('returns through the breadcrumb and selects a new product with reset quantity', async () => {
  const fetchMock = installApi()
  const user = userEvent.setup()
  renderCheckout()
  await openProduct('Audífonos inalámbricos')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Aumentar cantidad' }))
  expect(screen.getByRole('status', { name: 'Cantidad seleccionada' })).toHaveTextContent('2')

  await user.click(screen.getByRole('button', { name: 'Catálogo' }))
  expect(await screen.findByRole('heading', { name: 'Explora nuestros productos' })).toHaveFocus()
  await openProduct('Parlante portátil')
  expect(screen.getByRole('status', { name: 'Cantidad seleccionada' })).toHaveTextContent('1')
  expect(screen.getByText(speaker.description)).toBeVisible()
  expect(screen.getByRole('img', { name: 'Parlante portátil negro' })).toHaveAttribute('src', '/portable-speaker.webp')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' })).toBeEnabled())
  expect(screen.getAllByText('COP 79.900').length).toBeGreaterThan(0)
  expect(fetchMock.mock.calls.some(([path]) => path.includes(`productId=${SPEAKER_PRODUCT_ID}&quantity=1`))).toBe(true)
})

test('re-quotes quantity and never allows more units than current stock', async () => {
  installApi()
  const user = userEvent.setup()
  renderCheckout()
  await openProduct('Audífonos inalámbricos')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Aumentar cantidad' }))
  expect(screen.getByRole('button', { name: 'Aumentar cantidad' })).toBeDisabled()
  await waitFor(() => expect(screen.getByText('COP 259.800')).toBeVisible())
  await user.click(screen.getByRole('button', { name: 'Disminuir cantidad' }))
  expect(screen.getByRole('status', { name: 'Cantidad seleccionada' })).toHaveTextContent('1')
})

test('shows an empty catalog without requesting a quote', async () => {
  const fetchMock = installApi([])
  renderCheckout()
  expect(await screen.findByText('No hay productos disponibles en este momento.')).toBeVisible()
  expect(fetchMock.mock.calls.every(([path]) => path === '/products')).toBe(true)
})

test('offers catalog retry after retrieval fails', async () => {
  const fetchMock = installApi()
  fetchMock.mockResolvedValueOnce(response(null, 503))
  renderCheckout()
  expect(await screen.findByText('No pudimos cargar los productos. Vuelve a intentarlo.')).toBeVisible()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Volver a intentar' }))
  expect(await screen.findByRole('button', { name: 'Ver producto: Parlante portátil' })).toBeVisible()
})

test('keeps loaded cards visible during refresh and after a refresh error', async () => {
  const fetchMock = installApi()
  const user = userEvent.setup()
  renderCheckout()
  await openProduct('Audífonos inalámbricos')

  let resolveRefresh!: (response: Response) => void
  const refreshResponse = new Promise<Response>((resolve) => {
    resolveRefresh = resolve
  })
  const originalFetch = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((input: string) =>
    input === '/products' ? refreshResponse : originalFetch(input),
  )

  await user.click(screen.getByRole('button', { name: 'Catálogo' }))
  expect(screen.getByRole('status')).toHaveTextContent('Actualizando productos')
  expect(screen.getByRole('button', { name: 'Ver producto: Parlante portátil' })).toBeVisible()

  resolveRefresh(response(null, 503))
  expect(await screen.findByText(/Los datos visibles pueden haber cambiado/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Ver producto: Parlante portátil' })).toBeVisible()

  fetchMock.mockImplementation((input: string) =>
    input === '/products'
      ? Promise.resolve(response([{ ...headphones, stock: 1 }, speaker]))
      : originalFetch(input),
  )
  await user.click(screen.getByRole('button', { name: 'Volver a intentar' }))
  await waitFor(() => expect(within(screen.getAllByRole('article')[0]).getByText('1')).toBeVisible())
})

test('does not quote or enable checkout for a sold-out product', async () => {
  const fetchMock = installApi([{ ...headphones, stock: 0 }])
  renderCheckout()
  const catalogCard = (await screen.findByRole('button', { name: 'Ver producto: Audífonos inalámbricos' })).closest('article')
  expect(catalogCard).not.toBeNull()
  expect(within(catalogCard!).getByText('Stock:')).toBeVisible()
  expect(within(catalogCard!).getByText('0 · Agotado')).toHaveClass('catalog-card__stock-value--empty')
  await openProduct('Audífonos inalámbricos')
  expect(screen.getByText('Agotado')).toBeVisible()
  expect(screen.getByText('Producto agotado. No puedes continuar con la compra.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' })).toBeDisabled()
  expect(fetchMock.mock.calls.every(([path]) => path.startsWith('/products'))).toBe(true)
})

test('offers product retry after retrieval fails', async () => {
  const fetchMock = installApi()
  fetchMock.mockImplementationOnce(async () => response([headphones]))
  fetchMock.mockImplementationOnce(async () => response(null, 503))
  renderCheckout()
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Ver producto: Audífonos inalámbricos' }))
  expect(await screen.findByRole('heading', { name: 'Producto no disponible' })).toBeVisible()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Volver a intentar' }))
  expect(await screen.findByRole('heading', { name: 'Audífonos inalámbricos', level: 1 })).toBeVisible()
})

test('blocks progression when the server rejects the selected quantity', async () => {
  const fetchMock = jest.fn(async (input: string) => {
    if (input === '/products') return response([headphones])
    if (input.startsWith('/products/')) return response(headphones)
    return response(null, 409)
  })
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock,
    writable: true,
  })
  renderCheckout()
  await openProduct('Audífonos inalámbricos')
  expect(await screen.findByText('Esta cantidad ya no está disponible. Actualiza el producto para continuar.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Actualizar disponibilidad' })).toBeVisible()
})
