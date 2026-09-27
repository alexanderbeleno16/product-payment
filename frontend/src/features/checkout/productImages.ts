export const HEADPHONES_PRODUCT_ID = '8a52ea31-08d9-4f52-a604-00e56143dce0'
export const SPEAKER_PRODUCT_ID = '3685f095-a601-4ca6-ab54-0f8eb66bccd8'

const primaryImages: Record<string, { src: string; alt: string }> = {
  [HEADPHONES_PRODUCT_ID]: {
    src: '/wireless-headphones.webp',
    alt: 'Audífonos inalámbricos negros de diadema',
  },
  [SPEAKER_PRODUCT_ID]: {
    src: '/portable-speaker.webp',
    alt: 'Parlante portátil negro',
  },
}

export function getProductImage(productId: string) {
  return primaryImages[productId] ?? null
}
