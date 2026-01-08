import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "RATE_LIMITED";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiError;
  timestamp: string;
  path?: string;
}

const ERROR_STATUS_MAP: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
};

const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: "Authentication required",
  FORBIDDEN: "You don't have permission to access this resource",
  NOT_FOUND: "Resource not found",
  BAD_REQUEST: "Invalid request",
  CONFLICT: "Resource conflict",
  VALIDATION_ERROR: "Validation failed",
  INTERNAL_ERROR: "An unexpected error occurred",
  SERVICE_UNAVAILABLE: "Service temporarily unavailable",
  RATE_LIMITED: "Too many requests, please try again later",
};

/**
 * Create a standardized API error response
 */
export function apiError(
  code: ApiErrorCode,
  message?: string,
  details?: Record<string, unknown>,
  path?: string
): NextResponse<ApiErrorResponse> {
  const status = ERROR_STATUS_MAP[code];
  const errorMessage = message || DEFAULT_MESSAGES[code];

  const response: ApiErrorResponse = {
    error: {
      code,
      message: errorMessage,
      ...(details && { details }),
    },
    timestamp: new Date().toISOString(),
    ...(path && { path }),
  };

  // Log errors in development
  if (process.env.NODE_ENV === "development") {
    console.error(`[API Error] ${code}: ${errorMessage}`, details);
  }

  return NextResponse.json(response, { status });
}

/**
 * Shorthand error helpers
 */
export const unauthorized = (message?: string, details?: Record<string, unknown>) =>
  apiError("UNAUTHORIZED", message, details);

export const forbidden = (message?: string, details?: Record<string, unknown>) =>
  apiError("FORBIDDEN", message, details);

export const notFound = (message?: string, details?: Record<string, unknown>) =>
  apiError("NOT_FOUND", message, details);

export const badRequest = (message?: string, details?: Record<string, unknown>) =>
  apiError("BAD_REQUEST", message, details);

export const conflict = (message?: string, details?: Record<string, unknown>) =>
  apiError("CONFLICT", message, details);

export const validationError = (message?: string, details?: Record<string, unknown>) =>
  apiError("VALIDATION_ERROR", message, details);

export const internalError = (message?: string, details?: Record<string, unknown>) =>
  apiError("INTERNAL_ERROR", message, details);

export const serviceUnavailable = (message?: string, details?: Record<string, unknown>) =>
  apiError("SERVICE_UNAVAILABLE", message, details);

export const rateLimited = (message?: string, details?: Record<string, unknown>) =>
  apiError("RATE_LIMITED", message, details);

/**
 * Wrap an async handler with error catching
 */
export function withErrorHandling<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiErrorResponse>> {
  return handler().catch((error: unknown) => {
    console.error("Unhandled API error:", error);

    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes("not found")) {
        return notFound(error.message);
      }
      if (error.message.includes("unauthorized") || error.message.includes("Unauthorized")) {
        return unauthorized(error.message);
      }
      if (error.message.includes("forbidden") || error.message.includes("permission")) {
        return forbidden(error.message);
      }

      return internalError(
        process.env.NODE_ENV === "development" ? error.message : undefined
      );
    }

    return internalError();
  });
}

/**
 * Parse API error response on the client side
 */
export async function parseApiError(response: Response): Promise<ApiError> {
  try {
    const data = await response.json();
    if (data.error) {
      return data.error;
    }
    return {
      code: "INTERNAL_ERROR",
      message: data.message || "An unexpected error occurred",
    };
  } catch {
    return {
      code: "INTERNAL_ERROR",
      message: `Request failed with status ${response.status}`,
    };
  }
}

/**
 * Client-side fetch wrapper with error handling
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new ApiClientError(error.code, error.message, error.details);
  }

  return response.json();
}

/**
 * Custom error class for client-side API errors
 */
export class ApiClientError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}
