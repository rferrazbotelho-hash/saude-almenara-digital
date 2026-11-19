declare module "node:sqlite" {
  export interface StatementSync {
    run(...params: Array<string | number | bigint | Uint8Array | null>): {
      changes: number | bigint;
      lastInsertRowid: number | bigint;
    };
    get(...params: Array<string | number | bigint | Uint8Array | null>): unknown;
    all(...params: Array<string | number | bigint | Uint8Array | null>): unknown[];
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
