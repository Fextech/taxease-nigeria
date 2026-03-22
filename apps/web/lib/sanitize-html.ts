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
    'p', 'br', 'b', 'i', 'em', 'strong',
    'ul', 'ol', 'li',
    'h2', 'h3', 'h4',
    'a', 'span', 'div',
];

/** Attributes permitted on those elements */
const ALLOWED_ATTR = ['href', 'target', 'rel', 'style', 'class'];

/**
 * Sanitizes a raw HTML string before rendering.
 * Strips <script>, inline event handlers, javascript: URLs, iframes,
 * and any element or attribute not in the allowlist.
 */
export function sanitizeHtml(raw: string): string {
    if (!raw) return '';

    return DOMPurify.sanitize(raw, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
        ALLOW_DATA_ATTR: false,
        FORCE_BODY: false,
    });
}
