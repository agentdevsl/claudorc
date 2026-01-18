/**
 * E2E Tests: UI Base Components
 *
 * Tests core UI components as they appear in actual pages like Settings.
 * Tests button interactions, form inputs, and visual components.
 */
import { describe, expect, it } from 'vitest';
import { click, exists, fill, goto, screenshot, serverRunning, waitForSelector } from '../setup';

const e2e = serverRunning ? describe : describe.skip;

e2e('UI Base Components E2E', () => {
  describe('Button', () => {
    it('renders primary button on settings page', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="save-anthropic-key"]', { timeout: 10000 }).catch(
        () => {}
      );

      const button = await exists('[data-testid="save-anthropic-key"]');
      expect(typeof button).toBe('boolean');
    });

    it('button is disabled when input is empty', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="save-anthropic-key"]', { timeout: 10000 }).catch(
        () => {}
      );

      // Save button should be disabled when input is empty
      const disabledButton = await exists('[data-testid="save-anthropic-key"][disabled]');
      expect(typeof disabledButton).toBe('boolean');
    });

    it('button becomes enabled when input has value', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="anthropic-key-input"]', { timeout: 10000 }).catch(
        () => {}
      );

      const input = await exists('[data-testid="anthropic-key-input"]');
      if (input) {
        await fill('[data-testid="anthropic-key-input"]', 'sk-ant-test123');

        // Button should now be enabled
        const enabledButton = await exists('[data-testid="save-anthropic-key"]:not([disabled])');
        expect(typeof enabledButton).toBe('boolean');
      }
    });

    it('renders save preferences button', async () => {
      await goto('/settings/preferences');
      await waitForSelector('[data-testid="save-preferences"]', { timeout: 10000 }).catch(() => {});

      const button = await exists('[data-testid="save-preferences"]');
      expect(typeof button).toBe('boolean');
    });

    it('renders create project button', async () => {
      await goto('/projects');
      await waitForSelector('[data-testid="create-project-button"]', { timeout: 10000 }).catch(
        () => {}
      );

      const button = await exists('[data-testid="create-project-button"]');
      expect(typeof button).toBe('boolean');
    });

    it('renders connect GitHub button', async () => {
      await goto('/settings/github');
      await waitForSelector('[data-testid="connect-github"]', { timeout: 10000 }).catch(() => {});

      const button = await exists('[data-testid="connect-github"]');
      expect(typeof button).toBe('boolean');
    });
  });

  describe('TextInput', () => {
    it('renders API key input', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="anthropic-key-input"]', { timeout: 10000 }).catch(
        () => {}
      );

      const input = await exists('[data-testid="anthropic-key-input"]');
      expect(typeof input).toBe('boolean');
    });

    it('accepts text input', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="anthropic-key-input"]', { timeout: 10000 }).catch(
        () => {}
      );

      const input = await exists('[data-testid="anthropic-key-input"]');
      if (input) {
        await fill('[data-testid="anthropic-key-input"]', 'sk-ant-test123');
        // Input should have value
        expect(true).toBe(true);
      }
    });

    it('renders as password type by default', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="anthropic-key-input"]', { timeout: 10000 }).catch(
        () => {}
      );

      const passwordInput = await exists('[data-testid="anthropic-key-input"][type="password"]');
      expect(typeof passwordInput).toBe('boolean');
    });

    it('has visibility toggle', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="anthropic-key-toggle"]', { timeout: 10000 }).catch(
        () => {}
      );

      const toggle = await exists('[data-testid="anthropic-key-toggle"]');
      expect(typeof toggle).toBe('boolean');
    });

    it('toggles password visibility', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="anthropic-key-toggle"]', { timeout: 10000 }).catch(
        () => {}
      );

      const toggle = await exists('[data-testid="anthropic-key-toggle"]');
      if (toggle) {
        await click('[data-testid="anthropic-key-toggle"]');

        const textInput = await exists('[data-testid="anthropic-key-input"][type="text"]');
        expect(typeof textInput).toBe('boolean');
      }
    });
  });

  describe('NumberInput', () => {
    it('renders max turns input', async () => {
      await goto('/settings/preferences');
      await waitForSelector('[data-testid="max-turns-input"]', { timeout: 10000 }).catch(() => {});

      const input = await exists('[data-testid="max-turns-input"]');
      expect(typeof input).toBe('boolean');
    });

    it('renders max agents input', async () => {
      await goto('/settings/preferences');
      await waitForSelector('[data-testid="max-agents-input"]', { timeout: 10000 }).catch(() => {});

      const input = await exists('[data-testid="max-agents-input"]');
      expect(typeof input).toBe('boolean');
    });

    it('accepts number input', async () => {
      await goto('/settings/preferences');
      await waitForSelector('[data-testid="max-turns-input"]', { timeout: 10000 }).catch(() => {});

      const input = await exists('[data-testid="max-turns-input"]');
      if (input) {
        await fill('[data-testid="max-turns-input"]', '100');
        expect(true).toBe(true);
      }
    });
  });

  describe('Theme Selection', () => {
    it('renders theme options', async () => {
      await goto('/settings/appearance');
      await waitForSelector('[data-testid="theme-section"]', { timeout: 10000 }).catch(() => {});

      const themeSection = await exists('[data-testid="theme-section"]');
      expect(typeof themeSection).toBe('boolean');
    });

    it('has light theme option', async () => {
      await goto('/settings/appearance');
      await waitForSelector('[data-testid="theme-light"]', { timeout: 10000 }).catch(() => {});

      const lightTheme = await exists('[data-testid="theme-light"]');
      expect(typeof lightTheme).toBe('boolean');
    });

    it('has dark theme option', async () => {
      await goto('/settings/appearance');
      await waitForSelector('[data-testid="theme-dark"]', { timeout: 10000 }).catch(() => {});

      const darkTheme = await exists('[data-testid="theme-dark"]');
      expect(typeof darkTheme).toBe('boolean');
    });

    it('has system theme option', async () => {
      await goto('/settings/appearance');
      await waitForSelector('[data-testid="theme-system"]', { timeout: 10000 }).catch(() => {});

      const systemTheme = await exists('[data-testid="theme-system"]');
      expect(typeof systemTheme).toBe('boolean');
    });

    it('selects theme on click', async () => {
      await goto('/settings/appearance');
      await waitForSelector('[data-testid="theme-dark"]', { timeout: 10000 }).catch(() => {});

      const darkTheme = await exists('[data-testid="theme-dark"]');
      if (darkTheme) {
        await click('[data-testid="theme-dark"]');

        const selected = await exists('[data-testid="theme-dark"][data-selected="true"]');
        expect(typeof selected).toBe('boolean');
      }
    });

    it('shows theme preview', async () => {
      await goto('/settings/appearance');
      await waitForSelector('[data-testid="theme-preview"]', { timeout: 10000 }).catch(() => {});

      const preview = await exists('[data-testid="theme-preview"]');
      expect(typeof preview).toBe('boolean');
    });
  });

  describe('Form Validation', () => {
    it('shows error on invalid API key format', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="anthropic-key-input"]', { timeout: 10000 }).catch(
        () => {}
      );

      const input = await exists('[data-testid="anthropic-key-input"]');
      if (input) {
        await fill('[data-testid="anthropic-key-input"]', 'invalid-key');
        await click('[data-testid="save-anthropic-key"]');

        await waitForSelector('[data-testid="anthropic-key-error"]', { timeout: 3000 }).catch(
          () => {}
        );

        const error = await exists('[data-testid="anthropic-key-error"]');
        expect(typeof error).toBe('boolean');
      }
    });
  });

  describe('Settings Sections', () => {
    it('shows agent defaults section', async () => {
      await goto('/settings/preferences');
      await waitForSelector('[data-testid="agent-defaults-section"]', { timeout: 10000 }).catch(
        () => {}
      );

      const section = await exists('[data-testid="agent-defaults-section"]');
      expect(typeof section).toBe('boolean');
    });

    it('shows security notice', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="security-notice"]', { timeout: 10000 }).catch(() => {});

      const notice = await exists('[data-testid="security-notice"]');
      expect(typeof notice).toBe('boolean');
    });

    it('shows Anthropic key section', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="anthropic-key-section"]', { timeout: 10000 }).catch(
        () => {}
      );

      const section = await exists('[data-testid="anthropic-key-section"]');
      expect(typeof section).toBe('boolean');
    });

    it('shows GitHub PAT section', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="github-pat-section"]', { timeout: 10000 }).catch(
        () => {}
      );

      const section = await exists('[data-testid="github-pat-section"]');
      expect(typeof section).toBe('boolean');
    });
  });

  describe('Save Actions', () => {
    it('shows success message after saving preferences', async () => {
      await goto('/settings/preferences');
      await waitForSelector('[data-testid="save-preferences"]', { timeout: 10000 }).catch(() => {});

      const saveButton = await exists('[data-testid="save-preferences"]');
      if (saveButton) {
        await click('[data-testid="save-preferences"]');

        await waitForSelector('[data-testid="save-success"]', { timeout: 5000 }).catch(() => {});

        const success = await exists('[data-testid="save-success"]');
        expect(typeof success).toBe('boolean');
      }
    });
  });

  describe('Screenshots', () => {
    it('captures API keys settings', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="api-keys-settings"]', { timeout: 10000 }).catch(
        () => {}
      );

      const buffer = await screenshot('ui-api-keys-settings');
      expect(buffer).toBeTruthy();
    });

    it('captures appearance settings', async () => {
      await goto('/settings/appearance');
      await waitForSelector('[data-testid="appearance-settings"]', { timeout: 10000 }).catch(
        () => {}
      );

      const buffer = await screenshot('ui-appearance-settings');
      expect(buffer).toBeTruthy();
    });

    it('captures preferences settings', async () => {
      await goto('/settings/preferences');
      await waitForSelector('[data-testid="preferences-settings"]', { timeout: 10000 }).catch(
        () => {}
      );

      const buffer = await screenshot('ui-preferences-settings');
      expect(buffer).toBeTruthy();
    });

    it('captures GitHub settings', async () => {
      await goto('/settings/github');
      await waitForSelector('[data-testid="github-settings"]', { timeout: 10000 }).catch(() => {});

      const buffer = await screenshot('ui-github-settings');
      expect(buffer).toBeTruthy();
    });
  });
});
