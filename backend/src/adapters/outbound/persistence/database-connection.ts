import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { createDataSource } from './data-source';

/** One lazily initialized connection shared by all persistence adapters. */
@Injectable()
export class DatabaseConnection implements OnApplicationShutdown {
  private initialization: Promise<DataSource> | null = null;

  get(): Promise<DataSource> {
    if (!this.initialization) {
      const dataSource = createDataSource();
      this.initialization = dataSource.initialize().catch((error: unknown) => {
        this.initialization = null;
        throw error;
      });
    }
    return this.initialization;
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.initialization) return;
    const dataSource = await this.initialization;
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}
