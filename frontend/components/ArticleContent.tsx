import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';
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
    const fontFamily = settings?.font_family || 'sans';
    const readerTheme = settings?.reader_theme || 'default';
    const customLineHeight = settings?.reader_line_height;
    const showImages = settings?.show_images ?? true;

    const sizes = fontSizes[fontSize];
    const fontStack = typography[fontFamily].family;

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

    // CSS for both web div and native webview
    const getBaseStyles = (isNative = false) => `
        body {
            font-family: ${fontStack};
            font-size: ${sizes.body}px;
            line-height: ${customLineHeight || (sizes.lineHeight * 1.05)};
            color: ${contentColors.text} !important;
            background-color: ${contentColors.bg};
            margin: 0;
            padding: ${isNative ? '24px' : '0'};
            word-wrap: break-word;
            -webkit-font-smoothing: antialiased;
            letter-spacing: -0.011em;
            font-weight: 450;
        }
        /* Force color inheritance for common text containers to override inline styles */
        p, span, div, li {
            color: ${contentColors.text} !important;
        }
        h1, h2, h3, h4 {
            font-family: ${fontStack};
            color: ${contentColors.text};
            line-height: 1.2;
            margin-top: 2em;
            margin-bottom: 0.8em;
            letter-spacing: -0.025em;
            font-weight: 800;
        }
        h1 { font-size: ${sizes.h1}px; }
        h2 { font-size: ${sizes.h2}px; }
        h3 { font-size: ${sizes.h3}px; }
        
        p { margin-bottom: 1.6em; }
        
        a {
            color: ${colors.primary.DEFAULT};
            text-decoration: underline;
            text-decoration-thickness: 1px;
            text-underline-offset: 4px;
        }
        
        img {
            max-width: 100%;
            height: auto;
            border-radius: ${borderRadius.lg}px;
            margin: 3em auto;
            display: block;
            display: ${showImages ? 'block' : 'none'};
        }
        
        blockquote {
            margin: 3em 0;
            padding: 0.5em 0 0.5em 2em;
            border-left: 4px solid ${colors.primary.DEFAULT};
            font-style: italic;
            color: ${contentColors.secondary};
        }
        
        pre {
            background: ${colors.background.tertiary};
            padding: 2em;
            border-radius: ${borderRadius.xl}px;
            overflow-x: auto;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 0.9em;
            line-height: 1.6;
            margin: 2.5em 0;
        }
        
        code {
            background: ${colors.background.tertiary};
            padding: 0.25em 0.5em;
            border-radius: ${borderRadius.sm}px;
            font-family: 'SF Mono', Monaco, monospace;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 3em 0;
        }
        th, td {
            text-align: left;
            padding: 16px;
            border-bottom: 1px solid ${contentColors.border};
        }
    `;

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!containerRef.current) return;
        const links = containerRef.current.querySelectorAll('a');
        links.forEach(link => {
            const vid = extractVideoId((link as HTMLAnchorElement).href);
            if (vid) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    playVideo(vid);
                });
            }
        });
    }, [html, settings, fontSize, fontFamily, readerTheme, customLineHeight]);

    const renderWebContent = () => (
        <View style={componentStyles.container}>
            <style dangerouslySetInnerHTML={{
                __html: `
                .zen-article { ${getBaseStyles()} }
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
                                <style>${getBaseStyles(true)}</style>
                            </head>
                            <body>${html}</body>
                        </html>
                    ` }}
                    style={{ backgroundColor: contentColors.bg }}
                    scrollEnabled={false} // Container scroll handles it
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
    }
});
