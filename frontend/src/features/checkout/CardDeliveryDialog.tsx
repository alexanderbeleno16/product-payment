import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { getConsentTerms } from '../../api/checkoutApi'
import { tokenizeCard, TokenizationError } from '../../api/cardTokenization'
import type { ConsentTerms } from '../../api/checkoutApi'
import { useAppDispatch } from '../../app/hooks'
import { productReturnRequested } from './checkoutSlice'
import {
  cardBrand, emptyCardForm, maskedCardPreview, validateCardForm,
} from './cardForm'
import type { CardFormErrors, CardFormField, CardFormValues, TokenizedCardDelivery } from './cardForm'
import './CardDeliveryDialog.css'

interface Props { onPrepared: (values: TokenizedCardDelivery) => void }

function CardDeliveryDialog({ onPrepared }: Props) {
  const dispatch = useAppDispatch()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const tokenControllerRef = useRef<AbortController | null>(null)
  const submittingRef = useRef(false)
  const [values, setValues] = useState<CardFormValues>(emptyCardForm)
  const [errors, setErrors] = useState<CardFormErrors>({})
  const [terms, setTerms] = useState<ConsentTerms | null>(null)
  const [termsStatus, setTermsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [reverse, setReverse] = useState(false)
  const [termsAttempt, setTermsAttempt] = useState(0)
  const brand = cardBrand(values.number)

  useEffect(() => {
    const dialog = dialogRef.current
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    headingRef.current?.focus()
    return () => {
      tokenControllerRef.current?.abort()
      dialog?.close()
      openerRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void getConsentTerms(controller.signal).then((current) => {
      if (!controller.signal.aborted) {
        setTerms(current)
        setTermsStatus('ready')
      }
    }).catch(() => {
      if (!controller.signal.aborted) setTermsStatus('error')
    })
    return () => controller.abort()
  }, [termsAttempt])

  function retryTerms() {
    setTermsStatus('loading')
    setTerms(null)
    setMessage('')
    setTermsAttempt((attempt) => attempt + 1)
  }

  function close() {
    tokenControllerRef.current?.abort()
    dispatch(productReturnRequested())
  }

  function changeText(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.currentTarget
    const field = name as CardFormField
    let next = value
    if (field === 'number') next = value.replace(/\D/g, '').slice(0, 16)
    if (field === 'expMonth' || field === 'expYear') next = value.replace(/\D/g, '').slice(0, 2)
    if (field === 'cvc') next = value.replace(/\D/g, '').slice(0, 3)
    setValues((previous) => ({ ...previous, [field]: next }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  function changeCheck(event: ChangeEvent<HTMLInputElement>) {
    const field = event.currentTarget.name as 'policyAccepted' | 'dataAccepted'
    const checked = event.currentTarget.checked
    setValues((previous) => ({ ...previous, [field]: checked }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return
    const nextErrors = validateCardForm(values)
    if (!terms || termsStatus !== 'ready') {
      setMessage('Necesitamos los documentos vigentes para continuar.')
      return
    }
    setErrors(nextErrors)
    const firstError = Object.keys(nextErrors)[0]
    if (firstError) {
      dialogRef.current?.querySelector<HTMLInputElement>(`[name="${firstError}"]`)?.focus()
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setMessage('Protegiendo la tarjeta…')
    const controller = new AbortController()
    tokenControllerRef.current = controller
    try {
      const cardToken = await tokenizeCard({
        number: values.number, cardHolder: values.cardHolder.trim(),
        expMonth: values.expMonth, expYear: values.expYear, cvc: values.cvc,
      }, terms.publicKey, controller.signal)
      if (controller.signal.aborted) return
      if (brand === 'unknown') return
      onPrepared({
        cardToken,
        cardBrand: brand,
        cardLastFour: values.number.slice(-4),
        acceptsEndUserPolicy: true,
        acceptsPersonalDataAuthorization: true,
        customerEmail: values.customerEmail.trim().toLowerCase(),
        delivery: { recipientName: values.recipientName.trim(), addressLine: values.addressLine.trim(), city: values.city.trim() },
        consentTokens: { endUserPolicy: terms.endUserPolicy.token,
          personalDataAuthorization: terms.personalDataAuthorization.token },
      })
    } catch (error) {
      if (controller.signal.aborted) return
      setMessage(error instanceof TokenizationError && error.reason === 'configuration'
        ? 'La tokenización no está configurada. Contacta a soporte.'
        : 'No pudimos proteger la tarjeta. Verifica la conexión e inténtalo de nuevo.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
      tokenControllerRef.current = null
    }
  }

  const input = (name: Exclude<CardFormField, 'policyAccepted' | 'dataAccepted'>,
    label: string, options: { autoComplete?: string; inputMode?: 'numeric' | 'email' | 'text'; maxLength?: number; type?: string } = {}) => (
    <div className="card-field">
      <label htmlFor={`card-${name}`}>{label}</label>
      <input id={`card-${name}`} name={name} value={values[name]} onChange={changeText}
        autoComplete={options.autoComplete ?? 'off'} inputMode={options.inputMode}
        maxLength={options.maxLength} type={options.type ?? 'text'}
        onFocus={name === 'cvc' ? () => setReverse(true) : undefined}
        onBlur={name === 'cvc' ? () => setReverse(false) : undefined}
        aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `card-${name}-error` : undefined} />
      {errors[name] && <p className="card-field__error" id={`card-${name}-error`}>{errors[name]}</p>}
    </div>
  )

  return <dialog ref={dialogRef} className="card-dialog" aria-labelledby="card-dialog-title"
    onCancel={(event) => { event.preventDefault(); close() }}>
    <div className="card-dialog__header">
      <div><p className="eyebrow">Paso 2 de 5</p><h2 ref={headingRef} tabIndex={-1} id="card-dialog-title">Tarjeta y entrega</h2></div>
      <button type="button" className="card-dialog__close" aria-label="Cerrar tarjeta y entrega" onClick={close}>×</button>
    </div>
    <form noValidate onSubmit={(event) => void submit(event)}>
      <div className="card-dialog__columns">
        <div className="card-dialog__fields">
          <fieldset><legend>Datos de la tarjeta</legend>
            {input('number', 'Número de tarjeta', { autoComplete: 'cc-number', inputMode: 'numeric', maxLength: 16 })}
            <p className="card-brand" aria-live="polite">{brand === 'visa' ? 'Visa' : brand === 'mastercard' ? 'Mastercard' : 'Visa o Mastercard'}</p>
            {input('cardHolder', 'Nombre en la tarjeta', { autoComplete: 'cc-name', maxLength: 120 })}
            <div className="card-dialog__inline">
              {input('expMonth', 'Mes de vencimiento (MM)', { autoComplete: 'cc-exp-month', inputMode: 'numeric', maxLength: 2 })}
              {input('expYear', 'Año de vencimiento (AA)', { autoComplete: 'cc-exp-year', inputMode: 'numeric', maxLength: 2 })}
              {input('cvc', 'Código de seguridad', { autoComplete: 'cc-csc', inputMode: 'numeric', maxLength: 3, type: 'password' })}
            </div>
          </fieldset>
          <fieldset><legend>Contacto y entrega</legend>
            {input('customerEmail', 'Correo electrónico', { autoComplete: 'email', inputMode: 'email', maxLength: 254, type: 'email' })}
            {input('recipientName', 'Nombre de quien recibe', { autoComplete: 'name', maxLength: 120 })}
            {input('addressLine', 'Dirección de entrega', { autoComplete: 'street-address', maxLength: 240 })}
            {input('city', 'Ciudad', { autoComplete: 'address-level2', maxLength: 120 })}
          </fieldset>
        </div>
        <div className="card-preview-wrap" aria-hidden="true">
          <div className={`card-preview${reverse ? ' card-preview--reverse' : ''}`}>
            <div className="card-preview__front"><span className={`card-preview__brand card-preview__brand--${brand}`}>
              {brand === 'mastercard' ? <><i /><i /></> : brand === 'visa' ? 'VISA' : 'Tarjeta'}
            </span>
              <span className="card-preview__number">{maskedCardPreview(values.number)}</span>
              <span className="card-preview__details">{values.cardHolder ? values.cardHolder.slice(0, 24) : 'NOMBRE EN LA TARJETA'} · {values.expMonth || 'MM'}/{values.expYear || 'AA'}</span>
            </div>
            <div className="card-preview__back"><span className="card-preview__stripe" /><span className="card-preview__code">•••</span></div>
          </div>
        </div>
      </div>
      <fieldset className="card-consents"><legend>Autorizaciones</legend>
        {termsStatus === 'loading' && <p role="status">Cargando documentos vigentes…</p>}
        {termsStatus === 'error' && <div role="alert"><p>No pudimos cargar los documentos vigentes.</p><button type="button" className="secondary-button" onClick={retryTerms}>Reintentar</button></div>}
        {terms && <>
          <label><input name="policyAccepted" type="checkbox" checked={values.policyAccepted} onChange={changeCheck}
            aria-invalid={Boolean(errors.policyAccepted)} aria-describedby={errors.policyAccepted ? 'card-policy-error' : undefined} /> Acepto los <a href={terms.endUserPolicy.permalink} target="_blank" rel="noopener noreferrer">términos de uso</a>.</label>
          {errors.policyAccepted && <p className="card-field__error" id="card-policy-error">{errors.policyAccepted}</p>}
          <label><input name="dataAccepted" type="checkbox" checked={values.dataAccepted} onChange={changeCheck}
            aria-invalid={Boolean(errors.dataAccepted)} aria-describedby={errors.dataAccepted ? 'card-data-error' : undefined} /> Autorizo el <a href={terms.personalDataAuthorization.permalink} target="_blank" rel="noopener noreferrer">tratamiento de datos personales</a>.</label>
          {errors.dataAccepted && <p className="card-field__error" id="card-data-error">{errors.dataAccepted}</p>}
        </>}
      </fieldset>
      {message && <p className="card-dialog__message" role="status">{message}</p>}
      <div className="card-dialog__actions"><button type="button" className="secondary-button" onClick={close}>Volver al producto</button>
        <button type="submit" className="primary-button" disabled={termsStatus !== 'ready' || submitting}>Continuar al resumen</button></div>
    </form>
  </dialog>
}

export default CardDeliveryDialog
