import Constants from 'expo-constants';

/**
 * Resolves the backend API base URL dynamically:
 * 1. EXPO_PUBLIC_API_URL environment variable if provided.
 * 2. Constants.expoConfig?.hostUri host for LAN debugging on devices/simulators (port 5050).
 * 3. Default fallback: http://localhost:5050
 */
export function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri && typeof hostUri === 'string') {
    const host = hostUri.split(':')[0]?.trim();
    if (host && host.length > 0 && host !== 'undefined' && host !== 'null') {
      return `http://${host}:5050`;
    }
  }

  return 'http://localhost:5050';
}

/**
 * Standard typed API error carrying HTTP status, application error code,
 * targeted endpoint, and a network error distinction flag.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  endpoint: string;
  isNetworkError: boolean;

  constructor(
    message: string,
    status = 0,
    code = 'UNKNOWN_ERROR',
    endpoint = '',
    isNetworkError = false
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.endpoint = endpoint;
    this.isNetworkError = isNetworkError;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'signal'> {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
}

/**
 * Robust fetch wrapper featuring:
 * - Configurable request timeout via AbortController
 * - Exponential backoff retries for network failures and HTTP 5xx responses
 * - No retries for HTTP 4xx client errors or caller-initiated aborts
 * - Strongly-typed responses and error parsing
 */
export async function apiRequest<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  const baseUrl = resolveApiBaseUrl();
  const url = path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const method = (options?.method ?? 'GET').toUpperCase();
  const defaultRetries = method === 'GET' || method === 'HEAD' ? 2 : 0;
  const maxRetries = options?.retries !== undefined ? options?.retries : defaultRetries;
  const timeoutMs = options?.timeoutMs ?? 8000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // If caller has already aborted, fail immediately without retrying
    if (options?.signal?.aborted) {
      throw new ApiError('Request aborted by caller', 0, 'ABORTED', path, false);
    }

    const controller = new AbortController();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const onCallerAbort = () => {
      controller.abort();
    };

    if (options?.signal) {
      options.signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    try {
      const response = await fetch(url, {
        ...options,
        method,
        headers: {
          Accept: 'application/json',
          ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
          ...options?.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorBody: any = null;
        try {
          errorBody = await response.json();
        } catch {
          // Response body was not JSON
        }

        const message =
          errorBody?.message ||
          errorBody?.error ||
          `HTTP ${response.status} ${response.statusText || 'Error'}`;
        const errorCode =
          typeof errorBody?.error === 'string'
            ? errorBody.error
            : `HTTP_${response.status}`;

        // HTTP 5xx errors: retry with exponential backoff if retries remain
        if (response.status >= 500 && attempt < maxRetries) {
          const backoffMs = 300 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        throw new ApiError(message, response.status, errorCode, path, false);
      }

      const data = (await response.json()) as T;
      return data;
    } catch (err: unknown) {
      // If we threw an ApiError (e.g. 4xx or 5xx that exhausted retries), re-throw
      if (err instanceof ApiError) {
        throw err;
      }

      // Check caller abort
      if (options?.signal?.aborted) {
        throw new ApiError('Request aborted by caller', 0, 'ABORTED', path, false);
      }

      const isTimeoutError = timedOut;
      const isAbortError = (err as Error)?.name === 'AbortError';
      const isNetworkError = !isAbortError || isTimeoutError;
      const errorMessage = isTimeoutError
        ? `Request timed out after ${timeoutMs}ms: ${path}`
        : (err as Error)?.message || 'Network request failed';
      const errorCode = isTimeoutError ? 'TIMEOUT' : 'NETWORK_ERROR';

      // Retry on network errors or timeouts if retries remain
      if (attempt < maxRetries) {
        const backoffMs = 300 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      throw new ApiError(errorMessage, 0, errorCode, path, isNetworkError);
    } finally {
      clearTimeout(timeoutId);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onCallerAbort);
      }
    }
  }

  throw new ApiError('Request failed after max retries', 0, 'MAX_RETRIES_EXCEEDED', path, true);
}

/**
 * Convenient API client helper object.
 */
export const apiClient = {
  get: <T>(path: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<T> =>
    apiRequest<T>(path, { ...options, method: 'GET' }),

  post: <T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>
  ): Promise<T> =>
    apiRequest<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  getBaseUrl: resolveApiBaseUrl,
};
