/**
 * Utility function to delay execution for a specified time
 * Used for polling and retry mechanisms
 * 
 * @param ms - Milliseconds to delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an HTTP method should use idempotency
 * 
 * @param method - HTTP method to check
 * @param configuredMethods - Array of methods configured for idempotency
 * @returns true if method should use idempotency
 */
export function shouldUseIdempotency(
  method: string | undefined,
  configuredMethods: string[]
): boolean {
  if (!method) {
    return false;
  }

  const normalizedMethod = method.toUpperCase();
  const normalizedConfigured = configuredMethods.map((m) => m.toUpperCase());

  return normalizedConfigured.includes(normalizedMethod);
}

/**
 * Serialize an Axios response for caching
 * Extracts only the necessary parts to reconstruct the response
 * 
 * @param response - Axios response object
 * @returns Serialized JSON string
 */
export function serializeResponse(response: any): string {
  const cached = {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    config: {
      url: response.config.url,
      method: response.config.method,
      headers: response.config.headers,
      params: response.config.params,
    },
  };

  return JSON.stringify(cached);
}

/**
 * Deserialize a cached response
 * 
 * @param serialized - Serialized response string
 * @returns Parsed response object or null if invalid
 */
export function deserializeResponse(serialized: string): any | null {
  try {
    return JSON.parse(serialized);
  } catch {
    return null;
  }
}
