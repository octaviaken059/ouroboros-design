// 声明文件，用于解决缺少类型定义的模块

declare module 'winston' {
  export interface Logger {
    log(level: string, message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    add(transport: any): void;
    remove(transport: any): void;
    configure(config: any): void;
    child(meta: any): Logger;
    isLevelEnabled(level: string): boolean;
    isDebugEnabled(): boolean;
    isInfoEnabled(): boolean;
    isWarnEnabled(): boolean;
    isErrorEnabled(): boolean;
    silent: boolean;
    format: any;
    levels: any;
    level: string;
    close(): void;
    on(event: string, handler: (...args: any[]) => void): void;
    end(): void;
  }

  export interface TransportStream {
    name: string;
    level?: string;
    silent?: boolean;
    format?: any;
    handleExceptions?: boolean;
    handleRejections?: boolean;
    log(info: any, callback: () => void): void;
    on(event: string, handler: (...args: any[]) => void): void;
    end(): void;
  }

  export const format: {
    combine(...formats: any[]): any;
    timestamp(opts?: any): any;
    json(opts?: any): any;
    printf(templateFn: (info: any) => string): any;
    colorize(opts?: any): any;
    errors(opts?: any): any;
    simple(): any;
    label(opts: any): any;
    metadata(opts?: any): any;
    splat(): any;
    (transformFn: (info: any) => any): any;
  };

  export const transports: {
    Console: new (opts?: any) => TransportStream;
    File: new (opts?: any) => TransportStream;
    Http: new (opts?: any) => TransportStream;
    Stream: new (opts?: any) => TransportStream;
  };

  export function createLogger(config?: any): Logger;
  export function log(level: string, message: string, ...args: any[]): void;
}

declare module 'winston-daily-rotate-file' {
  class DailyRotateFile {
    constructor(options?: any);
    name: string;
    level?: string;
    silent?: boolean;
    format?: any;
    handleExceptions?: boolean;
    handleRejections?: boolean;
    log(info: any, callback: () => void): void;
    on(event: string, handler: (...args: any[]) => void): void;
    end(): void;
  }
  export = DailyRotateFile;
}
