import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const AUTH_TOKEN_KEY = '@feeds_auth_token';

function resolveApiUrl(): string {
    const configApiUrl =
        Constants.expoConfig?.extra?.apiUrl ||
        Constants.manifest2?.extra?.expoClient?.extra?.apiUrl ||
        Constants.manifest?.extra?.apiUrl;

    const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
    const configuredApiUrl = envApiUrl || configApiUrl;

    if (configuredApiUrl) {
        return configuredApiUrl.replace(/\/$/, '');
    }

    if (Platform.OS === 'web') {
        return '/api/v1';
    }

    return 'http://localhost:3001/api/v1';
}

const canUseClientStorage =
    Platform.OS !== 'web' ||
    (typeof window !== 'undefined' && typeof document !== 'undefined');

export interface RequestOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}

export class ApiError extends Error {
    code?: string;
    retryAfter?: number;
    payload?: Record<string, unknown>;

    constructor(
        message: string,
        public status: number,
        options?: { code?: string; retryAfter?: number; payload?: Record<string, unknown> }
    ) {
        super(message);
        this.name = 'ApiError';
        this.code = options?.code;
        this.retryAfter = options?.retryAfter;
        this.payload = options?.payload;
    }
}

export class ApiClientCore {
    private authToken: string | null = null;
    private initPromise: Promise<void> | null = null;
    private initialized = false;
    private readonly apiUrl = resolveApiUrl();

    getApiUrl(): string {
        return this.apiUrl;
    }

    async init(): Promise<void> {
        if (this.initialized) {
            return;
        }

        if (!this.initPromise) {
            this.initPromise = this.loadAuthToken()
                .finally(() => {
                    this.initialized = true;
                });
        }

        await this.initPromise;
    }

    async ensureInitialized(): Promise<void> {
        if (this.initialized) {
            return;
        }

        await this.init();
    }

    private async loadAuthToken(): Promise<void> {
        if (!canUseClientStorage) {
            this.authToken = null;
            return;
        }

        try {
            this.authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        } catch (e) {
            console.error('Failed to load auth token:', e);
            this.authToken = null;
        }
    }

    async setAuthToken(token: string): Promise<void> {
        await this.ensureInitialized();
        this.authToken = token;

        if (!canUseClientStorage) {
            return;
        }

        await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    }

    async clearAuthToken(): Promise<void> {
        await this.ensureInitialized();
        this.authToken = null;

        if (!canUseClientStorage) {
            return;
        }

        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    }

    hasAuthToken(): boolean {
        return !!this.authToken;
    }

    async getAuthorizedHeaders(): Promise<Record<string, string>> {
        await this.ensureInitialized();
        const headers: Record<string, string> = {};
        if (this.authToken) {
            headers.Authorization = `Bearer ${this.authToken}`;
        }
        return headers;
    }

    async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        await this.ensureInitialized();
        const { method = 'GET', body, headers = {}, signal } = options;

        const requestHeaders: Record<string, string> = {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
            ...(await this.getAuthorizedHeaders()),
        };

        Object.entries(headers).forEach(([key, value]) => {
            if (value !== undefined) {
                requestHeaders[key] = value;
            }
        });

        if (body !== undefined && body !== null && !(body instanceof FormData)) {
            requestHeaders['Content-Type'] = 'application/json';
        }

        let response: Response;

        try {
            response = await fetch(`${this.apiUrl}${endpoint}`, {
                method,
                headers: requestHeaders,
                body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
                signal,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Network request failed';
            throw new ApiError(
                `Unable to reach the Feeds server at ${this.apiUrl}. Check that the server is running and that EXPO_PUBLIC_API_URL or expo.extra.apiUrl points to the correct address.`,
                0,
                {
                    code: 'NETWORK_ERROR',
                    payload: { message },
                }
            );
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new ApiError(
                error.error || 'Request failed',
                response.status,
                {
                    code: error.code,
                    retryAfter: error.retryAfter,
                    payload: error,
                }
            );
        }

        const contentType = response.headers.get('Content-Type');
        if (contentType && (contentType.includes('text/xml') || contentType.includes('application/xml') || contentType.includes('text/plain'))) {
            return response.text() as unknown as T;
        }

        return response.json();
    }

    async get<T>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    async post<T>(endpoint: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'POST', body });
    }

    async patch<T>(endpoint: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
    }

    async put<T>(endpoint: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'PUT', body });
    }

    async delete<T>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }
}
