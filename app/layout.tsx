import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'

// Same official event logo used as the link-preview image on the public
// aibp.sg event page (aibp.sg/conference-exhibition-thailand) — reused here
// so a link to this report shows the Thailand C&E logo when shared in
// Slack/WhatsApp/LinkedIn/etc, instead of a blank/generic preview.
const OG_IMAGE_URL =
  'https://static1.squarespace.com/static/6316ec4bc3127239ee7b0786/t/6a3116152df28c276bfc3a32/1783907067604/AIBP+Conference+%26+Exhibition+Logos+-+Thailand.png?format=1500w'

export const metadata: Metadata = {
  title: 'AIBP C&E Thailand 2026 — Post-Event Report',
  description: 'Post-event report for AIBP Conference & Exhibition Thailand 2026',
  openGraph: {
    title: 'AIBP C&E Thailand 2026 — Post-Event Report',
    description: 'Post-event report for AIBP Conference & Exhibition Thailand 2026',
    url: 'https://th.aibp.sg',
    siteName: 'AIBP',
    images: [{ url: OG_IMAGE_URL, width: 1500, height: 712 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AIBP C&E Thailand 2026 — Post-Event Report',
    description: 'Post-event report for AIBP Conference & Exhibition Thailand 2026',
    images: [OG_IMAGE_URL],
  },
  // Unlisted/unlinked distribution (shared directly via URL) — keep the whole
  // site out of search engines. (Doesn't affect link-preview cards above —
  // those are read directly by the sharing platform, not via search index.)
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export const viewport: Viewport = {
  themeColor: '#834924',
  width: 'device-width',
  initialScale: 1,
}

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        {/*
          GA4 — shared "AIBP Apps" property across all our apps, set via env
          var so other projects can reuse the same measurement ID without
          hardcoding it. Loads after the page is interactive so it never
          blocks/delays render; auto-picks up UTM params on the landing URL.
        */}
        {GA_MEASUREMENT_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
        {/*
          Marks every same-origin /api/* request made by this app's own JS with a
          fixed header, so middleware.ts can tell "the app calling itself" apart
          from direct/public hits (typing the URL, curl, a shared link) without
          depending on browser-specific security headers. Runs before hydration,
          before any component has a chance to fetch.
        */}
        <Script id="api-header-patch" strategy="beforeInteractive">
          {`
            (function () {
              var TOKEN = 'ceth26-app-v1';
              function isOwnApi(url) {
                try {
                  var u = new URL(url, location.origin);
                  return u.origin === location.origin && u.pathname.indexOf('/api/') === 0;
                } catch (e) {
                  return false;
                }
              }
              var orig = window.fetch;
              window.fetch = function (input, init) {
                try {
                  var url = typeof input === 'string' ? input : (input && input.url) || '';
                  if (isOwnApi(url)) {
                    init = init || {};
                    var headers = new Headers(init.headers || {});
                    headers.set('x-ceid26-app', TOKEN);
                    init.headers = headers;
                  }
                } catch (e) {}
                return orig.call(this, input, init);
              };
            })();
          `}
        </Script>
      </head>
      <body className="h-full font-sans antialiased bg-gray-50">
        {children}
      </body>
    </html>
  )
}
