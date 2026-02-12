import { chromium, type Browser } from "playwright";

export interface ScreenshotResult {
  /** Base64-encoded PNG screenshot */
  base64: string;
  /** Viewport width in pixels */
  viewportWidth: number;
  /** Viewport height in pixels */
  viewportHeight: number;
  /** Full page height (may differ from viewport) */
  pageHeight: number;
}

export async function captureScreenshot(
  url: string,
  width: number = 1440,
  height: number = 900,
): Promise<ScreenshotResult> {
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width, height },
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

    // Wait a bit for any late-rendering JS
    await page.waitForTimeout(1000);

    const screenshot = await page.screenshot({
      type: "png",
      fullPage: false, // Viewport only to keep context manageable
    });

    const pageHeight = await page.evaluate(() => document.body.scrollHeight);

    return {
      base64: screenshot.toString("base64"),
      viewportWidth: width,
      viewportHeight: height,
      pageHeight,
    };
  } finally {
    await browser?.close();
  }
}
