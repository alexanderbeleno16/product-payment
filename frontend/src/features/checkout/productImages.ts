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
}

export function getProductImage(productId: string) {
  return getProductImages(productId)[0] ?? null
}

export function getProductImages(productId: string): readonly ProductImage[] {
  return productImages[productId] ?? []
}
