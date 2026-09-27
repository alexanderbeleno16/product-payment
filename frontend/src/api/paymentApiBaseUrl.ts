// This public origin is injected at build time; it must never contain a private key.
export const paymentApiBaseUrl = import.meta.env.VITE_PAYMENT_API_BASE_URL ?? ''
export const paymentSandboxHost = import.meta.env.VITE_PAYMENT_SANDBOX_HOST ?? ''
