import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions, ActivityIndicator, Linking } from 'react-native';
import { useColors, spacing, borderRadius, typography } from '@/theme';
import { extractVideoId } from '@/utils/youtube';
import { useVideoStore, useSettingsStore } from '@/stores';

// Lazy load WebView only on native platforms
const NativeWebView = Platform.OS !== 'web'
    ? require('react-native-webview').WebView
    : null;

interface ArticleContentProps {
    html: string;
}

const fontSizes = {
    small: { body: 15, h1: 26, h2: 22, h3: 19, lineHeight: 1.5 },
    medium: { body: 18, h1: 32, h2: 26, h3: 22, lineHeight: 1.65 },
    large: { body: 21, h1: 38, h2: 30, h3: 26, lineHeight: 1.75 },
};

export default function ArticleContent({ html }: ArticleContentProps) {
    const colors = useColors();
    const { settings } = useSettingsStore();
    const { playVideo } = useVideoStore();
    const { width } = useWindowDimensions();

    const fontSize = settings?.font_size || 'medium';
    const readerTheme = settings?.reader_theme || 'default';
    const customLineHeight = settings?.reader_line_height;
    const showImages = settings?.show_images ?? true;

    const sizes = fontSizes[fontSize];

    // Theme colors for the reader content
    let contentColors = {
        bg: colors.background.primary,
        text: colors.text.primary,
        secondary: colors.text.secondary,
        border: colors.border.DEFAULT,
    };

    if (readerTheme === 'sepia') {
        contentColors = {
            bg: colors.reader.sepia.background,
            text: colors.reader.sepia.text,
            secondary: colors.reader.sepia.text + 'aa',
            border: colors.reader.sepia.border,
        };
    } else if (readerTheme === 'paper') {
        contentColors = {
            bg: colors.reader.paper.background,
            text: colors.reader.paper.text,
            secondary: colors.reader.paper.text + 'aa',
            border: colors.reader.paper.border,
        };
    }

    const containerRef = useRef<HTMLDivElement>(null);

    // Use system font stack matching the app's default text rendering
    const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    // CSS for both web div and native webview
    const getBaseStyles = (prefix = '') => {
        const s = prefix ? `${prefix} ` : '';
        const bodySelector = prefix || 'body';

        return `
        ${bodySelector} {
            font-family: ${FONT_STACK} !important;
            font-size: ${sizes.body}px;
            line-height: ${customLineHeight || (sizes.lineHeight * 1.05)};
            color: ${contentColors.text} !important;
            background-color: ${contentColors.bg};
            margin: 0;
            padding: ${prefix ? '0' : '24px'};
            word-wrap: break-word;
            -webkit-font-smoothing: antialiased;
            letter-spacing: -0.011em;
            font-weight: 450;
        }

        /* Extremely aggressive override for ALL elements to prevent source styles from leaking */
        ${s}*, ${s}*::before, ${s}*::after {
            font-family: ${FONT_STACK} !important;
        }

        /* Force color and font for common text containers */
        ${s}p, ${s}span, ${s}div, ${s}li, ${s}section, ${s}article, ${s}main, ${s}header, ${s}footer {
            color: ${contentColors.text} !important;
            font-family: ${FONT_STACK} !important;
        }

        ${s}h1, ${s}h2, ${s}h3, ${s}h4 {
            font-family: ${FONT_STACK} !important;
            color: ${contentColors.text} !important;
            line-height: 1.2;
            margin-top: 2em;
            margin-bottom: 0.8em;
            letter-spacing: -0.025em;
            font-weight: 800;
        }
        ${s}h1 { font-size: ${sizes.h1}px; }
        ${s}h2 { font-size: ${sizes.h2}px; }
        ${s}h3 { font-size: ${sizes.h3}px; }
        
        ${s}p { margin-bottom: 1.6em; }
        
        ${s}a {
            color: ${colors.primary.DEFAULT} !important;
            text-decoration: underline !important;
            text-decoration-thickness: 1px !important;
            text-underline-offset: 4px !important;
            font-family: ${FONT_STACK} !important;
        }
        
        ${s}img {
            max-width: 100%;
            height: auto;
            border-radius: ${borderRadius.lg}px;
            margin: 3em auto;
            display: block;
            display: ${showImages ? 'block' : 'none'};
        }
        
        ${s}blockquote {
            margin: 3em 0;
            padding: 0.5em 0 0.5em 2em;
            border-left: 4px solid ${colors.primary.DEFAULT} !important;
            font-style: italic !important;
            color: ${contentColors.secondary} !important;
        }
        
        ${s}pre {
            background: ${colors.background.tertiary} !important;
            padding: 2em !important;
            border-radius: ${borderRadius.xl}px !important;
            overflow-x: auto !important;
            font-family: 'SF Mono', Monaco, monospace !important;
            font-size: 0.9em !important;
            line-height: 1.6 !important;
            margin: 2.5em 0 !important;
        }
        
        ${s}code {
            background: ${colors.background.tertiary} !important;
            padding: 0.25em 0.5em !important;
            border-radius: ${borderRadius.sm}px !important;
            font-family: 'SF Mono', Monaco, monospace !important;
        }

        ${s}table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 3em 0 !important;
        }
        ${s}th, ${s}td {
            text-align: left !important;
            padding: 16px !important;
            border-bottom: 1px solid ${contentColors.border} !important;
            font-family: ${FONT_STACK} !important;
        }

        /* Reddit-specific cleanup - simplified for Safari compatibility */
        /* Hide "Go to [subreddit]" navigation tables at the end of Reddit posts */
        ${s}table[bgcolor="#f5f5f5"] {
            display: none !important;
        }

        /* Hide standalone subreddit/username links that appear as only children */
        ${s}a[href*="reddit.com/r/"]:only-child,
        ${s}a[href*="reddit.com/user/"]:only-child {
            display: none !important;
        }

        /* Clean up truly empty elements */
        ${s}p:empty,
        ${s}div:empty {
            display: none !important;
        }
    `;
    };

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const container = containerRef.current;
        if (!container) return;

        const handlers = new Map<HTMLAnchorElement, (event: MouseEvent) => void>();
        const links = Array.from(container.querySelectorAll('a')) as HTMLAnchorElement[];

        links.forEach((link) => {
            const handler = (event: MouseEvent) => {
                const href = link.href;
                if (!href) return;

                const vid = extractVideoId(href);
                if (vid) {
                    event.preventDefault();
                    playVideo(vid);
                    return;
                }

                if (href.startsWith('http')) {
                    event.preventDefault();
                    window.open(href, '_blank', 'noopener,noreferrer');
                }
            };

            link.addEventListener('click', handler);
            handlers.set(link, handler);
        });

        return () => {
            handlers.forEach((handler, link) => {
                link.removeEventListener('click', handler);
            });
        };
    }, [html, settings, fontSize, readerTheme, customLineHeight, playVideo]);

    const renderWebContent = () => {
        // Show message if no content
        if (!html || html.trim() === '') {
            return (
                <View style={[componentStyles.container, componentStyles.emptyContainer]}>
                    <Text style={[componentStyles.emptyText, { color: colors.text.secondary }]}>
                        No content available for this article.
                    </Text>
                </View>
            );
        }

        return (
            <View style={componentStyles.container}>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    ${getBaseStyles('.zen-article')}
                    @media (max-width: 600px) {
                        .zen-article img {
                            width: auto;
                            max-width: 100%;
                        }
                    }
                ` }} />
                <div
                    ref={containerRef}
                    className="zen-article"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </View>
        );
    };

    const renderNativeContent = () => (
        <View style={componentStyles.container}>
            {NativeWebView ? (
                <NativeWebView
                    source={{
                        html: `
                        <!DOCTYPE html>
                        <html>
                            <head>
                                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                                <style>${getBaseStyles('')}</style>
                            </head>
                            <body>${html}</body>
                        </html>
                    ` }}
                    style={{ backgroundColor: contentColors.bg }}
                    scrollEnabled={false} // Container scroll handles it
                    onShouldStartLoadWithRequest={(request) => {
                        const url = request.url;
                        if (!url || url === 'about:blank' || url.startsWith('data:')) return true;

                        const vid = extractVideoId(url);
                        if (vid) {
                            playVideo(vid);
                            return false;
                        }

                        if (url.startsWith('http')) {
                            Linking.openURL(url).catch(() => { });
                        }
                        return false;
                    }}
                    onMessage={(event: any) => {
                        try {
                            const data = JSON.parse(event.nativeEvent.data);
                            if (data.type === 'video') playVideo(data.videoId);
                        } catch (e) { }
                    }}
                    injectedJavaScript={`
                        document.querySelectorAll('a').forEach(link => {
                            link.onclick = (e) => {
                                const match = link.href.match(/(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/)([a-zA-Z0-9_-]{11})/);
                                if (match) {
                                    e.preventDefault();
                                    window.ReactNativeWebView.postMessage(JSON.stringify({type:'video', videoId: match[1]}));
                                }
                            }
                        })
                    `}
                />
            ) : null}
        </View>
    );

    return Platform.OS === 'web' ? renderWebContent() : renderNativeContent();
}

const componentStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
        opacity: 0.7,
    }
});
