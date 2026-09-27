import { useLayoutEffect, useRef, useState } from 'react'
import { getProductImages } from './productImages'

interface ProductGalleryProps {
  productId: string
  productName: string
}

function GalleryChevron({ direction }: { direction: 'previous' | 'next' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none">
      <path
        d={direction === 'previous' ? 'm15 18-6-6 6-6' : 'm9 6 6 6-6 6'}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ProductGallery({ productId, productName }: ProductGalleryProps) {
  const images = getProductImages(productId)
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const pointerStartRef = useRef<{ id: number; x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)
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

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    suppressClickRef.current = false
    if ((event.pointerType === 'mouse' && event.button !== 0) || images.length < 2) return
    pointerStartRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start || start.id !== event.pointerId) return
    const horizontalTravel = event.clientX - start.x
    const verticalTravel = event.clientY - start.y
    if (Math.abs(horizontalTravel) < 48 || Math.abs(horizontalTravel) <= Math.abs(verticalTravel)) return
    suppressClickRef.current = true
    showNextImage(horizontalTravel < 0 ? 1 : -1)
  }

  return (
    <section className="product-gallery" aria-label="Imágenes del producto">
      <div className="gallery-stage product-media">
        <button
          type="button"
          className="gallery-main-image"
          aria-label={`Abrir imagen de ${productName} en pantalla completa`}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { pointerStartRef.current = null }}
          onKeyDown={() => { suppressClickRef.current = false }}
          onClick={(event) => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false
              return
            }
            openLightbox(activeIndex, event.currentTarget)
          }}
        >
          <img
            src={activeImage.src}
            width="768"
            height="768"
            alt={activeImage.alt}
            fetchPriority="high"
            decoding="async"
            draggable={false}
          />
        </button>
        <div className="gallery-stage__controls">
          <button type="button" aria-label="Imagen anterior" onClick={() => showNextImage(-1)}>
            <GalleryChevron direction="previous" />
          </button>
          <div className="gallery-pagination" aria-hidden="true">
            {images.map((image, index) => (
              <span key={image.src} className={index === activeIndex ? 'gallery-pagination__dot gallery-pagination__dot--active' : 'gallery-pagination__dot'} />
            ))}
          </div>
          <span className="visually-hidden" aria-live={lightboxOpen ? 'off' : 'polite'}>
            Foto {activeIndex + 1} de {images.length}
          </span>
          <button type="button" aria-label="Imagen siguiente" onClick={() => showNextImage(1)}>
            <GalleryChevron direction="next" />
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
          <button ref={closeRef} type="button" aria-label="Cerrar" onClick={closeLightbox}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="gallery-lightbox__viewer">
          <button type="button" aria-label="Imagen anterior en pantalla completa" onClick={() => showNextImage(-1)}>
            <GalleryChevron direction="previous" />
          </button>
          <img src={activeImage.src} alt={activeImage.alt} width="768" height="768" decoding="async" draggable={false} />
          <button type="button" aria-label="Imagen siguiente en pantalla completa" onClick={() => showNextImage(1)}>
            <GalleryChevron direction="next" />
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
