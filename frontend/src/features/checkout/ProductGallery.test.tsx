import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductGallery from './ProductGallery'
import { HEADPHONES_PRODUCT_ID, SPEAKER_PRODUCT_ID } from './productImages'

beforeAll(() => {
  Object.defineProperty(window, 'PointerEvent', {
    configurable: true,
    value: class PointerEventPolyfill extends MouseEvent {
      pointerId: number
      pointerType: string

      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 0
        this.pointerType = init.pointerType ?? ''
      }
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function close(this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    },
  })
})

test('slides between both cached headphone views without changing checkout state', async () => {
  const user = userEvent.setup()
  render(<ProductGallery productId={HEADPHONES_PRODUCT_ID} productName="Audífonos inalámbricos" />)

  const mainImage = screen.getByRole('img', { name: 'Audífonos inalámbricos negros de diadema' })
  expect(mainImage).toHaveAttribute('src', '/wireless-headphones.webp')
  const pagination = document.querySelector('.gallery-pagination')
  expect(pagination?.querySelectorAll('.gallery-pagination__dot')).toHaveLength(2)
  expect(pagination?.querySelectorAll('.gallery-pagination__dot--active')).toHaveLength(1)
  expect(pagination?.parentElement?.querySelector('.visually-hidden')).toHaveTextContent('Foto 1 de 2')
  const alternateThumbnail = screen.getByRole('button', {
    name: 'Abrir foto 2 de Audífonos inalámbricos en pantalla completa',
  })
  expect(alternateThumbnail.querySelector('img')).toHaveAttribute('loading', 'eager')
  expect(alternateThumbnail.querySelector('img')).toHaveAttribute('src', '/wireless-headphones-side.webp')

  await user.click(screen.getByRole('button', { name: 'Imagen siguiente' }))
  expect(screen.getByRole('img', { name: 'Vista lateral de los audífonos inalámbricos' })).toHaveAttribute(
    'src',
    '/wireless-headphones-side.webp',
  )
  expect(pagination?.querySelectorAll('.gallery-pagination__dot--active')).toHaveLength(1)
  expect(pagination?.parentElement?.querySelector('.visually-hidden')).toHaveTextContent('Foto 2 de 2')
  await user.click(screen.getByRole('button', { name: 'Imagen anterior' }))
  expect(screen.getByRole('img', { name: 'Audífonos inalámbricos negros de diadema' })).toBeVisible()
})

test.each(['touch', 'mouse'])('%s horizontal swipe changes the image without opening fullscreen', (pointerType) => {
  render(<ProductGallery productId={HEADPHONES_PRODUCT_ID} productName="Audífonos inalámbricos" />)
  const main = screen.getByRole('button', {
    name: 'Abrir imagen de Audífonos inalámbricos en pantalla completa',
  })

  fireEvent.pointerDown(main, { pointerId: 1, pointerType, button: 0, clientX: 200, clientY: 120 })
  fireEvent.pointerUp(main, { pointerId: 1, pointerType, button: 0, clientX: 100, clientY: 126 })
  fireEvent.click(main)
  expect(main.querySelector('img')).toHaveAttribute('src', '/wireless-headphones-side.webp')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  fireEvent.pointerDown(main, { pointerId: 2, pointerType, button: 0, clientX: 100, clientY: 120 })
  fireEvent.pointerUp(main, { pointerId: 2, pointerType, button: 0, clientX: 195, clientY: 125 })
  fireEvent.click(main)
  expect(main.querySelector('img')).toHaveAttribute('src', '/wireless-headphones.webp')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  fireEvent.click(main)
  expect(screen.getByRole('dialog', { name: 'Galería de imágenes de Audífonos inalámbricos' })).toBeVisible()
})

test('vertical touch travel does not change the gallery image', () => {
  render(<ProductGallery productId={HEADPHONES_PRODUCT_ID} productName="Audífonos inalámbricos" />)
  const main = screen.getByRole('button', {
    name: 'Abrir imagen de Audífonos inalámbricos en pantalla completa',
  })
  fireEvent.pointerDown(main, { pointerId: 1, pointerType: 'touch', clientX: 120, clientY: 100 })
  fireEvent.pointerUp(main, { pointerId: 1, pointerType: 'touch', clientX: 145, clientY: 210 })
  expect(main.querySelector('img')).toHaveAttribute('src', '/wireless-headphones.webp')
})

test('opens main image fullscreen, supports arrow keys and Escape, and restores focus', async () => {
  const user = userEvent.setup()
  render(<ProductGallery productId={HEADPHONES_PRODUCT_ID} productName="Audífonos inalámbricos" />)
  const opener = screen.getByRole('button', {
    name: 'Abrir imagen de Audífonos inalámbricos en pantalla completa',
  })

  await user.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Galería de imágenes de Audífonos inalámbricos' })
  expect(dialog).toBeVisible()
  const closeButton = within(dialog).getByRole('button', { name: 'Cerrar' })
  expect(closeButton).toHaveFocus()
  expect(closeButton).not.toHaveTextContent('Cerrar')
  expect(closeButton.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  expect(document.body.style.overflow).toBe('hidden')
  expect(within(dialog).getByRole('img', { name: 'Audífonos inalámbricos negros de diadema' })).toBeVisible()

  await user.keyboard('{ArrowRight}')
  expect(within(dialog).getByRole('img', { name: 'Vista lateral de los audífonos inalámbricos' })).toBeVisible()
  await user.keyboard('{ArrowLeft}')
  expect(within(dialog).getByRole('img', { name: 'Audífonos inalámbricos negros de diadema' })).toBeVisible()
  await user.keyboard('{Escape}')

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
  expect(document.body.style.overflow).toBe('')
})

test('opens the chosen speaker thumbnail directly and restores focus on close', async () => {
  const user = userEvent.setup()
  render(<ProductGallery productId={SPEAKER_PRODUCT_ID} productName="Parlante portátil" />)
  const thumbnail = screen.getByRole('button', {
    name: 'Abrir foto 2 de Parlante portátil en pantalla completa',
  })
  await user.click(thumbnail)
  const dialog = screen.getByRole('dialog', { name: 'Galería de imágenes de Parlante portátil' })
  expect(within(dialog).getByRole('img', { name: 'Vista lateral del parlante portátil' })).toHaveAttribute(
    'src',
    '/portable-speaker-side.webp',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Imagen anterior en pantalla completa' }))
  expect(within(dialog).getByRole('img', { name: 'Parlante portátil negro' })).toBeVisible()
  await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
  expect(thumbnail).toHaveFocus()
})

test('keeps full-screen images non-draggable while repeatedly navigating with focused controls', async () => {
  const user = userEvent.setup()
  render(<ProductGallery productId={HEADPHONES_PRODUCT_ID} productName="Audífonos inalámbricos" />)
  await user.click(screen.getByRole('button', {
    name: 'Abrir imagen de Audífonos inalámbricos en pantalla completa',
  }))

  const dialog = screen.getByRole('dialog', { name: 'Galería de imágenes de Audífonos inalámbricos' })
  const next = within(dialog).getByRole('button', { name: 'Imagen siguiente en pantalla completa' })
  const previous = within(dialog).getByRole('button', { name: 'Imagen anterior en pantalla completa' })

  for (const button of [next, next, previous, previous]) {
    await user.click(button)
    expect(button).toHaveFocus()
    expect(within(dialog).getByRole('img')).toHaveAttribute('draggable', 'false')
  }
})

test.each([
  ['Mochila urbana negra', '9b135df6-299a-43c1-a33f-6f3a0fc9281a', '/urban-backpack.webp', '/urban-backpack-side.webp'],
  ['Billetera compacta', 'ee4216cd-55e7-42c1-9c25-398c385955ad', '/compact-wallet.webp', '/compact-wallet-open.webp'],
  ['Termo de viaje', 'aa6cc46a-7dd1-4f36-a884-8e75088851b9', '/travel-tumbler.webp', '/travel-tumbler-side.webp'],
  ['Ratón inalámbrico', '79e9bec3-9a34-43fe-a5d4-b11e22f20f89', '/wireless-mouse.webp', '/wireless-mouse-side.webp'],
  ['Lámpara de escritorio', '19777d45-8fe4-4a48-ba25-ff41b30c5816', '/desk-lamp.webp', '/desk-lamp-side.webp'],
  ['Teclado compacto', '934c2c27-f973-43a1-b6e1-3feb06800c0c', '/compact-keyboard.webp', '/compact-keyboard-side.webp'],
  ['Batería externa', '2f5bea3c-9169-4172-a395-6afa0448009a', '/power-bank.webp', '/power-bank-side.webp'],
  ['Soporte para teléfono', '14746114-cb12-446c-8386-3c7bce2bd966', '/phone-stand.webp', '/phone-stand-side.webp'],
])('%s offers two distinct gallery images', async (productName, productId, first, second) => {
  const user = userEvent.setup()
  render(<ProductGallery productId={productId} productName={productName} />)
  const main = screen.getByRole('button', { name: `Abrir imagen de ${productName} en pantalla completa` })
  expect(main.querySelector('img')).toHaveAttribute('src', first)
  expect(screen.getByRole('button', { name: `Abrir foto 2 de ${productName} en pantalla completa` }).querySelector('img')).toHaveAttribute('src', second)
  await user.click(screen.getByRole('button', { name: 'Imagen siguiente' }))
  expect(main.querySelector('img')).toHaveAttribute('src', second)
})

test('opens an added product view fullscreen without fetching a different image', async () => {
  const user = userEvent.setup()
  render(<ProductGallery productId="2f5bea3c-9169-4172-a395-6afa0448009a" productName="Batería externa" />)
  const thumbnail = screen.getByRole('button', { name: 'Abrir foto 2 de Batería externa en pantalla completa' })
  await user.click(thumbnail)
  const dialog = screen.getByRole('dialog', { name: 'Galería de imágenes de Batería externa' })
  expect(within(dialog).getByRole('img', { name: 'Vista lateral de la batería portátil' })).toHaveAttribute('src', '/power-bank-side.webp')
  await user.keyboard('{Escape}')
  expect(thumbnail).toHaveFocus()
})

test('unknown product receives an honest fallback with no gallery controls', () => {
  render(<ProductGallery productId="unknown-product" productName="Otro producto" />)
  expect(screen.getByText('Imagen no disponible')).toBeVisible()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
