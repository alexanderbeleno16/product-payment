import '@testing-library/jest-dom'

// Jest runs CommonJS transforms; Vite-only import.meta.env is mocked at this boundary.
jest.mock('./api/apiBaseUrl', () => ({ apiBaseUrl: '' }))
