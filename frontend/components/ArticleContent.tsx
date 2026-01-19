import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useColors, spacing, borderRadius } from '@/theme';
import { extractVideoId, getEmbedUrl } from '@/utils/youtube';
import { VideoModal } from './VideoModal';

// Lazy load WebView only on native platforms
const NativeWebView = Platform.OS !== 'web'
    ? require('react-native-webview').WebView
    : null;

interface ArticleContentProps {
    html: string;
    fontSize?: 'small' | 'medium' | 'large';
}

const fontSizes = {
    small: { body: 14, h1: 24, h2: 20, h3: 18, lineHeight: 1.5 },
    medium: { body: 16, h1: 28, h2: 24, h3: 20, lineHeight: 1.6 },
    large: { body: 18, h1: 32, h2: 28, h3: 24, lineHeight: 1.7 },
};

export default function ArticleContent({ html, fontSize = 'medium' }: ArticleContentProps) {
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const sizes = fontSizes[fontSize];
    const [modalVideoId, setModalVideoId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isWebViewReady, setIsWebViewReady] = useState(Platform.OS !== 'web');

    // Generate styled HTML with inline CSS for WebView
    const getStyledHtml = (content: string) => {
        const css = `
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    font-size: ${sizes.body}px;
                    line-height: ${sizes.lineHeight};
                    color: ${colors.text.primary};
                    margin: 0;
                    padding: 16px;
                    word-wrap: break-word;
                }
                h1 {
                    font-size: ${sizes.h1}px;
                    font-weight: 700;
                    margin: 1.5em 0 0.5em 0;
                    line-height: 1.2;
                    color: ${colors.text.primary};
                }
                h2 {
                    font-size: ${sizes.h2}px;
                    font-weight: 600;
                    margin: 1.3em 0 0.5em 0;
                    line-height: 1.25;
                    color: ${colors.text.primary};
                }
                h3, h4, h5, h6 {
                    font-size: ${sizes.h3}px;
                    font-weight: 600;
                    margin: 1.2em 0 0.4em 0;
                    line-height: 1.3;
                    color: ${colors.text.primary};
                }
                a {
                    color: ${colors.primary.DEFAULT};
                    text-decoration: underline;
                }
                p {
                    margin: 0 0 1em 0;
                }
                img {
                    max-width: 100%;
                    height: auto;
                    border-radius: ${borderRadius.md}px;
                    margin: 1em 0;
                }
                blockquote {
                    margin: 1em 0;
                    padding: 0.5em 0 0.5em 1em;
                    border-left: 4px solid ${colors.primary.DEFAULT};
                    background: ${colors.background.secondary};
                    border-radius: 0 ${borderRadius.sm}px ${borderRadius.sm}px 0;
                    font-style: italic;
                    color: ${colors.text.secondary};
                }
                blockquote p {
                    margin: 0;
                }
                ul, ol {
                    margin: 1em 0;
                    padding-left: 1.5em;
                }
                li {
                    margin: 0.3em 0;
                }
                pre {
                    background: ${colors.background.tertiary};
                    padding: 1em;
                    border-radius: ${borderRadius.md}px;
                    overflow-x: auto;
                    font-family: monospace;
                    font-size: 0.9em;
                    margin: 1em 0;
                }
                code {
                    background: ${colors.background.tertiary};
                    padding: 0.2em 0.4em;
                    border-radius: ${borderRadius.sm}px;
                    font-family: monospace;
                    font-size: 0.9em;
                }
                hr {
                    border: none;
                    border-top: 1px solid ${colors.border.DEFAULT};
                    margin: 2em 0;
                }
                iframe {
                    max-width: 100%;
                    aspect-ratio: 16/9;
                    border-radius: ${borderRadius.md}px;
                    margin: 1em 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 1em 0;
                }
                th, td {
                    border: 1px solid ${colors.border.DEFAULT};
                    padding: 0.5em;
                    text-align: left;
                }
                th {
                    background: ${colors.background.secondary};
                    font-weight: 600;
                }
            </style>
            ${content}
        `;
        return css;
    };

    // For web platform
    if (Platform.OS === 'web') {
        const [hasProcessedLinks, setHasProcessedLinks] = useState(false);

        useEffect(() => {
            if (!containerRef.current) return;

            const links = containerRef.current.querySelectorAll('a');
            links.forEach(link => {
                const videoId = extractVideoId(link.href);
                if (videoId) {
                    const handleClick = (e: MouseEvent) => {
                        e.preventDefault();
                        setModalVideoId(videoId);
                    };
                    link.addEventListener('click', handleClick as EventListener);
                }
            });
            setHasProcessedLinks(true);
        }, [html]);

        const styles = `
            .article-content {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: ${sizes.body}px;
                line-height: ${sizes.lineHeight};
                color: ${colors.text.primary};
                word-wrap: break-word;
                overflow-wrap: break-word;
            }

            .article-content p {
                margin: 0 0 1em 0;
            }

            .article-content h1 {
                font-size: ${sizes.h1}px;
                font-weight: 700;
                margin: 1.5em 0 0.5em 0;
                line-height: 1.2;
                color: ${colors.text.primary};
            }

            .article-content h2 {
                font-size: ${sizes.h2}px;
                font-weight: 600;
                margin: 1.3em 0 0.5em 0;
                line-height: 1.25;
                color: ${colors.text.primary};
            }

            .article-content h3, .article-content h4, .article-content h5, .article-content h6 {
                font-size: ${sizes.h3}px;
                font-weight: 600;
                margin: 1.2em 0 0.4em 0;
                line-height: 1.3;
                color: ${colors.text.primary};
            }

            .article-content a {
                color: ${colors.primary.DEFAULT};
                text-decoration: underline;
                text-decoration-color: ${colors.primary.light};
            }

            .article-content a:hover {
                text-decoration-color: ${colors.primary.DEFAULT};
            }

            .article-content img {
                max-width: 100%;
                height: auto;
                border-radius: ${borderRadius.md}px;
                margin: 1em 0;
                display: block;
            }

            .article-content blockquote {
                margin: 1em 0;
                padding: 0.5em 0 0.5em 1em;
                border-left: 4px solid ${colors.primary.DEFAULT};
                background: ${colors.background.secondary};
                border-radius: 0 ${borderRadius.sm}px ${borderRadius.sm}px 0;
                font-style: italic;
                color: ${colors.text.secondary};
            }

            .article-content blockquote p {
                margin: 0;
            }

            .article-content ul, .article-content ol {
                margin: 1em 0;
                padding-left: 1.5em;
            }

            .article-content li {
                margin: 0.3em 0;
            }

            .article-content pre {
                background: ${colors.background.tertiary};
                padding: 1em;
                border-radius: ${borderRadius.md}px;
                overflow-x: auto;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
                font-size: 0.9em;
                margin: 1em 0;
            }

            .article-content code {
                background: ${colors.background.tertiary};
                padding: 0.2em 0.4em;
                border-radius: ${borderRadius.sm}px;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
                font-size: 0.9em;
            }

            .article-content pre code {
                background: transparent;
                padding: 0;
            }

            .article-content figure {
                margin: 1.5em 0;
            }

            .article-content figcaption {
                text-align: center;
                font-size: 0.85em;
                color: ${colors.text.tertiary};
                margin-top: 0.5em;
            }

            .article-content hr {
                border: none;
                border-top: 1px solid ${colors.border.DEFAULT};
                margin: 2em 0;
            }

            .article-content table {
                width: 100%;
                border-collapse: collapse;
                margin: 1em 0;
            }

            .article-content th, .article-content td {
                border: 1px solid ${colors.border.DEFAULT};
                padding: 0.5em;
                text-align: left;
            }

            .article-content th {
                background: ${colors.background.secondary};
                font-weight: 600;
            }

            /* YouTube/Video embeds */
            .article-content iframe {
                max-width: 100%;
                border-radius: ${borderRadius.md}px;
                margin: 1em 0;
            }

            /* Responsive images */
            @media (max-width: 600px) {
                .article-content img {
                    margin-left: -${spacing.lg}px;
                    margin-right: -${spacing.lg}px;
                    max-width: calc(100% + ${spacing.lg * 2}px);
                    border-radius: 0;
                }
            }
        `;

        return (
            <View style={componentStyles.container}>
                <style dangerouslySetInnerHTML={{ __html: styles }} />
                <div
                    ref={containerRef}
                    className="article-content"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
                <VideoModal
                    videoId={modalVideoId}
                    visible={!!modalVideoId}
                    onClose={() => setModalVideoId(null)}
                />
            </View>
        );
    }

    // For native platforms - use WebView
    const handleWebViewMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'video') {
                setModalVideoId(data.videoId);
            }
        } catch (e) {
            // Ignore non-JSON messages
        }
    };

    const injectedJavaScript = `
        (function() {
            // Convert YouTube links to video modals
            const links = document.querySelectorAll('a');
            links.forEach(link => {
                link.addEventListener('click', function(e) {
                    const match = this.href?.match(/(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/)([a-zA-Z0-9_-]{11})/);
                    if (match) {
                        e.preventDefault();
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'video',
                            videoId: match[1]
                        }));
                    }
                });
            });
        })();
    `;

    return (
        <View style={componentStyles.container}>
            {NativeWebView ? (
                <NativeWebView
                    source={{ html: getStyledHtml(html) }}
                    style={componentStyles.webView}
                    originWhitelist={['*']}
                    javaScriptEnabled={true}
                    domStorageEnabled={false}
                    startInLoadingState={true}
                    onLoad={() => setIsWebViewReady(false)}
                    onMessage={handleWebViewMessage}
                    injectedJavaScript={injectedJavaScript}
                    renderLoading={() => (
                        <View style={componentStyles.loadingContainer}>
                            <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                        </View>
                    )}
                    scalesPageToFit={false}
                    scrollEnabled={true}
                    nestedScrollEnabled={true}
                />
            ) : null}
            <VideoModal
                videoId={modalVideoId}
                visible={!!modalVideoId}
                onClose={() => setModalVideoId(null)}
            />
        </View>
    );
}

const componentStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    webView: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    loadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
});
