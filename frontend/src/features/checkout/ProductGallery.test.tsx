import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductGallery from './ProductGallery'
import { HEADPHONES_PRODUCT_ID, SPEAKER_PRODUCT_ID } from './productImages'

beforeAll(() => {
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
  await user.click(screen.getByRole('button', { name: 'Imagen anterior' }))
  expect(screen.getByRole('img', { name: 'Audífonos inalámbricos negros de diadema' })).toBeVisible()
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
  expect(within(dialog).getByRole('button', { name: 'Cerrar' })).toHaveFocus()
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

test('unknown product receives an honest fallback with no gallery controls', () => {
  render(<ProductGallery productId="unknown-product" productName="Otro producto" />)
  expect(screen.getByText('Imagen no disponible')).toBeVisible()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
