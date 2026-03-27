"use client";

import { useEffect, useId, useState } from "react";

type TrustedHtmlFrameProps = {
  html: string;
  title: string;
  className?: string;
  constrainContentWidth?: boolean;
  initialHeight?: number;
  minHeight?: number;
};

const FONT_HEAD = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
`;

const FRAME_CSP = [
  "default-src 'self' data: blob: https:",
  "script-src 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

function injectIntoHead(documentHtml: string, fragment: string) {
  if (/<\/head>/i.test(documentHtml)) {
    return documentHtml.replace(/<\/head>/i, `${fragment}</head>`);
  }

  if (/<html\b[^>]*>/i.test(documentHtml)) {
    return documentHtml.replace(
      /<html\b([^>]*)>/i,
      `<html$1><head>${fragment}</head>`
    );
  }

  return `<!DOCTYPE html><html><head>${fragment}</head><body>${documentHtml}</body></html>`;
}

function injectBeforeBodyClose(documentHtml: string, fragment: string) {
  if (/<\/body>/i.test(documentHtml)) {
    return documentHtml.replace(/<\/body>/i, `${fragment}</body>`);
  }

  return documentHtml.replace(/<\/html>/i, `${fragment}</html>`);
}

function buildSrcDoc(rawHtml: string, frameId: string, constrainContentWidth: boolean) {
  const bridgeScript = `
    <script>
      (function() {
        const FRAME_ID = ${JSON.stringify(frameId)};

        function postHeight() {
          const body = document.body;
          const html = document.documentElement;
          const height = Math.max(
            body ? body.scrollHeight : 0,
            body ? body.offsetHeight : 0,
            html ? html.clientHeight : 0,
            html ? html.scrollHeight : 0,
            html ? html.offsetHeight : 0
          );

          parent.postMessage({ source: "trusted-html-frame", frameId: FRAME_ID, height }, "*");
        }

        window.addEventListener("load", postHeight);
        window.addEventListener("resize", postHeight);

        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(postHeight).catch(function() {});
        }

        const observer = new MutationObserver(postHeight);
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });

        setInterval(postHeight, 1000);
        postHeight();
      })();
    </script>
  `;

  const headContent = `
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}">
    ${FONT_HEAD}
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
      }
      ${constrainContentWidth ? `
      html, body {
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      body > * {
        max-width: 100%;
      }
      img, video, iframe, embed, object, canvas, svg {
        max-width: 100% !important;
        height: auto;
      }
      iframe {
        width: 100%;
      }
      table {
        display: block;
        width: 100%;
        max-width: 100% !important;
        overflow-x: auto;
      }
      pre, code, blockquote {
        max-width: 100%;
        overflow-x: auto;
      }
      p, li, div, span, td, th, h1, h2, h3, h4, h5, h6 {
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      ` : ""}
    </style>
  `;

  const trimmed = rawHtml.trim();
  const hasDocumentShell = /<html\b|<body\b|<!doctype/i.test(trimmed);
  const baseDocument = hasDocumentShell
    ? injectIntoHead(trimmed, headContent)
    : `<!DOCTYPE html><html><head>${headContent}</head><body>${trimmed}</body></html>`;

  return injectBeforeBodyClose(baseDocument, bridgeScript);
}

export default function TrustedHtmlFrame({
  html,
  title,
  className,
  constrainContentWidth = false,
  initialHeight = 560,
  minHeight = 320,
}: TrustedHtmlFrameProps) {
  const frameId = useId();
  const [height, setHeight] = useState(initialHeight);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.source !== "trusted-html-frame" || data.frameId !== frameId) {
        return;
      }

      if (typeof data.height === "number" && Number.isFinite(data.height)) {
        setHeight(Math.max(minHeight, Math.ceil(data.height)));
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [frameId, minHeight]);

  return (
    <iframe
      title={title}
      srcDoc={buildSrcDoc(html, frameId, constrainContentWidth)}
      sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-downloads allow-presentation"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
      className={className}
      style={{ width: "100%", height, border: 0, background: "transparent" }}
    />
  );
}
