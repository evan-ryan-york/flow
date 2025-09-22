// Global type declarations for Expo Router and webpack require.context

declare global {
  interface NodeRequire {
    context(
      path: string,
      deep?: boolean,
      filter?: RegExp
    ): {
      keys(): string[];
      (id: string): any;
      <T>(id: string): T;
      resolve(id: string): string;
    };
  }
}

export {};