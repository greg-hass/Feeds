import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores';
import { Rss } from 'lucide-react-native';
import { colors, borderRadius, spacing } from '@/theme';

export default function LoginScreen() {
    const router = useRouter();
    const { login } = useAuthStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!username || !password) {
            setError('Please enter username and password');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            await login(username, password);
            router.replace('/(app)');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <View style={styles.header}>
                    <Rss size={48} color={colors.primary.DEFAULT} />
                    <Text style={styles.title}>Feeds</Text>
                    <Text style={styles.subtitle}>Sign in to your account</Text>
                </View>

                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Username"
                        placeholderTextColor={colors.text.tertiary}
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor={colors.text.tertiary}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    <TouchableOpacity
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        <Text style={styles.buttonText}>
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: spacing.xl,
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.text.primary,
        marginTop: spacing.lg,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.secondary,
        marginTop: spacing.sm,
    },
    form: {
        gap: spacing.lg,
    },
    input: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        fontSize: 16,
        color: colors.text.primary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    button: {
        backgroundColor: colors.primary.DEFAULT,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.inverse,
    },
    error: {
        color: colors.error,
        fontSize: 14,
        textAlign: 'center',
    },
});
