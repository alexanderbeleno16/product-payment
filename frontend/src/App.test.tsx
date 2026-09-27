import { Provider } from 'react-redux'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { makeStore } from './app/store'
import type { Product } from './api/checkoutApi'
import {
  HEADPHONES_PRODUCT_ID,
  SPEAKER_PRODUCT_ID,
} from './features/checkout/productImages'

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
    return response(null, 404)
  })
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock,
    writable: true,
  })
  return fetchMock
}

function renderCheckout() {
  return render(
    <Provider store={makeStore()}>
      <App />
    </Provider>,
  )
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
  expect(screen.getByRole('region', { name: 'Progreso de la compra' })).toBeVisible()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Volver al producto' }))
  expect(await screen.findByRole('heading', { name: 'Audífonos inalámbricos', level: 1 })).toBeVisible()
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
  expect(await screen.findByText('1 unidad disponible')).toBeVisible()
})

test('does not quote or enable checkout for a sold-out product', async () => {
  const fetchMock = installApi([{ ...headphones, stock: 0 }])
  renderCheckout()
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
