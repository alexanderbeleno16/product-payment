import '@testing-library/jest-dom'

// Jest runs CommonJS transforms; Vite-only import.meta.env is mocked at this boundary.
jest.mock('./api/apiBaseUrl', () => ({ apiBaseUrl: '' }))

// jsdom does not implement the native dialog methods.
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open') }
