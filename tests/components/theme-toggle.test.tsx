import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from '@/app/components/features/theme-toggle';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: () => {
      store = {};
    },
  };
})();

// Mock matchMedia
const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
  matches: query === '(prefers-color-scheme: dark)',
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('matchMedia', matchMediaMock);
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    document.documentElement.dataset.theme = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders Light, Dark, and System options when menu is open', () => {
    render(<ThemeToggle />);

    // Open the dropdown menu
    fireEvent.click(screen.getByTestId('theme-toggle'));

    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('updates theme on click', () => {
    render(<ThemeToggle />);

    // Open the dropdown menu
    fireEvent.click(screen.getByTestId('theme-toggle'));

    // Click Dark theme
    fireEvent.click(screen.getByTestId('theme-dark'));

    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('persists theme to localStorage', () => {
    render(<ThemeToggle />);

    // Open the dropdown menu
    fireEvent.click(screen.getByTestId('theme-toggle'));

    // Click Light theme
    fireEvent.click(screen.getByTestId('theme-light'));

    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
  });

  it('loads theme from localStorage on mount', () => {
    localStorageMock.getItem.mockReturnValue('dark');

    render(<ThemeToggle />);

    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('applies system theme based on media query', () => {
    // matchMedia is mocked to return dark preference
    localStorageMock.getItem.mockReturnValue(null);

    render(<ThemeToggle />);

    // System is default, should apply dark based on mocked media query
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('applies className prop', () => {
    const { container } = render(<ThemeToggle className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('switches between themes correctly', () => {
    render(<ThemeToggle />);

    // Open the dropdown menu and switch to Light
    fireEvent.click(screen.getByTestId('theme-toggle'));
    fireEvent.click(screen.getByTestId('theme-light'));
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
    expect(document.documentElement.dataset.theme).toBe('light');

    // Open menu again and switch to Dark
    fireEvent.click(screen.getByTestId('theme-toggle'));
    fireEvent.click(screen.getByTestId('theme-dark'));
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    // Open menu again and switch back to System
    fireEvent.click(screen.getByTestId('theme-toggle'));
    fireEvent.click(screen.getByTestId('theme-system'));
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'system');
  });
});
