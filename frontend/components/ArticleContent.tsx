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
    article?: {
        title: string;
        author?: string | null;
        feed_title?: string;
        published_at?: string | null;
        thumbnail_url?: string | null;
        feed_icon_url?: string | null;
        site_name?: string | null;
        hero_image?: string | null | undefined;
    };
}

const fontSizes = {
    small: { body: 14, h1: 24, h2: 20, h3: 18, lineHeight: 1.5 },
    medium: { body: 16, h1: 28, h2: 24, h3: 20, lineHeight: 1.6 },
    large: { body: 18, h1: 32, h2: 28, h3: 24, lineHeight: 1.7 },
};

export default function ArticleContent({ html, fontSize = 'medium', article }: ArticleContentProps) {
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
                    padding: 0;
                    word-wrap: break-word;
                }
                .hero {
                    position: relative;
                    width: 100%;
                    height: 300px;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 2em;
                }
                .hero-bg {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-image: url('${article?.feed_icon_url || article?.hero_image || article?.thumbnail_url || undefined}');
                    background-size: cover;
                    background-position: center;
                    filter: blur(80px) brightness(0.8);
                    transform: scale(1.5);
                }
                .hero-badge {
                    position: relative;
                    width: 200px;
                    height: 200px;
                    border-radius: ${borderRadius.lg}px;
                    overflow: hidden;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                    border: 1px solid rgba(255,255,255,0.2);
                }
                .hero-badge img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    margin: 0;
                }
                .article-body {
                    padding: 0 24px 48px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 {
                    font-size: ${sizes.h1}px;
                    font-weight: 800;
                    margin: 0 0 0.5em 0;
                    line-height: 1.1;
                    color: ${colors.text.primary};
                    letter-spacing: -0.02em;
                }
                .article-meta {
                    font-size: 14px;
                    color: ${colors.text.tertiary};
                    margin-bottom: 2em;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 500;
                }
                .feed-icon {
                    width: 16px;
                    height: 16px;
                    border-radius: 4px;
                }
                a {
                    color: ${colors.primary.DEFAULT};
                    text-decoration: underline;
                    text-decoration-thickness: 2px;
                    text-underline-offset: 4px;
                }
                p {
                    margin: 0 0 1.5em 0;
                }
                img {
                    max-width: 100%;
                    height: auto;
                    border-radius: ${borderRadius.md}px;
                    margin: 2em 0;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                blockquote {
                    margin: 2em 0;
                    padding: 1em 0 1em 1.5em;
                    border-left: 4px solid ${colors.primary.DEFAULT};
                    background: ${colors.background.secondary};
                    border-radius: 0 ${borderRadius.md}px ${borderRadius.md}px 0;
                    font-style: italic;
                    color: ${colors.text.secondary};
                    font-size: 1.1em;
                }
                blockquote p {
                    margin: 0;
                }
                hr {
                    border: none;
                    border-top: 1px solid ${colors.border.DEFAULT};
                    margin: 3em 0;
                }
            </style>
            <div class="reader-view">
                ${(article?.hero_image || article?.thumbnail_url) ? `
                <div class="hero">
                    <div class="hero-bg"></div>
                    <div class="hero-badge">
                        <img src="${article.hero_image || article.thumbnail_url}" alt="" />
                    </div>
                </div>
                ` : ''}
                <div class="article-body">
                    <h1>${article?.title || ''}</h1>
                    <div class="article-meta">
                        ${article?.feed_icon_url ? `<img src="${article.feed_icon_url}" class="feed-icon" />` : ''}
                        <span>${article?.site_name || article?.feed_title || ''}</span>
                        ${article?.author ? `<span>• ${article.author}</span>` : ''}
                    </div>
                    ${content}
                </div>
            </div>
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
                padding-bottom: 100px;
            }

            .hero {
                position: relative;
                width: 100%;
                height: 400px;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 3em;
            }

            .hero-bg {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-image: url('${article?.feed_icon_url || article?.hero_image || article?.thumbnail_url}');
                background-size: cover;
                background-position: center;
                filter: blur(100px) brightness(0.8);
                transform: scale(1.5);
            }

            .hero-badge {
                position: relative;
                width: 250px;
                height: 250px;
                border-radius: ${borderRadius.lg}px;
                overflow: hidden;
                box-shadow: 0 30px 60px rgba(0,0,0,0.5);
                border: 1px solid rgba(255,255,255,0.2);
                transition: transform 0.3s ease;
            }

            .hero-badge:hover {
                transform: scale(1.02);
            }

            .hero-badge img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                margin: 0;
            }

            .body-container {
                max-width: 800px;
                margin: 0 auto;
                padding: 0 40px;
            }

            .article-content h1 {
                font-size: ${sizes.h1 * 1.5}px;
                font-weight: 800;
                margin: 0 0 0.4em 0;
                line-height: 1.1;
                color: ${colors.text.primary};
                letter-spacing: -0.03em;
            }

            .article-meta {
                font-size: 15px;
                color: ${colors.text.tertiary};
                margin-bottom: 3em;
                display: flex;
                align-items: center;
                gap: 10px;
                font-weight: 500;
            }

            .feed-icon {
                width: 20px;
                height: 20px;
                border-radius: 5px;
            }

            .article-content p {
                margin: 0 0 1.5em 0;
            }

            .article-content img {
                max-width: 100%;
                height: auto;
                border-radius: ${borderRadius.lg}px;
                margin: 2.5em 0;
                display: block;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }

            .article-content blockquote {
                margin: 2.5em 0;
                padding: 1.5em 0 1.5em 2em;
                border-left: 5px solid ${colors.primary.DEFAULT};
                background: ${colors.background.secondary};
                border-radius: 0 ${borderRadius.md}px ${borderRadius.md}px 0;
                font-style: italic;
                color: ${colors.text.secondary};
                font-size: 1.15em;
                line-height: 1.6;
            }

            .article-content pre {
                background: ${colors.background.tertiary};
                padding: 1.5em;
                border-radius: ${borderRadius.lg}px;
                overflow-x: auto;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
                font-size: 0.95em;
                margin: 2em 0;
                border: 1px solid ${colors.border.DEFAULT};
            }

            .article-content hr {
                border: none;
                border-top: 2px solid ${colors.border.DEFAULT};
                margin: 4em 0;
                width: 50%;
                margin-left: auto;
                margin-right: auto;
            }
        `;

        return (
            <View style={componentStyles.container}>
                <style dangerouslySetInnerHTML={{ __html: styles }} />
                <div ref={containerRef} className="article-content">
                    {(article?.hero_image || article?.thumbnail_url) && (
                        <div className="hero">
                            <div className="hero-bg"></div>
                            <div className="hero-badge">
                                <img src={article.hero_image || article.thumbnail_url} alt="" />
                            </div>
                        </div>
                    )}
                    <div className="body-container">
                        <h1>{article?.title}</h1>
                        <div className="article-meta">
                            {article?.feed_icon_url && <img src={article.feed_icon_url} className="feed-icon" />}
                            <span>{article?.site_name || article?.feed_title}</span>
                            {article?.author && <span>• {article.author}</span>}
                        </div>
                        <div dangerouslySetInnerHTML={{ __html: html }} />
                    </div>
                </div>
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
