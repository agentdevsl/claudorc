import type { Services } from '@/app/services/services';
import { useServices } from '@/app/services/service-context';

export function useServiceSnapshot(): Services {
  return useServices();
}
