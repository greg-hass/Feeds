import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

/**
 * Custom HTML root for the app.
 * Adds viewport-fit=cover to enable full-screen PWA display on iOS Safari.
 */
const OVERSCROLL_RESET = `
html,
:root,
body {
    overscroll-behavior: none;
    width: 100%;
    height: 100%;
    min-height: 100%;
    margin: 0;
    padding: 0;
    background: #0d0d0d;
}

body {
    display: flex;
    min-height: 100vh;
    min-height: 100svh;
}

body > div:first-child,
body > div:first-child > div,
body > div:first-child > div > div {
    flex: 1 1 auto;
    width: 100%;
    height: 100%;
    min-height: 100vh;
    min-height: 100svh;
    background: #081014;
}

*:focus-visible {
    outline: 2px solid #0ea5a4;
    outline-offset: 2px;
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="color-scheme" content="light dark" />
      <meta name="theme-color" content="#0d0d0d" />
      {/* Critical: viewport-fit=cover enables edge-to-edge display on iOS Safari PWA */}
      <meta
        name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* iOS PWA icons and naming */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="Feeds" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        <style>{OVERSCROLL_RESET}</style>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
