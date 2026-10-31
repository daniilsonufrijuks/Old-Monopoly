declare module 'sql.js' {
  interface Statement {
    bind(values?: unknown[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, string | number | Uint8Array | null>;
    free(): boolean;
  }

  interface Database {
    run(sql: string, params?: unknown[]): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
  export default initSqlJs;
  export type { Database };
}
