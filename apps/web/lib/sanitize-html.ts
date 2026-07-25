/**
 * sanitize-html.ts
 *
 * Server-side HTML sanitizer using a strict element/attribute allowlist.
 * Used wherever admin-managed HTML is rendered with dangerouslySetInnerHTML.
 *
 * NOTE: DOMPurify requires a DOM environment. We use
 * `isomorphic-dompurify`, which wraps JSDOM under Node.js so the same
 * sanitizer works in both server and client rendering paths.
 */

import DOMPurify from 'isomorphic-dompurify';

/** Elements permitted in admin-managed content */
const ALLOWED_TAGS = [
    'div', 'span', 'section', 'article',
    'p', 'br', 'hr', 'b', 'i', 'em', 'strong', 'u', 's',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'a', 'img',
    'figure', 'figcaption',
    'video', 'source',
    'iframe',
    'style',
];

/** Attributes permitted on those elements */
const ALLOWED_ATTR = [
    'href', 'target', 'rel', 'style', 'class', 'id', 'title',
    'src', 'alt', 'width', 'height',
    'colspan', 'rowspan', 'cellpadding', 'cellspacing',
    'controls', 'poster', 'autoplay', 'muted', 'loop', 'playsinline', 'preload',
    'allow', 'allowfullscreen', 'frameborder', 'loading', 'referrerpolicy', 'type',
];

const SAFE_IFRAME_HOSTS = new Set([
    'www.youtube.com',
    'youtube.com',
    'www.youtube-nocookie.com',
    'youtube-nocookie.com',
    'player.vimeo.com',
    'www.loom.com',
    'loom.com',
    'player.loom.com',
]);

let hooksRegistered = false;

function sanitizeCss(css: string): string {
    return css
        .replace(/@import[\s\S]*?;/gi, '')
        .replace(/expression\s*\([^)]*\)/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/behavior\s*:/gi, '')
        .trim();
}

function isSafeHttpUrl(value: string): boolean {
    return value.startsWith('http://') || value.startsWith('https://');
}

function isSafeAssetUrl(value: string): boolean {
    return (
        value.startsWith('/') ||
        value.startsWith('./') ||
        value.startsWith('../') ||
        value.startsWith('https://') ||
        value.startsWith('http://') ||
        value.startsWith('data:') ||
        value.startsWith('blob:')
    );
}

function isSafeLinkUrl(value: string): boolean {
    return (
        value.startsWith('/') ||
        value.startsWith('./') ||
        value.startsWith('../') ||
        value.startsWith('#') ||
        value.startsWith('https://') ||
        value.startsWith('http://') ||
        value.startsWith('mailto:') ||
        value.startsWith('tel:')
    );
}

function isSafeIframeUrl(value: string): boolean {
    if (!value) return false;
    if (value.startsWith('/')) return true;
    if (!isSafeHttpUrl(value)) return false;

    try {
        const host = new URL(value).hostname.toLowerCase();
        return SAFE_IFRAME_HOSTS.has(host);
    } catch {
        return false;
    }
}

function ensureHooksRegistered() {
    if (hooksRegistered) return;

    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (!('tagName' in node)) return;

        const tagName = String(node.tagName || '').toLowerCase();

        // Normalize links
        if (tagName === 'a') {
            const href = node.getAttribute('href') || '';
            if (!isSafeLinkUrl(href)) {
                node.removeAttribute('href');
            }

            const target = node.getAttribute('target');
            if (target && target !== '_blank' && target !== '_self') {
                node.removeAttribute('target');
            }

            if (node.getAttribute('target') === '_blank') {
                node.setAttribute('rel', 'noopener noreferrer');
            }
        }

        // Allow images and direct video files from safe asset URLs
        if (tagName === 'img' || tagName === 'video' || tagName === 'source') {
            const src = node.getAttribute('src') || '';
            if (src && !isSafeAssetUrl(src)) {
                node.removeAttribute('src');
            }
        }

        // Restrict iframe embeds to trusted providers
        if (tagName === 'iframe') {
            const src = node.getAttribute('src') || '';
            if (!isSafeIframeUrl(src)) {
                node.parentNode?.removeChild(node);
                return;
            }

            if (!node.getAttribute('loading')) {
                node.setAttribute('loading', 'lazy');
            }
            if (!node.getAttribute('referrerpolicy')) {
                node.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            }
        }

    });

    hooksRegistered = true;
}

function normalizeHtmlDocument(raw: string): { body: string; styles: string[] } {
    const trimmed = raw.trim();
    if (!trimmed) return { body: '', styles: [] };

    const styles = Array.from(
        trimmed.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)
    )
        .map((match) => sanitizeCss(match[1] || ''))
        .filter(Boolean);

    const bodyMatch = trimmed.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : trimmed;
    const bodyWithoutStyleTags = bodyContent.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

    return {
        body: bodyWithoutStyleTags,
        styles,
    };
}

/**
 * Sanitizes a raw HTML string before rendering.
 * Strips <script>, inline event handlers, javascript: URLs, iframes,
 * and any element or attribute not in the allowlist.
 */
export function sanitizeHtml(raw: string): string {
    if (!raw) return '';
    ensureHooksRegistered();
    const normalized = normalizeHtmlDocument(raw);

    const sanitizedBody = DOMPurify.sanitize(normalized.body, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onmouseenter', 'onmouseleave'],
        ALLOW_DATA_ATTR: false,
        FORCE_BODY: false,
    });

    const styleBlocks = normalized.styles
        .map((css) => `<style>${css}</style>`)
        .join('');

    return `${styleBlocks}${sanitizedBody}`;
}
