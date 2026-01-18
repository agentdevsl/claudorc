import { RouterProvider } from '@tanstack/react-router';
import { createRoot, type Root } from 'react-dom/client';
import { BootstrapProvider, useBootstrapContext } from './providers/bootstrap-provider';
import { router } from './router';
import { useServices } from './services/service-context';
import './styles/globals.css';

// Extend Window interface to store React root across HMR reloads
// Module-level variables are reset during HMR, but window persists
declare global {
  interface Window {
    __AGENTPANE_ROOT__?: Root;
  }
}

const mount = document.getElementById('root');

const RouterWithContext = (): React.JSX.Element => {
  const services = useServices();
  const bootstrap = useBootstrapContext();

  return <RouterProvider router={router} context={{ services, bootstrap }} />;
};

if (mount) {
  // Reuse existing root during HMR - window persists across module reloads
  // while module-level variables are reset
  if (!window.__AGENTPANE_ROOT__) {
    window.__AGENTPANE_ROOT__ = createRoot(mount);
  }

  window.__AGENTPANE_ROOT__.render(
    <BootstrapProvider>
      <RouterWithContext />
    </BootstrapProvider>
  );
}

// Accept HMR updates to enable fast refresh without full page reload
if (import.meta.hot) {
  import.meta.hot.accept();
}
