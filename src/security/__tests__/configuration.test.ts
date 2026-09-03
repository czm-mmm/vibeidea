import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cloudflareHeadersFile, htmlSecurityPolicy, resourceSecurityPolicy, securityHeaders } from '../../../config/security'

const root = new URL('../../../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

describe('security configuration', () => {
  it('enforces framing and plugin protections without blocking existing game scripts', () => {
    expect(securityHeaders['X-Frame-Options']).toBe('DENY')
    expect(securityHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    expect(securityHeaders['Content-Security-Policy']).toContain("object-src 'none'")
    expect(htmlSecurityPolicy).not.toContain('frame-ancestors')
    expect(securityHeaders['Content-Security-Policy']).not.toMatch(/(?:script|default)-src/)
  })

  it('observes a same-origin policy with Vue styles and PWA workers supported', () => {
    expect(securityHeaders['Content-Security-Policy-Report-Only']).toBe(resourceSecurityPolicy)
    expect(resourceSecurityPolicy).toContain("script-src 'self'")
    expect(resourceSecurityPolicy).toContain("script-src-attr 'none'")
    expect(resourceSecurityPolicy).toContain("style-src 'self' 'unsafe-inline'")
    expect(resourceSecurityPolicy).toContain("worker-src 'self'")
    expect(resourceSecurityPolicy).not.toContain('unsafe-eval')
    expect(resourceSecurityPolicy).not.toMatch(/script-src[^;]*unsafe-inline/)
  })

  it('keeps headers valid and service worker updates revalidatable', () => {
    for (const [name, value] of Object.entries(securityHeaders)) {
      expect(name + value).not.toMatch(/[\r\n]/)
      expect(`  ${name}: ${value}`.length).toBeLessThan(2000)
    }
    expect(securityHeaders['Permissions-Policy']).toContain('camera=()')
    expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff')
    expect(cloudflareHeadersFile()).toContain('/sw.js\n  Cache-Control: no-cache')
  })

  it('keeps development and preview on loopback without broad tunnel host exceptions', () => {
    const config = read('vite.config.ts')
    expect(config.match(/host: '127\.0\.0\.1'/g)).toHaveLength(2)
    expect(config).not.toContain("host: '0.0.0.0'")
    expect(config).not.toContain("'.vicp.fun'")
    expect(config.match(/allowedHosts: \[\]/g)).toHaveLength(2)
  })

  it('only gives the deploy job publishing rights and gates it on verification', () => {
    const deploy = read('.github/workflows/deploy.yml')
    const [beforeDeploy, deployJob] = deploy.split('\n  deploy:')
    expect(beforeDeploy).not.toMatch(/(?:pages|id-token): write/)
    expect(deployJob).toContain('needs: build')
    expect(deployJob).toContain("if: github.ref == 'refs/heads/main'")
    expect(deployJob).toContain('pages: write')
    expect(deployJob).toContain('id-token: write')
    for (const path of ['.github/workflows/deploy.yml', '.github/workflows/ci.yml']) {
      const workflow = read(path)
      expect(workflow).toContain('npm run verify')
      expect(workflow).toContain('npm run audit:security')
      expect(workflow).toContain('persist-credentials: false')
      expect(workflow).toContain('node-version-file: .node-version')
      expect(workflow).not.toContain('pull_request_target:')
      const refs = [...workflow.matchAll(/uses:\s+\S+@(\S+)/g)]
      expect(refs.length).toBeGreaterThan(0)
      for (const [, ref] of refs) expect(ref).toMatch(/^[a-f0-9]{40}$/)
    }
    expect(read('.node-version').trim()).toBe('24')
  })
})
