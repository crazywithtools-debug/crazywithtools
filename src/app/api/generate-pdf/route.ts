import { NextResponse } from 'next/server';

// Avoid Next's global fetch typing issues with Node Buffers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any;

// Ensure this API runs on the Node runtime (required for puppeteer-core)
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const html: string = String(body?.html || '');
    const title: string = String(body?.title || 'download');

    let browser: any = null;
    // Playwright fallback browser instance (if puppeteer/@sparticuz cannot resolve chromium)
    let pwBrowser: any = null;
    let usedPlaywright = false;

    // Use @sparticuz/chromium + puppeteer-core; ensure executablePath (or a local binary) is provided.
    try {
      // @ts-ignore - dynamic import
      const chromium: any = await import('@sparticuz/chromium');
      // @ts-ignore - dynamic import
      const puppeteerCore: any = await import('puppeteer-core');

      // Resolve executablePath (may be function or direct value)
      let executablePath: string | undefined;
      try {
        if (typeof chromium.executablePath === 'function') executablePath = await chromium.executablePath();
        else executablePath = chromium.executablePath;
      } catch (e) {
        executablePath = undefined;
      }

      const baseArgs = Array.isArray(chromium.args) && chromium.args.length > 0 ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'];
      // Vercel/Serverless stability: avoid shared memory issues and improve font rendering.
      const args = Array.from(
        new Set([
          ...baseArgs,
          '--disable-dev-shm-usage',
          '--font-render-hinting=none',
          '--disable-gpu',
          '--no-zygote',
        ]),
      );


      // If chromium didn't provide an executable path, try common env vars and common FS paths.
      if (!executablePath) {

        const envCandidates = [
          process.env.CHROME_PATH,
          process.env.PUPPETEER_EXECUTABLE_PATH,
          process.env.CHROME_BIN,
          process.env.GOOGLE_CHROME_BIN,
        ].filter(Boolean) as string[];
        // simple fs check for common locations
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const fs = require('fs');
          const commonPaths = [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          ];
          for (const p of envCandidates.concat(commonPaths)) {
            try {
              if (p && fs.existsSync(p)) {
                executablePath = p;
                break;
              }
            } catch (e) {
              // ignore
            }
          }
        } catch (e) {
          // fs not available? ignore
        }
      }

      const launchOptions: any = {
        args,
        headless: typeof chromium.headless === 'boolean' ? chromium.headless : true,
        defaultViewport: chromium.defaultViewport || { width: 1240, height: 720 },
        ignoreHTTPSErrors: true,
      };


      // If we have an executablePath, prefer puppeteer-core + @sparticuz/chromium.
      if (executablePath) {
        launchOptions.executablePath = executablePath;
        // eslint-disable-next-line no-console
        console.log('[generate-pdf] launchOptions=', {
          headless: launchOptions.headless,
          executablePath: launchOptions.executablePath ? String(launchOptions.executablePath) : null,
          args: launchOptions.args,
        });
        browser = await puppeteerCore.launch(launchOptions);
      } else {
        // Try Playwright fallback (Playwright usually provides its own Chromium binary).
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
          const pw = await import('playwright');
          const pwChromium = (pw as any).chromium;
          // eslint-disable-next-line no-console
          console.log('[generate-pdf] no chromium executablePath from @sparticuz/chromium; attempting Playwright fallback');
          pwBrowser = await pwChromium.launch({ headless: true, args });
          usedPlaywright = true;
        } catch (pwErr: any) {
          const body = {
            error: 'Headless browser not available. @sparticuz/chromium did not resolve an executablePath and Playwright fallback failed.',
            detail: String((pwErr as any)?.message || pwErr || ''),
          };
          // eslint-disable-next-line no-console
          console.error('No chromium executablePath found and Playwright fallback failed; aborting PDF generation.', pwErr);
          return NextResponse.json(body, { status: 500 });
        }
      }
    } catch (err: any) {

      // eslint-disable-next-line no-console
      console.error('Failed to launch puppeteer-core with @sparticuz/chromium:', err?.message || err);
      const body = {
        error: 'Headless browser not available. Ensure @sparticuz/chromium and puppeteer-core are installed and the chromium executablePath resolves.',
        detail: String(err?.message || err || ''),
      };
      return NextResponse.json(body, { status: 500 });
    }

    // Create a page from the chosen browser (puppeteer-core or Playwright)
    let page: any = null;
    if (browser && typeof browser.newPage === 'function') {
      page = await browser.newPage();
    } else if (pwBrowser && typeof pwBrowser.newPage === 'function') {
      page = await pwBrowser.newPage();
    } else {
      // eslint-disable-next-line no-console
      console.error('generate-pdf: no browser instance available to create a page');
      return NextResponse.json({ error: 'No browser available for PDF generation' }, { status: 500 });
    }
    // If caller requested optimized PDF, reduce background printing and scale
    const optimize = Boolean((body && (body as any).optimize) || false);

    // When optimizing for size, strip the heavy background layer if present
    let htmlToRender = html;

    // Ensure browser is closed even if PDF generation fails
    let pdfBuffer: Buffer | null = null;
    try {
      if (optimize) {
      try {
        // remove any pdf-bg-layer divs to avoid embedding large images
        htmlToRender = htmlToRender.replace(/<div[^>]+class=["']?pdf-bg-layer["']?[^>]*>.*?<\/div>/gis, '');
      } catch (e) {
        // ignore regex errors
      }

      // Attempt to compress any embedded data-URI images to reduce output size.
      try {
        let sharpModule: any = null;
        try {
          // dynamic import so bundler doesn't require sharp at build time
          // @ts-ignore
          const imported = await import('sharp');
          sharpModule = imported && (imported.default || imported);
        } catch (e) {
          sharpModule = null;
        }

        if (sharpModule) {
          // 1) compress embedded data:image/*;base64,... strings and convert to optimized JPEG
          const dataUriRegex = /(data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+))/gi;
          const matches: Array<{ orig: string; format: string; b64: string }> = [];
          let m: RegExpExecArray | null;
          while ((m = dataUriRegex.exec(htmlToRender)) !== null) {
            matches.push({ orig: m[1], format: m[2], b64: m[3] });
          }
          if (matches.length > 0) {
            for (const item of matches) {
              try {
                const buf = Buffer.from(item.b64, 'base64');
                const resized = await sharpModule(buf).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
                const outB64 = resized.toString('base64');
                const newData = `data:image/jpeg;base64,${outB64}`;
                htmlToRender = htmlToRender.split(item.orig).join(newData);
              } catch (e) {
                // ignore per-image compression errors
              }
            }
          }

          // 2) compress remote images referenced by <img src="https://..."> or background-image:url('https://...')
          try {
            const urlRegex = /<img[^>]+src=(?:\"|\')([^\"']+)(?:\"|\')/gi;
            const urlMatches: string[] = [];
            while ((m = urlRegex.exec(htmlToRender)) !== null) {
              const url = m[1];
              if (url && /^https?:\/\//i.test(url)) urlMatches.push(url);
            }
            // also capture CSS background-image urls
            const bgRegex = /background-image:\s*url\((?:\"|\')?([^\)\"']+)(?:\"|\')?\)/gi;
            while ((m = bgRegex.exec(htmlToRender)) !== null) {
              const url = m[1];
              if (url && /^https?:\/\//i.test(url)) urlMatches.push(url);
            }

            // dedupe
            const uniqueUrls = Array.from(new Set(urlMatches)).slice(0, 8); // limit to avoid excessive fetches
            for (const remoteUrl of uniqueUrls) {
              try {
                const resp = await fetch(remoteUrl);
                if (!resp.ok) continue;
                const ab = await resp.arrayBuffer();
                const buf = Buffer.from(ab);
                const resized = await sharpModule(buf).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
                const outB64 = resized.toString('base64');
                const dataUri = `data:image/jpeg;base64,${outB64}`;
                // replace occurrences of the remoteUrl in the HTML with the new data URI
                htmlToRender = htmlToRender.split(remoteUrl).join(dataUri);
              } catch (e) {
                // ignore per-image errors
              }
            }
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        // ignore image compression errors
      }
    }

    // eslint-disable-next-line no-console
    console.log('[generate-pdf] html meta', {
      optimize,
      htmlLength: htmlToRender.length,
    });

    // Give navigation more time for slow remote images; attempt network idle first,
    // then gracefully fall back to progressively laxer waitUntil strategies. After
    // content is set, wait for fonts and target container to be ready so printed
    // output isn't empty on serverless platforms.
    try {

      // increase default navigation timeout (ms) when supported
      try {
        page.setDefaultNavigationTimeout(120000);
      } catch (e) {
        // ignore if not supported
      }
      await page.setContent(htmlToRender, { waitUntil: 'networkidle0', timeout: 120000 });
    } catch (err) {
      // eslint-disable-next-line no-console
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('generate-pdf: networkidle0 wait timed out, falling back to domcontentloaded', errMsg);
      try {
        await page.setContent(htmlToRender, { waitUntil: 'domcontentloaded', timeout: 60000 });
      } catch (err2) {
        // eslint-disable-next-line no-console
        const err2Msg = err2 instanceof Error ? err2.message : String(err2);
        console.warn('generate-pdf: domcontentloaded fallback failed, trying without timeout', err2Msg);
        // final attempt with no timeout to avoid failing for very slow resources
        await page.setContent(htmlToRender, { waitUntil: 'domcontentloaded', timeout: 0 });
      }
    }

    // Give the page a short chance to complete layout and load fonts/images.
    try {
      // Prefer print media so @media print rules apply
      try {
        // newer puppeteer versions prefer emulateMedia; guard with try/catch
        // @ts-ignore
        if (typeof page.emulateMedia === 'function') {
          // @ts-ignore
          await page.emulateMedia({ media: 'print' });
        } else if (typeof (page as any).emulateMediaType === 'function') {
          // older API
          // @ts-ignore
          await (page as any).emulateMediaType('print');
        }
      } catch (e) {
        // ignore if emulateMedia isn't supported
      }

      // wait for fonts to be ready (avoids missing text in PDFs)
      try {
        // @ts-ignore - run in page context
        await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
      } catch (e) {
        // ignore font-wait failures
      }

      // Wait for our printable container to appear and have content
      try {
        await page.waitForFunction(() => {
          const el = document.querySelector('.pdf-container');
          const txt = el && (el.textContent || '');
          return !!el && String(txt).trim().length > 0;
        }, { timeout: 10000 });
      } catch (e) {
        // fallback: brief sleep to allow layout
        try { await page.waitForTimeout(500); } catch (e2) { /* ignore */ }
      }
    } catch (e) {
      // ignore readiness errors
    }
    // Log pdf-container text length to help diagnose blank PDFs in serverless
    try {
      let _pdfContainerTextLen = 0;
      try {
        const _txt = await page.evaluate(() => {
          const el = document.querySelector('.pdf-container');
          return el ? (el.textContent || '') : '';
        });
        if (typeof _txt === 'string') _pdfContainerTextLen = _txt.trim().length;
      } catch (e) {
        // ignore inner evaluate errors
      }
      // eslint-disable-next-line no-console
      console.log('[generate-pdf] pdf-container text length=', _pdfContainerTextLen);
    } catch (e) {
      // ignore logging failures
    }
    // Ensure backgrounds don't embed huge images when optimize is enabled.
    // (This is deterministic vs relying only on sharp-string replacements.)
    if (optimize) {
      try {
        await page.addStyleTag({
          content: `
            /* Clamp heavy backgrounds for smaller PDFs */
            img { max-width: 100%; }
            .pdf-bg-layer, .pdf-bg-layer * { display: block; }
            .pdf-bg-layer {
              background-size: 1200px 1200px !important;
              background-repeat: no-repeat !important;
              image-rendering: optimizeQuality;
            }
            body {
              background-size: 1200px 1200px !important;
              background-repeat: no-repeat !important;
            }
          `,
        });
      } catch (e) {
        // ignore
      }
    }

    // Vercel PDFs sometimes appear “blank” when backgrounds are not printed.
      // Ensure print media is active and prefer CSS page sizes for consistent output.
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        scale: optimize ? 0.93 : 1,
        preferCSSPageSize: true,
      });
    } finally {
      try {
        if (browser && typeof browser.close === 'function') await browser.close();
      } catch (e) {
        // ignore close errors
      }
      try {
        if (pwBrowser && typeof pwBrowser.close === 'function') await pwBrowser.close();
      } catch (e) {
        // ignore close errors
      }
    }

    // Make response robust for clients: use Uint8Array to avoid any Buffer edge-cases on serverless.
    if (!pdfBuffer) {
      // eslint-disable-next-line no-console
      console.error('generate-pdf: PDF buffer is empty after generation');
      return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }

    const bodyBytes = new Uint8Array(pdfBuffer);
    return new NextResponse(bodyBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${title.replace(/[^a-z0-9-_\.]/gi, '_')}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });

  } catch (e) {
    // Server error
    // eslint-disable-next-line no-console
    console.error('generate-pdf error:', e);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}

// Note: this API route requires Node runtime (default). It avoids static imports
// of optional native modules so Next's bundler won't error when `puppeteer` isn't installed.
