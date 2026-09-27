export const HEADPHONES_PRODUCT_ID = '8a52ea31-08d9-4f52-a604-00e56143dce0'
export const SPEAKER_PRODUCT_ID = '3685f095-a601-4ca6-ab54-0f8eb66bccd8'

export interface ProductImage {
  src: string
  alt: string
}

const productImages: Record<string, readonly ProductImage[]> = {
  [HEADPHONES_PRODUCT_ID]: [
    {
      src: '/wireless-headphones.webp',
      alt: 'Audífonos inalámbricos negros de diadema',
    },
    {
      src: '/wireless-headphones-side.webp',
      alt: 'Vista lateral de los audífonos inalámbricos',
    },
  ],
  [SPEAKER_PRODUCT_ID]: [
    {
      src: '/portable-speaker.webp',
      alt: 'Parlante portátil negro',
    },
    {
      src: '/portable-speaker-side.webp',
      alt: 'Vista lateral del parlante portátil',
    },
  ],
  '9b135df6-299a-43c1-a33f-6f3a0fc9281a': [
    { src: '/urban-backpack.webp', alt: 'Mochila urbana negra de frente' },
    { src: '/urban-backpack-side.webp', alt: 'Vista lateral de la mochila urbana negra' },
  ],
  'ee4216cd-55e7-42c1-9c25-398c385955ad': [
    { src: '/compact-wallet.webp', alt: 'Billetera compacta de frente' },
    { src: '/compact-wallet-open.webp', alt: 'Billetera compacta abierta' },
  ],
  'aa6cc46a-7dd1-4f36-a884-8e75088851b9': [
    { src: '/travel-tumbler.webp', alt: 'Termo de viaje oscuro de frente' },
    { src: '/travel-tumbler-side.webp', alt: 'Vista lateral del termo de viaje oscuro' },
  ],
  '79e9bec3-9a34-43fe-a5d4-b11e22f20f89': [
    { src: '/wireless-mouse.webp', alt: 'Ratón inalámbrico de frente' },
    { src: '/wireless-mouse-side.webp', alt: 'Vista lateral del ratón inalámbrico' },
  ],
  '19777d45-8fe4-4a48-ba25-ff41b30c5816': [
    { src: '/desk-lamp.webp', alt: 'Lámpara de escritorio de frente' },
    { src: '/desk-lamp-side.webp', alt: 'Vista lateral de la lámpara de escritorio' },
  ],
  '934c2c27-f973-43a1-b6e1-3feb06800c0c': [
    { src: '/compact-keyboard.webp', alt: 'Teclado compacto de frente' },
    { src: '/compact-keyboard-side.webp', alt: 'Vista lateral del teclado compacto' },
  ],
  '2f5bea3c-9169-4172-a395-6afa0448009a': [
    { src: '/power-bank.webp', alt: 'Batería portátil de frente' },
    { src: '/power-bank-side.webp', alt: 'Vista lateral de la batería portátil' },
  ],
  '14746114-cb12-446c-8386-3c7bce2bd966': [
    { src: '/phone-stand.webp', alt: 'Soporte plegable para teléfono de frente' },
    { src: '/phone-stand-side.webp', alt: 'Vista lateral del soporte plegable para teléfono' },
  ],
}

export function getProductImage(productId: string) {
  return getProductImages(productId)[0] ?? null
}

export function getProductImages(productId: string): readonly ProductImage[] {
  return productImages[productId] ?? []
}
