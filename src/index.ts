/**
 * Example entry point for the web application template.
 * This file demonstrates the project structure and basic patterns.
 */

export const VERSION = '1.0.0';

/**
 * A simple greeting function demonstrating TypeScript patterns.
 * @param name - The name to greet
 * @returns A greeting message
 */
export function greet(name: string): string {
  if (!name.trim()) {
    throw new Error('Name cannot be empty');
  }
  return `Hello, ${name}!`;
}

/**
 * Async example demonstrating async/await patterns.
 * @param ms - Milliseconds to delay
 * @returns A promise that resolves after the delay
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
