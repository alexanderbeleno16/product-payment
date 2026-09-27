import type { DataSource } from 'typeorm';
import { DatabaseConnection } from './database-connection';
import { createDataSource } from './data-source';

jest.mock('./data-source', () => ({ createDataSource: jest.fn() }));

describe('DatabaseConnection', () => {
  it('initializes once, shares the connection, and destroys it once on shutdown', async () => {
    const dataSource = {
      initialize: jest.fn(),
      isInitialized: true,
      destroy: jest.fn().mockResolvedValue(undefined),
    } as unknown as DataSource;
    (dataSource.initialize as jest.Mock).mockResolvedValue(dataSource);
    (createDataSource as jest.Mock).mockReturnValue(dataSource);
    const connection = new DatabaseConnection();
    const [left, right] = await Promise.all([
      connection.get(),
      connection.get(),
    ]);
    expect(left).toBe(dataSource);
    expect(right).toBe(dataSource);
    expect((dataSource.initialize as jest.Mock).mock.calls).toHaveLength(1);
    await connection.onApplicationShutdown();
    expect((dataSource.destroy as jest.Mock).mock.calls).toHaveLength(1);
  });
});
