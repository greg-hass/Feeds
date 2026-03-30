import type { AuthResponse, AuthStatus } from '../api.types';
import type { ApiClientCore } from './client';

export function createAuthApi(client: ApiClientCore) {
    return {
        async login(password: string): Promise<AuthResponse> {
            const response = await client.post<AuthResponse>('/auth/login', { password });
            await client.setAuthToken(response.token);
            return response;
        },

        async setupPassword(password: string): Promise<AuthResponse> {
            const response = await client.post<AuthResponse>('/auth/setup', { password });
            await client.setAuthToken(response.token);
            return response;
        },

        async getAuthStatus(): Promise<AuthStatus> {
            return client.get<AuthStatus>('/auth/status');
        },

        async logout(): Promise<void> {
            await client.clearAuthToken();
        },
    };
}
