export type XonusErrorCode =
  | 'XONUS_CONFIG'
  | 'XONUS_INPUT'
  | 'XONUS_API'
  | 'XONUS_PARSE'
  | 'XONUS_ABORTED'
  | 'XONUS_TIMEOUT';

/** Base class for every error raised by Xonus. */
export class XonusError extends Error {
  readonly code: XonusErrorCode;

  constructor(code: XonusErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

/** Invalid configuration (bad key, bad threshold, unsupported options count...). */
export class XonusConfigError extends XonusError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('XONUS_CONFIG', message, options);
  }
}

/** Invalid decision input (empty question, duplicate options, too many options...). */
export class XonusInputError extends XonusError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('XONUS_INPUT', message, options);
  }
}

/** A failure returned by the model provider or the network layer. */
export class XonusApiError extends XonusError {
  readonly status?: number;

  constructor(message: string, options?: { cause?: unknown; status?: number }) {
    super('XONUS_API', message, options);
    this.status = options?.status;
  }
}

/** The model responded, but no usable option could be recovered. */
export class XonusParseError extends XonusError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('XONUS_PARSE', message, options);
  }
}

/** The request was cancelled by the caller. */
export class XonusAbortError extends XonusError {
  constructor(message = 'The decision was aborted.', options?: { cause?: unknown }) {
    super('XONUS_ABORTED', message, options);
  }
}

/** The per-decision deadline elapsed. */
export class XonusTimeoutError extends XonusError {
  constructor(message = 'The decision timed out.', options?: { cause?: unknown }) {
    super('XONUS_TIMEOUT', message, options);
  }
}
