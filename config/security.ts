import type { Plugin } from 'vite'

// GitHub Pages cannot set custom headers; frame-ancestors cannot go in a meta tag.
export const htmlSecurityPolicy = "base-uri 'none'; object-src 'none'; form-action 'none'"

export const resourceSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "script-src-attr 'none'",
  // Vue uses dynamic style attributes for card sizes, spacing and animation.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "media-src 'none'",
  "frame-src 'none'",
  htmlSecurityPolicy,
  "frame-ancestors 'none'",
].join('; ')

export const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': `${htmlSecurityPolicy}; frame-ancestors 'none'`,
  // Stage the full policy without breaking the existing PWA. No reporting
  // endpoint is configured: observations remain in the browser console.
  'Content-Security-Policy-Report-Only': resourceSecurityPolicy,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
}

export function cloudflareHeadersFile(): string {
  return [
    '# Generated from config/security.ts. Change the source, not dist/_headers.',
    '/*',
    ...Object.entries(securityHeaders).map(([name, value]) => `  ${name}: ${value}`),
    '',
    '/sw.js',
    '  Cache-Control: no-cache',
    '/registerSW.js',
    '  Cache-Control: no-cache',
    '',
  ].join('\n')
}

export function securityPlugin(): Plugin {
  return {
    name: 'scout-security-headers',
    apply: 'build',
    transformIndexHtml() {
      return [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: htmlSecurityPolicy }, injectTo: 'head-prepend' },
        { tag: 'meta', attrs: { name: 'referrer', content: securityHeaders['Referrer-Policy'] }, injectTo: 'head-prepend' },
      ]
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: cloudflareHeadersFile() })
    },
  }
}
