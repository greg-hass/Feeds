import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

/**
 * Custom HTML root for the app.
 * Adds viewport-fit=cover to enable full-screen PWA display on iOS Safari.
 */
const OVERSCROLL_RESET = `
:root,
body {
    overscroll-behavior: none;
}

body {
    min-height: 100vh;
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="color-scheme" content="light dark" />
      <meta name="theme-color" content="#ffffff" />
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
