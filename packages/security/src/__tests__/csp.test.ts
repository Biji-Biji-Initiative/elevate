/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomBytes } from 'node:crypto';

import {
  generateNonce,
  buildCSPDirectives,
  generateSecurityHeaders,
  applySecurityHeaders,
  validateCSPConfig,
  processCSPViolation,
  type CSPOptions,
  type CSPViolationReport
} from '../csp.js';

// Mock crypto.randomBytes for consistent testing
vi.mock('node:crypto', () => ({
  randomBytes: vi.fn()
}));

describe('CSP Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateNonce', () => {
    it('should generate a base64 nonce', () => {
      const mockBuffer = Buffer.from('test-random-bytes');
      vi.mocked(randomBytes).mockReturnValue(mockBuffer);

      const nonce = generateNonce();
      
      expect(randomBytes).toHaveBeenCalledWith(16);
      expect(nonce).toBe(mockBuffer.toString('base64'));
    });

    it('should generate unique nonces', () => {
      let callCount = 0;
      vi.mocked(randomBytes).mockImplementation(() => {
        callCount++;
        return Buffer.from(`random-bytes-${callCount}`);
      });

      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('buildCSPDirectives', () => {
    it('should build basic CSP directives', () => {
      const directives = buildCSPDirectives();
      
      expect(directives).toContain("default-src 'self'");
      expect(directives).toContain("object-src 'none'");
      expect(directives).toContain("frame-ancestors 'none'");
      expect(directives).toContain('https://clerk.dev');
      expect(directives).toContain('https://*.supabase.co');
    });

    it('should include nonce in script-src when provided', () => {
      const nonce = 'test-nonce';
      const directives = buildCSPDirectives({ nonce });
      
      expect(directives).toContain(`'nonce-${nonce}'`);
    });

    it('should include development-specific directives', () => {
      const directives = buildCSPDirectives({ isDevelopment: true });
      
      expect(directives).toContain('ws://localhost:*');
      expect(directives).toContain('http://localhost:*');
      expect(directives).toContain("'unsafe-eval'");
    });

    it('should not include upgrade-insecure-requests in development', () => {
      const directives = buildCSPDirectives({ isDevelopment: true });
      
      expect(directives).not.toContain('upgrade-insecure-requests');
    });

    it('should include upgrade-insecure-requests in production', () => {
      const directives = buildCSPDirectives({ isDevelopment: false });
      
      expect(directives).toContain('upgrade-insecure-requests');
    });

    it('should merge custom allowed domains', () => {
      const allowedDomains = {
        external: ['https://api.example.com'],
        clerk: ['https://custom-clerk.com'],
        supabase: ['https://custom-supabase.com']
      };

      const directives = buildCSPDirectives({ allowedDomains });
      
      expect(directives).toContain('https://api.example.com');
      expect(directives).toContain('https://custom-clerk.com');
      expect(directives).toContain('https://custom-supabase.com');
    });

    it('should properly format all directive types', () => {
      const directives = buildCSPDirectives();
      const directiveList = directives.split('; ');
      
      // Check that all expected directives are present
      const expectedDirectives = [
        'default-src',
        'script-src',
        'style-src',
        'img-src',
        'font-src',
        'connect-src',
        'media-src',
        'object-src',
        'frame-src',
        'child-src',
        'worker-src',
        'manifest-src',
        'base-uri',
        'form-action',
        'frame-ancestors'
      ];

      expectedDirectives.forEach(directive => {
        const found = directiveList.some(d => d.startsWith(directive));
        expect(found, `Directive ${directive} should be present`).toBe(true);
      });
    });
  });

  describe('generateSecurityHeaders', () => {
    it('should generate all security headers', () => {
      const headers = generateSecurityHeaders();
      
      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).toHaveProperty('X-Frame-Options');
      expect(headers).toHaveProperty('X-Content-Type-Options');
      expect(headers).toHaveProperty('Referrer-Policy');
      expect(headers).toHaveProperty('Permissions-Policy');
      expect(headers).toHaveProperty('X-XSS-Protection');
      expect(headers).toHaveProperty('X-DNS-Prefetch-Control');
    });

    it('should use report-only mode when specified', () => {
      const headers = generateSecurityHeaders({ reportOnly: true });
      
      expect(headers).toHaveProperty('Content-Security-Policy-Report-Only');
      expect(headers).not.toHaveProperty('Content-Security-Policy');
    });

    it('should include HSTS in production', () => {
      const headers = generateSecurityHeaders({ isDevelopment: false });
      
      expect(headers).toHaveProperty('Strict-Transport-Security');
      expect(headers['Strict-Transport-Security']).toBe(
        'max-age=31536000; includeSubDomains; preload'
      );
    });

    it('should not include HSTS in development', () => {
      const headers = generateSecurityHeaders({ isDevelopment: true });
      
      expect(headers).not.toHaveProperty('Strict-Transport-Security');
    });

    it('should include report-uri when provided', () => {
      const reportUri = '/api/csp-report';
      const headers = generateSecurityHeaders({ reportUri });
      
      expect(headers['Content-Security-Policy']).toContain(`report-uri ${reportUri}`);
    });

    it('should have correct header values', () => {
      const headers = generateSecurityHeaders();
      
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['X-DNS-Prefetch-Control']).toBe('on');
    });

    it('should include restrictive permissions policy', () => {
      const headers = generateSecurityHeaders();
      
      const permissionsPolicy = headers['Permissions-Policy'];
      expect(permissionsPolicy).toContain('camera=()');
      expect(permissionsPolicy).toContain('microphone=()');
      expect(permissionsPolicy).toContain('geolocation=()');
      expect(permissionsPolicy).toContain('payment=()');
    });
  });

  describe('applySecurityHeaders', () => {
    it('should apply security headers to a Response', () => {
      const response = new Response('test body');
      const options: CSPOptions = { nonce: 'test-nonce' };
      
      const securedResponse = applySecurityHeaders(response, options);
      
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeTruthy();
      expect(securedResponse.headers.get('X-Frame-Options')).toBe('DENY');
      expect(securedResponse.headers.get('Content-Security-Policy')).toContain('test-nonce');
    });

    it('should preserve existing headers', () => {
      const response = new Response('test body', {
        headers: {
          'Custom-Header': 'custom-value'
        }
      });
      
      const securedResponse = applySecurityHeaders(response);
      
      expect(securedResponse.headers.get('Custom-Header')).toBe('custom-value');
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeTruthy();
    });
  });

  describe('validateCSPConfig', () => {
    it('should validate correct configuration', () => {
      const config: CSPOptions = {
        allowedDomains: {
          external: ['https://api.example.com']
        },
        reportUri: 'https://example.com/csp-report'
      };
      
      const result = validateCSPConfig(config);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid external domains', () => {
      const config: CSPOptions = {
        allowedDomains: {
          external: ['api.example.com', 'ftp://example.com']
        }
      };
      
      const result = validateCSPConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'External domain "api.example.com" should include protocol (https:// or http://)'
      );
    });

    it('should detect invalid wildcard domains', () => {
      const config: CSPOptions = {
        allowedDomains: {
          external: ['*.example.com']
        }
      };
      
      const result = validateCSPConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Wildcard domain "*.example.com" should be properly formatted (e.g., https://*.example.com)'
      );
    });

    it('should detect invalid report URI', () => {
      const config: CSPOptions = {
        reportUri: 'invalid-uri'
      };
      
      const result = validateCSPConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Report URI must be a valid HTTP(S) URL');
    });

    it('should allow valid wildcard domains', () => {
      const config: CSPOptions = {
        allowedDomains: {
          external: ['https://*.example.com']
        }
      };
      
      const result = validateCSPConfig(config);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('processCSPViolation', () => {
    it('should classify script injection as high severity', () => {
      const report: CSPViolationReport = {
        'csp-report': {
          'document-uri': 'https://example.com',
          'referrer': '',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': '',
          'blocked-uri': 'javascript:alert(1)'
        }
      };
      
      const result = processCSPViolation(report);
      
      expect(result.severity).toBe('high');
      expect(result.action).toBe('alert');
      expect(result.reason).toBe('Potential XSS attempt blocked');
    });

    it('should classify frame-ancestors violations as high severity', () => {
      const report: CSPViolationReport = {
        'csp-report': {
          'document-uri': 'https://example.com',
          'referrer': '',
          'violated-directive': 'frame-ancestors',
          'effective-directive': 'frame-ancestors',
          'original-policy': '',
          'blocked-uri': 'https://evil.com'
        }
      };
      
      const result = processCSPViolation(report);
      
      expect(result.severity).toBe('high');
    });

    it('should classify object-src violations as medium severity', () => {
      const report: CSPViolationReport = {
        'csp-report': {
          'document-uri': 'https://example.com',
          'referrer': '',
          'violated-directive': 'object-src',
          'effective-directive': 'object-src',
          'original-policy': '',
          'blocked-uri': 'data:application/x-shockwave-flash'
        }
      };
      
      const result = processCSPViolation(report);
      
      expect(result.severity).toBe('medium');
      expect(result.action).toBe('log');
    });

    it('should classify unsafe-eval as low severity', () => {
      const report: CSPViolationReport = {
        'csp-report': {
          'document-uri': 'https://example.com',
          'referrer': '',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': '',
          'blocked-uri': 'eval'
        }
      };
      
      const result = processCSPViolation(report);
      
      expect(result.severity).toBe('low');
      expect(result.reason).toBe('Dynamic code execution attempted');
    });

    it('should handle unknown violations as low severity', () => {
      const report: CSPViolationReport = {
        'csp-report': {
          'document-uri': 'https://example.com',
          'referrer': '',
          'violated-directive': 'img-src',
          'effective-directive': 'img-src',
          'original-policy': '',
          'blocked-uri': 'https://unknown.com/image.jpg'
        }
      };
      
      const result = processCSPViolation(report);
      
      expect(result.severity).toBe('low');
      expect(result.reason).toBe('Standard CSP violation');
    });
  });

  describe('Environment-specific behavior', () => {
    it('should handle missing NODE_ENV gracefully', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      
      const directives = buildCSPDirectives();
      
      // Should default to development behavior
      expect(directives).toContain("'unsafe-eval'");
      
      // Restore NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should adapt to different environments', () => {
      const prodOptions: CSPOptions = { isDevelopment: false };
      const devOptions: CSPOptions = { isDevelopment: true };
      
      const prodDirectives = buildCSPDirectives(prodOptions);
      const devDirectives = buildCSPDirectives(devOptions);
      
      expect(prodDirectives).toContain('upgrade-insecure-requests');
      expect(devDirectives).not.toContain('upgrade-insecure-requests');
      
      expect(devDirectives).toContain('ws://localhost:*');
      expect(prodDirectives).not.toContain('ws://localhost:*');
    });
  });
});