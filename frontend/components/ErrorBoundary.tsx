import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View style={styles.container}>
                    <ScrollView contentContainerStyle={styles.content}>
                        <AlertTriangle size={64} color="#ef4444" />
                        <Text style={styles.title}>Something went wrong</Text>
                        <Text style={styles.message}>
                            An unexpected error occurred. You may need to restart the application if this persists.
                        </Text>

                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
                        </View>

                        <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                            <RefreshCw size={20} color={colors.text.inverse} style={{ marginRight: 8 }} />
                            <Text style={styles.buttonText}>Try to Recover</Text>
                        </TouchableOpacity>

                        <Text style={styles.footer}>
                            If you're in development, check the console for more details.
                        </Text>
                    </ScrollView>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f0f',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        padding: 40,
        justifyContent: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: '#f5f5f5',
        marginTop: 20,
        marginBottom: 10,
    },
    message: {
        fontSize: 16,
        color: '#a3a3a3',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 24,
    },
    errorBox: {
        backgroundColor: '#1a1a1a',
        padding: 16,
        borderRadius: 12,
        width: '100%',
        marginBottom: 30,
        borderWidth: 1,
        borderColor: '#3f3f3f',
    },
    errorText: {
        color: '#ef4444',
        fontFamily: 'monospace',
        fontSize: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10b981',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 99,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 16,
    },
    footer: {
        marginTop: 40,
        fontSize: 12,
        color: '#737373',
    }
});
