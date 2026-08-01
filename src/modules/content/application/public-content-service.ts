import type { PublicContentLocale } from '../workflow/types';
import { projectPublicServices } from '../domain/project-public-services';
import type { PublicServicesV1 } from '../domain/public-services';

export interface PublicContentRepository {
  findServices(locale: PublicContentLocale): Promise<readonly unknown[]>;
}

export type PublicContentService = Readonly<{
  getServices(locale: PublicContentLocale): Promise<PublicServicesV1>;
}>;

export function createPublicContentService(
  repository: PublicContentRepository,
  now: () => Date = () => new Date(),
): PublicContentService {
  return {
    async getServices(locale) {
      return projectPublicServices(
        await repository.findServices(locale),
        locale,
        now(),
      );
    },
  };
}
