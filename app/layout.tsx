import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

import "./globals.css";

import { site, siteUrl } from "@/config/site";
import { fontVariables } from "@/lib/fonts";
import {
  buildTextRevealBootScript,
  buildTextRevealCss,
  buildTextRevealNoscriptCss,
} from "@/lib/textRevealCss";
import { Providers } from "@/components/providers/Providers";
import { ScrollTriggerRefresher } from "@/components/motion/ScrollTriggerRefresher";
import { SkipLink } from "@/components/shell/SkipLink";
import { TextRevealGlobal } from "@/components/TextRevealGlobal";

const revealCss = buildTextRevealCss();
const revealNoscriptCss = buildTextRevealNoscriptCss();
const revealBoot = buildTextRevealBootScript();

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: `${site.brand.name} — ${site.brand.tagline}`,
    template: `%s · ${site.brand.name}`,
  },
  description: site.brand.description,
  applicationName: site.brand.name,
  // OEM codes and order numbers must never be auto-linked as phone numbers.
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    siteName: site.brand.name,
    locale: "sr_RS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: site.themeColor,
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // CSP nonce from proxy.ts (security step); undefined until then.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // Convex Auth reads the session cookies here and hands the token to the client provider.
    <ConvexAuthNextjsServerProvider>
      {/* The boot script adds `tr-js` to <html> before hydration — hence suppressHydrationWarning. */}
      <html lang={site.locale} className={fontVariables} suppressHydrationWarning>
        <head>
          <style
            id="text-reveal-css"
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: revealCss }}
          />
          <script
            id="text-reveal-boot"
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: revealBoot }}
          />
          <noscript dangerouslySetInnerHTML={{ __html: `<style>${revealNoscriptCss}</style>` }} />
        </head>
        <body>
          <SkipLink />
          <Providers>{children}</Providers>
          <TextRevealGlobal />
          <ScrollTriggerRefresher />
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
