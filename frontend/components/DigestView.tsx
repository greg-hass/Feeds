import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, useColorScheme } from 'react-native';
import { useDigestStore } from '@/stores';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { format } from 'date-fns';

export const DigestView = () => {
    const { latestDigest, isLoading, error, fetchLatestDigest, generateDigest } = useDigestStore();
    const isDark = useColorScheme() === 'dark';

    useEffect(() => {
        fetchLatestDigest();
    }, []);

    if (isLoading && !latestDigest) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={[styles.loadingText, isDark && styles.darkText]}>Generating your digest...</Text>
            </View>
        );
    }

    if (error && !latestDigest) {
        return (
            <View style={styles.center}>
                <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
                <Text style={[styles.errorText, isDark && styles.darkText]}>{error}</Text>
                <TouchableOpacity style={styles.button} onPress={generateDigest}>
                    <Text style={styles.buttonText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!latestDigest) {
        return (
            <View style={styles.center}>
                <Ionicons name="book-outline" size={64} color="#8E8E93" />
                <Text style={[styles.emptyText, isDark && styles.darkText]}>No digest available yet.</Text>
                <TouchableOpacity style={styles.button} onPress={generateDigest}>
                    <Text style={styles.buttonText}>Generate My First Digest</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, isDark && styles.darkText]}>Daily Digest</Text>
                    <Text style={styles.date}>
                        {format(new Date(latestDigest.generated_at), 'MMMM do, yyyy • h:mm a')}
                    </Text>
                </View>
                <TouchableOpacity onPress={generateDigest} disabled={isLoading}>
                    <Ionicons name="refresh" size={24} color="#007AFF" style={isLoading && { opacity: 0.5 }} />
                </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
                <View style={styles.stat}>
                    <Text style={styles.statValue}>{latestDigest.article_count}</Text>
                    <Text style={styles.statLabel}>Articles</Text>
                </View>
                <View style={[styles.stat, styles.statDivider]}>
                    <Text style={styles.statValue}>{latestDigest.feed_count}</Text>
                    <Text style={styles.statLabel}>Sources</Text>
                </View>
                <View style={styles.stat}>
                    <Ionicons name="sparkles" size={16} color="#FFCC00" />
                    <Text style={styles.statLabel}>AI Powered</Text>
                </View>
            </View>

            <View style={[styles.card, isDark && styles.darkCard]}>
                <Markdown
                    style={{
                        body: { color: isDark ? '#FFFFFF' : '#000000', fontSize: 16, lineHeight: 24 },
                        heading2: { color: isDark ? '#FFFFFF' : '#000000', marginTop: 20, marginBottom: 10 },
                        bullet_list: { marginBottom: 10 },
                        link: { color: '#007AFF' }
                    }}
                >
                    {latestDigest.content}
                </Markdown>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#000000',
    },
    date: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 4,
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,122,255,0.1)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 20,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statDivider: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: 'rgba(0,122,255,0.2)',
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    statLabel: {
        fontSize: 12,
        color: '#007AFF',
        marginTop: 2,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    darkCard: {
        backgroundColor: '#1C1C1E',
    },
    darkText: {
        color: '#FFFFFF',
    },
    loadingText: {
        marginTop: 12,
        color: '#8E8E93',
    },
    errorText: {
        marginTop: 12,
        color: '#FF3B30',
        textAlign: 'center',
        marginBottom: 20,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 18,
        color: '#8E8E93',
        marginBottom: 20,
    },
    button: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
