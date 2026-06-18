import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://crazywithtool.vercel.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Crazy With Tools",
  description: `Crazy With Tools is an all-in-one AI-powered platform for PDF editing, content creation, and productivity. Generate high-quality marketing content, edit PDFs, and manage documents effortlessly with Google Gemini AI integration.`,
  keywords: [
    "PDF editor",
    "AI content generator",
    "marketing content",
    "document editor",
    "AI writing tool",
  ],
  authors: [{ name: "Crazy With Tools Team" }],
  creator: "Crazy With Tools",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Crazy With Tools",
    title: "Crazy With Tools",
    description:
      "AI-powered PDF editing, content generation, and document management in one platform.",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Crazy With Tools - AI PDF Editor",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crazy With Tools",
    description: "AI-powered PDF editing and content generation.",
    creator: "@crazywithtools",
  },
  alternates: {
    canonical: SITE_URL,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Crazy With Tools",
  },
  formatDetection: {
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "YOUR_GOOGLE_VERIFICATION_CODE_HERE",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta
          name="theme-color"
          content="#ffffff"
          media="(prefers-color-scheme: light)"
        />
        <link rel="canonical" href={SITE_URL} />
        <meta name="theme-color" content="#09090b" />
       
      </head>
      <body className="min-h-screen bg-zinc-950 text-white">
        <Navbar />
        <main className="pt-[60px] min-h-screen lg:pt-[70px]">
          <div className="w-full max-w-7xl mx-auto px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8">
            {children}
          </div>
        </main>

        <footer className="py-4 md:py-6 text-center text-xs md:text-sm text-white/60">
          <div className="w-full max-w-7xl mx-auto px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 flex flex-col gap-2 md:gap-0 md:flex-row md:items-center md:justify-center">
            <a
              href="/privacy"
              className="underline hover:text-white/80 transition-colors mr-0 md:mr-4"
            >
              Privacy
            </a>
            <a
              href="/prolevel"
              className="mr-0 md:mr-4 hover:text-white/80 transition-colors"
            >
              Pro Level
            </a>
            <span>© {new Date().getFullYear()} Crazy With Tools</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
