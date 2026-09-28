module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.[jt]sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: { react: { runtime: 'automatic' } },
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],
  moduleNameMapper: {
    '\\.(css|png|svg|webp)$': '<rootDir>/test/assetMock.cjs',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/setupTests.ts',
  ],
  coverageThreshold: {
    global: { statements: 80.01, branches: 80.01, functions: 80.01, lines: 80.01 },
  },
}
