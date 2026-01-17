/**
 * This script intercepts `bun test` and redirects to vitest.
 *
 * The project uses Vitest for testing, not Bun's built-in test runner.
 * This preload script ensures users get a helpful message instead of
 * confusing module resolution errors.
 */

console.error("\n\x1b[33m⚠️  This project uses Vitest, not Bun's test runner.\x1b[0m\n");
console.error('Run tests with:\n');
console.error('  \x1b[36mbun run test\x1b[0m        # single run');
console.error('  \x1b[36mbun run test:watch\x1b[0m  # watch mode');
console.error('  \x1b[36mbun run test:coverage\x1b[0m # with coverage\n');

process.exit(1);
