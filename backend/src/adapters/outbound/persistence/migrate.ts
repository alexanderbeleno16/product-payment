import { createDataSource } from './data-source';

export async function migrate(dataSource = createDataSource()): Promise<void> {
  try {
    await dataSource.initialize();
    await dataSource.runMigrations();
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

if (require.main === module) {
  void migrate().catch((error: unknown) => {
    console.error('Database migration failed', { code: getErrorCode(error) });
    process.exitCode = 1;
  });
}

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
