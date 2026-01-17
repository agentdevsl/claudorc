import { RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { BootstrapProvider, useBootstrapContext } from './providers/bootstrap-provider';
import { router } from './router';
import { useServices } from './services/service-context';
import './styles/globals.css';

const mount = document.getElementById('root');

const RouterWithContext = (): React.JSX.Element => {
  const services = useServices();
  const bootstrap = useBootstrapContext();

  return <RouterProvider router={router} context={{ services, bootstrap }} />;
};

if (mount) {
  createRoot(mount).render(
    <BootstrapProvider>
      <RouterWithContext />
    </BootstrapProvider>
  );
}
