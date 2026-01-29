import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    useWindowDimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '@/theme';
import { Lock, User, AlertCircle, Check } from 'lucide-react-native';
import { api } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const AUTH_TOKEN_KEY = '@feeds_auth_token';

interface LoginScreenProps {
    onLogin?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const router = useRouter();

    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isChecking, setIsChecking] = useState(true);
    const [needsSetup, setNeedsSetup] = useState(false);

    // Check auth status on mount
    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            // Check if we already have a token
            const existingToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (existingToken) {
                // Verify token is still valid by making a test request
                try {
                    await api.getFeeds();
                    onLogin?.();
                    return;
                } catch (e) {
                    // Token invalid, remove it
                    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
                }
            }

            // Check if auth is configured
            const status = await api.getAuthStatus();
            if (!status.authEnabled) {
                // Auth not enabled, allow access
                onLogin?.();
                return;
            }

            setNeedsSetup(status.needsSetup);
        } catch (e) {
            console.error('Auth check failed:', e);
        } finally {
            setIsChecking(false);
        }
    };

    const handleLogin = async () => {
        if (!password.trim()) {
            setError('Please enter your password');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await api.login(password);
            await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);
            onLogin?.();
        } catch (e: any) {
            setError(e.message || 'Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetup = async () => {
        if (!password.trim() || password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await api.setupPassword(password);
            await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);
            onLogin?.();
        } catch (e: any) {
            setError(e.message || 'Setup failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const s = styles(colors, isMobile);

    if (isChecking) {
        return (
            <View style={s.container}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={s.container}
        >
            <ScrollView
                contentContainerStyle={s.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={s.card}>
                    {/* Logo/Icon */}
                    <View style={s.iconContainer}>
                        <Lock size={32} color="#fff" />
                    </View>

                    {/* Title */}
                    <Text style={s.title}>
                        {needsSetup ? 'Set Up Password' : 'Welcome Back'}
                    </Text>
                    <Text style={s.subtitle}>
                        {needsSetup
                            ? 'Create a password to secure your Feeds'
                            : 'Enter your password to continue'}
                    </Text>

                    {/* Error Message */}
                    {error ? (
                        <View style={s.errorContainer}>
                            <AlertCircle size={16} color={colors.error} />
                            <Text style={s.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {/* Password Input */}
                    <View style={s.inputContainer}>
                        <Lock
                            size={20}
                            color={colors.text.tertiary}
                            style={s.inputIcon}
                        />
                        <TextInput
                            style={s.input}
                            placeholder={
                                needsSetup
                                    ? 'Create password (min 8 chars)'
                                    : 'Enter your password'
                            }
                            placeholderTextColor={colors.text.tertiary}
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                            onSubmitEditing={needsSetup ? handleSetup : handleLogin}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!isLoading}
                        />
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[s.button, isLoading && s.buttonDisabled]}
                        onPress={needsSetup ? handleSetup : handleLogin}
                        disabled={isLoading}
                        activeOpacity={0.8}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={s.buttonText}>
                                {needsSetup ? 'Create Password' : 'Sign In'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Setup hint */}
                    {needsSetup && (
                        <View style={s.hintContainer}>
                            <Check size={14} color={colors.text.tertiary} />
                            <Text style={s.hintText}>
                                Password will be stored securely
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = (colors: any, isMobile: boolean) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background.primary,
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.lg,
        },
        card: {
            width: isMobile ? '100%' : 400,
            maxWidth: 400,
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.xl,
            padding: spacing.xl,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
            ...shadows.lg,
        },
        iconContainer: {
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: colors.primary.DEFAULT,
            justifyContent: 'center',
            alignItems: 'center',
            alignSelf: 'center',
            marginBottom: spacing.lg,
            ...shadows.md,
        },
        title: {
            fontSize: 24,
            fontWeight: '800',
            color: colors.text.primary,
            textAlign: 'center',
            marginBottom: spacing.xs,
        },
        subtitle: {
            fontSize: 14,
            color: colors.text.secondary,
            textAlign: 'center',
            marginBottom: spacing.lg,
        },
        errorContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.error + '15',
            padding: spacing.md,
            borderRadius: borderRadius.md,
            marginBottom: spacing.md,
        },
        errorText: {
            fontSize: 14,
            color: colors.error,
            flex: 1,
        },
        inputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.background.tertiary,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
            marginBottom: spacing.md,
        },
        inputIcon: {
            marginLeft: spacing.md,
        },
        input: {
            flex: 1,
            padding: spacing.md,
            fontSize: 16,
            color: colors.text.primary,
        },
        button: {
            backgroundColor: colors.primary.DEFAULT,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            alignItems: 'center',
            ...shadows.md,
        },
        buttonDisabled: {
            opacity: 0.6,
        },
        buttonText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '700',
        },
        hintContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: spacing.md,
        },
        hintText: {
            fontSize: 12,
            color: colors.text.tertiary,
        },
    });

export default LoginScreen;
