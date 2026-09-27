// Empty means same-origin requests; production can use the public HTTPS API origin.
export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(
  /\/+$/,
  '',
)
