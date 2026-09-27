import { createDataSource } from './data-source';

async function migrate(): Promise<void> {
  const dataSource = createDataSource();
  try {
    await dataSource.initialize();
    await dataSource.runMigrations();
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void migrate().catch((error: unknown) => {
  console.error('Database migration failed', { code: getErrorCode(error) });
  process.exitCode = 1;
});

function getErrorCode(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return 'UNKNOWN';
}
