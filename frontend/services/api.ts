import { createArticlesApi } from './api/articles';
import { createAuthApi } from './api/auth';
import { ApiClientCore, ApiError } from './api/client';
import { createFeedsApi } from './api/feeds';
import { createSystemApi } from './api/system';

// Re-export all types from api.types.ts for backward compatibility
export * from './api.types';

const coreClient = new ApiClientCore();

export const api = Object.assign(
    coreClient,
    createAuthApi(coreClient),
    createFeedsApi(coreClient),
    createArticlesApi(coreClient),
    createSystemApi(coreClient)
);

export { ApiError };
