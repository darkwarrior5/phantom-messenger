/**
 * Phantom Messenger - Shared Utilities
 */

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true
  } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      await sleep(delay);
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: unknown[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): T {
  let inThrottle = false;

  return ((...args: unknown[]) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  }) as T;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate invitation code format
 */
export function isValidInvitationCode(code: string): boolean {
  // Format: PHM-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
  const pattern = /^PHM(-[A-Za-z0-9+/]{4}){8}$/;
  return pattern.test(code);
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, 65536); // Limit length
}

/**
 * Create a fingerprint for display
 */
export function createFingerprint(publicKey: string): string {
  // Take first 40 chars, group by 4
  const truncated = publicKey.replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  const groups: string[] = [];
  
  for (let i = 0; i < truncated.length; i += 4) {
    groups.push(truncated.slice(i, i + 4));
  }
  
  return groups.join(' ');
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if running in browser
 */
export function isBrowser(): boolean {
  return typeof globalThis !== 'undefined' && 
         typeof (globalThis as Record<string, unknown>).window !== 'undefined' && 
         typeof (globalThis as Record<string, unknown>).document !== 'undefined';
}

/**
 * Check if running in Node.js
 */
export function isNode(): boolean {
  return typeof globalThis !== 'undefined' && 
         typeof (globalThis as Record<string, unknown>).process !== 'undefined' &&
         ((globalThis as Record<string, unknown>).process as Record<string, unknown>)?.versions != null;
}
