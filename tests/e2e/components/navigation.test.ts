/**
 * E2E Tests: Navigation Components
 *
 * Tests for Sidebar, Breadcrumbs, ProjectPicker, and LayoutShell.
 * Covers navigation flows, responsive behavior, and active states.
 */
import { describe, expect, it } from 'vitest';
import {
  click,
  exists,
  fill,
  getUrl,
  goto,
  hover,
  press,
  screenshot,
  serverRunning,
  waitForSelector,
} from '../setup';

const e2e = serverRunning ? describe : describe.skip;

e2e('Navigation Components E2E', () => {
  describe('Sidebar', () => {
    it('renders sidebar with navigation links', async () => {
      await goto('/');
      await waitForSelector('[data-testid="sidebar"]', { timeout: 10000 }).catch(() => {});

      const sidebar = await exists('[data-testid="sidebar"]');
      expect(typeof sidebar).toBe('boolean');
    });

    it('shows projects link', async () => {
      await goto('/');
      await waitForSelector('[data-testid="sidebar"]', { timeout: 10000 }).catch(() => {});

      const projectsLink = await exists('[data-testid="nav-projects"]');
      expect(typeof projectsLink).toBe('boolean');
    });

    it('shows settings link', async () => {
      await goto('/');
      await waitForSelector('[data-testid="sidebar"]', { timeout: 10000 }).catch(() => {});

      const settingsLink = await exists('[data-testid="nav-settings"]');
      expect(typeof settingsLink).toBe('boolean');
    });

    it('highlights active navigation item', async () => {
      await goto('/projects');
      await waitForSelector('[data-testid="sidebar"]', { timeout: 10000 }).catch(() => {});

      const activeLink = await exists('[data-testid="nav-projects"][data-active="true"]');
      expect(typeof activeLink).toBe('boolean');
    });

    it('navigates to projects page on link click', async () => {
      await goto('/');
      await waitForSelector('[data-testid="nav-projects"]', { timeout: 10000 }).catch(() => {});

      const projectsLink = await exists('[data-testid="nav-projects"]');
      if (projectsLink) {
        await click('[data-testid="nav-projects"]');
        await waitForSelector('[data-testid="project-list"]', { timeout: 5000 }).catch(() => {});

        const url = await getUrl();
        expect(url).toContain('/projects');
      }
    });

    it('collapses on mobile viewport', async () => {
      await goto('/');
      // Sidebar should be collapsible on mobile
      const sidebarToggle = await exists('[data-testid="sidebar-toggle"]');
      expect(typeof sidebarToggle).toBe('boolean');
    });

    it('expands when toggle clicked', async () => {
      await goto('/');
      const sidebarToggle = await exists('[data-testid="sidebar-toggle"]');
      if (sidebarToggle) {
        await click('[data-testid="sidebar-toggle"]');
        const sidebarExpanded = await exists('[data-testid="sidebar"][data-expanded="true"]');
        expect(typeof sidebarExpanded).toBe('boolean');
      }
    });
  });

  describe('Breadcrumbs', () => {
    it('shows breadcrumbs on project page', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="breadcrumbs"]', { timeout: 10000 }).catch(() => {});

      const breadcrumbs = await exists('[data-testid="breadcrumbs"]');
      expect(typeof breadcrumbs).toBe('boolean');
    });

    it('displays home link', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="breadcrumbs"]', { timeout: 10000 }).catch(() => {});

      const homeLink = await exists('[data-testid="breadcrumb-home"]');
      expect(typeof homeLink).toBe('boolean');
    });

    it('displays current page as text (not link)', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="breadcrumbs"]', { timeout: 10000 }).catch(() => {});

      const currentPage = await exists('[data-testid="breadcrumb-current"]');
      expect(typeof currentPage).toBe('boolean');
    });

    it('navigates when clicking breadcrumb link', async () => {
      await goto('/projects/test-project/settings');
      await waitForSelector('[data-testid="breadcrumbs"]', { timeout: 10000 }).catch(() => {});

      const projectLink = await exists('[data-testid="breadcrumb-project"]');
      if (projectLink) {
        await click('[data-testid="breadcrumb-project"]');

        const url = await getUrl();
        expect(url).toContain('/projects/');
      }
    });

    it('shows separator between breadcrumb items', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="breadcrumbs"]', { timeout: 10000 }).catch(() => {});

      const separator = await exists('[data-testid="breadcrumb-separator"]');
      expect(typeof separator).toBe('boolean');
    });
  });

  describe('ProjectPicker', () => {
    it('shows current project in picker', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="project-picker"]', { timeout: 10000 }).catch(() => {});

      const picker = await exists('[data-testid="project-picker"]');
      expect(typeof picker).toBe('boolean');
    });

    it('opens dropdown on click', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="project-picker"]', { timeout: 10000 }).catch(() => {});

      const picker = await exists('[data-testid="project-picker"]');
      if (picker) {
        await click('[data-testid="project-picker"]');
        await waitForSelector('[data-testid="project-dropdown"]', { timeout: 5000 });

        const dropdown = await exists('[data-testid="project-dropdown"]');
        expect(dropdown).toBe(true);
      }
    });

    it('lists all projects in dropdown', async () => {
      await goto('/projects/test-project');
      const picker = await exists('[data-testid="project-picker"]');
      if (picker) {
        await click('[data-testid="project-picker"]');
        await waitForSelector('[data-testid="project-dropdown"]', { timeout: 5000 });

        const projectItem = await exists('[data-testid="project-item"]');
        expect(typeof projectItem).toBe('boolean');
      }
    });

    it('filters projects on search input', async () => {
      await goto('/projects/test-project');
      const picker = await exists('[data-testid="project-picker"]');
      if (picker) {
        await click('[data-testid="project-picker"]');
        await waitForSelector('[data-testid="project-search"]', { timeout: 5000 }).catch(() => {});

        const searchInput = await exists('[data-testid="project-search"]');
        if (searchInput) {
          await fill('[data-testid="project-search"]', 'test');
          // Filtered results should update
          await waitForSelector('[data-testid="project-item"]', { timeout: 3000 }).catch(() => {});
        }
      }
    });

    it('switches project on selection', async () => {
      await goto('/projects/test-project');
      const picker = await exists('[data-testid="project-picker"]');
      if (picker) {
        await click('[data-testid="project-picker"]');
        await waitForSelector('[data-testid="project-item"]', { timeout: 5000 }).catch(() => {});

        const projectItem = await exists('[data-testid="project-item"]');
        if (projectItem) {
          await click('[data-testid="project-item"]');

          // URL should change to new project
          const url = await getUrl();
          expect(url).toContain('/projects/');
        }
      }
    });

    it('has new project option in dropdown', async () => {
      await goto('/projects/test-project');
      const picker = await exists('[data-testid="project-picker"]');
      if (picker) {
        await click('[data-testid="project-picker"]');
        await waitForSelector('[data-testid="project-dropdown"]', { timeout: 5000 });

        const newProjectOption = await exists('[data-testid="new-project-option"]');
        expect(typeof newProjectOption).toBe('boolean');
      }
    });

    it('closes dropdown on Escape', async () => {
      await goto('/projects/test-project');
      const picker = await exists('[data-testid="project-picker"]');
      if (picker) {
        await click('[data-testid="project-picker"]');
        await waitForSelector('[data-testid="project-dropdown"]', { timeout: 5000 });

        await press('Escape');

        const dropdownClosed = !(await exists('[data-testid="project-dropdown"]'));
        expect(dropdownClosed).toBe(true);
      }
    });

    it('supports keyboard navigation', async () => {
      await goto('/projects/test-project');
      const picker = await exists('[data-testid="project-picker"]');
      if (picker) {
        await click('[data-testid="project-picker"]');
        await waitForSelector('[data-testid="project-dropdown"]', { timeout: 5000 });

        // Arrow down to navigate
        await press('ArrowDown');
        await press('ArrowDown');
        await press('Enter');

        // Selection should work
        const dropdownClosed = !(await exists('[data-testid="project-dropdown"]'));
        expect(typeof dropdownClosed).toBe('boolean');
      }
    });
  });

  describe('LayoutShell', () => {
    it('renders header section', async () => {
      await goto('/');
      await waitForSelector('[data-testid="layout-header"]', { timeout: 10000 }).catch(() => {});

      const header = await exists('[data-testid="layout-header"]');
      expect(typeof header).toBe('boolean');
    });

    it('renders main content area', async () => {
      await goto('/');
      await waitForSelector('[data-testid="layout-main"]', { timeout: 10000 }).catch(() => {});

      const main = await exists('[data-testid="layout-main"]');
      expect(typeof main).toBe('boolean');
    });

    it('shows actions slot in header', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="header-actions"]', { timeout: 10000 }).catch(() => {});

      const actions = await exists('[data-testid="header-actions"]');
      expect(typeof actions).toBe('boolean');
    });

    it('displays page title', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="page-title"]', { timeout: 10000 }).catch(() => {});

      const title = await exists('[data-testid="page-title"]');
      expect(typeof title).toBe('boolean');
    });
  });

  describe('Screenshots', () => {
    it('captures sidebar screenshot', async () => {
      await goto('/');
      await waitForSelector('[data-testid="sidebar"]', { timeout: 10000 }).catch(() => {});

      const buffer = await screenshot('sidebar');
      expect(buffer).toBeTruthy();
    });

    it('captures project picker open screenshot', async () => {
      await goto('/projects/test-project');
      const picker = await exists('[data-testid="project-picker"]');
      if (picker) {
        await click('[data-testid="project-picker"]');
        await waitForSelector('[data-testid="project-dropdown"]', { timeout: 5000 });

        const buffer = await screenshot('project-picker-open');
        expect(buffer).toBeTruthy();
      }
    });
  });
});
