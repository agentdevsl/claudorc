import { useServices } from '@/app/services/service-context';
import type { Services } from '@/app/services/services';

export function useServiceSnapshot(): Services {
  return useServices();
}
