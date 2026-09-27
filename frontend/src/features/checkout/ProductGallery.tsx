import { useLayoutEffect, useRef, useState } from 'react'
import { getProductImages } from './productImages'

interface ProductGalleryProps {
  productId: string
  productName: string
}

function ProductGallery({ productId, productName }: ProductGalleryProps) {
  const images = getProductImages(productId)
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const activeImage = images[activeIndex] ?? images[0]

  useLayoutEffect(() => {
    if (!lightboxOpen) return
    const dialog = dialogRef.current
    if (!dialog) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!dialog.open) dialog.showModal()
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [lightboxOpen])

  if (!activeImage) {
    return (
      <section className="product-media gallery-fallback" aria-label="Imágenes del producto">
        <span>Imagen no disponible</span>
      </section>
    )
  }

  function showNextImage(direction: number) {
    setActiveIndex((index) => (index + direction + images.length) % images.length)
  }

  function openLightbox(index: number, opener: HTMLButtonElement) {
    openerRef.current = opener
    setActiveIndex(index)
    setLightboxOpen(true)
  }

  function closeLightbox() {
    dialogRef.current?.close()
  }

  return (
    <section className="product-gallery" aria-label="Imágenes del producto">
      <div className="gallery-stage product-media">
        <button
          type="button"
          className="gallery-main-image"
          aria-label={`Abrir imagen de ${productName} en pantalla completa`}
          onClick={(event) => openLightbox(activeIndex, event.currentTarget)}
        >
          <img
            src={activeImage.src}
            width="768"
            height="768"
            alt={activeImage.alt}
            fetchPriority="high"
            decoding="async"
          />
        </button>
        <div className="gallery-stage__controls">
          <button type="button" aria-label="Imagen anterior" onClick={() => showNextImage(-1)}>
            ‹
          </button>
          <span aria-live={lightboxOpen ? 'off' : 'polite'}>
            Foto {activeIndex + 1} de {images.length}
          </span>
          <button type="button" aria-label="Imagen siguiente" onClick={() => showNextImage(1)}>
            ›
          </button>
        </div>
      </div>

      <div className="gallery-thumbnails" aria-label="Vistas del producto">
        {images.map((image, index) => (
          <button
            type="button"
            key={image.src}
            aria-label={`Abrir foto ${index + 1} de ${productName} en pantalla completa`}
            aria-current={activeIndex === index ? 'true' : undefined}
            onClick={(event) => openLightbox(index, event.currentTarget)}
          >
            <img src={image.src} alt="" width="768" height="768" loading="eager" decoding="async" />
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="gallery-lightbox"
        aria-label={`Galería de imágenes de ${productName}`}
        onClose={() => {
          setLightboxOpen(false)
          openerRef.current?.focus()
        }}
        onCancel={(event) => {
          event.preventDefault()
          closeLightbox()
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            showNextImage(-1)
          } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            showNextImage(1)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            closeLightbox()
          }
        }}
      >
        <div className="gallery-lightbox__header">
          <span>{productName}</span>
          <button ref={closeRef} type="button" onClick={closeLightbox}>
            Cerrar
          </button>
        </div>
        <div className="gallery-lightbox__viewer">
          <button type="button" aria-label="Imagen anterior en pantalla completa" onClick={() => showNextImage(-1)}>
            ‹
          </button>
          <img src={activeImage.src} alt={activeImage.alt} width="768" height="768" decoding="async" />
          <button type="button" aria-label="Imagen siguiente en pantalla completa" onClick={() => showNextImage(1)}>
            ›
          </button>
        </div>
        <p className="gallery-lightbox__position" aria-live="polite">
          Foto {activeIndex + 1} de {images.length}
        </p>
      </dialog>
    </section>
  )
}

export default ProductGallery
