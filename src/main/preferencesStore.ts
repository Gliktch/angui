import { promises as fs } from 'node:fs';
import path from 'node:path';

export class JsonStore<T extends Record<string, any>> {
  private data: T;

  constructor(private readonly filePath: string, private readonly defaults: T) {
    this.data = { ...defaults };
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<T>;
      this.data = { ...this.defaults, ...parsed } as T;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code !== 'ENOENT') {
        console.warn('[AnGUI] Failed to read preferences store.', error);
      }
      await this.persist();
    }
  }

  getAll(): T {
    return { ...this.data };
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key];
  }

  async set<K extends keyof T>(key: K, value: T[K]): Promise<void> {
    this.data = { ...this.data, [key]: value };
    await this.persist();
  }

  async update(update: Partial<T>): Promise<void> {
    this.data = { ...this.data, ...update } as T;
    await this.persist();
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }
}

