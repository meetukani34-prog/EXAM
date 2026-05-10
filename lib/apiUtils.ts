/**
 * Executes an asynchronous function with exponential backoff retry logic.
 * @param fn The async function to execute.
 * @param retries Maximum number of retries.
 * @param delay Initial delay in milliseconds.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    console.warn(`Operation failed, retrying in ${delay}ms... (${retries} retries left)`, error);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}
