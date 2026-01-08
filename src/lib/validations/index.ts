export * from "./session";

import { z } from "zod";
import { validationError } from "@/lib/api/errors";

/**
 * Validate request body against a Zod schema
 * Returns the parsed data or a validation error response
 */
export async function validateBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T>; error: null } | { data: null; error: ReturnType<typeof validationError> }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.flatten();
      return {
        data: null,
        error: validationError("Validation failed", {
          fieldErrors: errors.fieldErrors,
          formErrors: errors.formErrors,
        }),
      };
    }

    return { data: result.data, error: null };
  } catch {
    return {
      data: null,
      error: validationError("Invalid JSON body"),
    };
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T
): { data: z.infer<T>; error: null } | { data: null; error: ReturnType<typeof validationError> } {
  const params: Record<string, string | string[]> = {};

  searchParams.forEach((value, key) => {
    if (params[key]) {
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key] as string, value];
      }
    } else {
      params[key] = value;
    }
  });

  const result = schema.safeParse(params);

  if (!result.success) {
    const errors = result.error.flatten();
    return {
      data: null,
      error: validationError("Invalid query parameters", {
        fieldErrors: errors.fieldErrors,
      }),
    };
  }

  return { data: result.data, error: null };
}
