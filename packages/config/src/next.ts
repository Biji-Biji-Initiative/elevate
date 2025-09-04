export type SecurityHeadersOptions = {
  isProduction: boolean
}

export function getSecurityHeaders({ isProduction }: SecurityHeadersOptions) {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        {
          key: 'Permissions-Policy',
          value: [
            'camera=()',
            'microphone=()',
            'geolocation=()',
            'interest-cohort=()',
            'payment=()',
            'sync-xhr=()',
            'usb=()',
            'magnetometer=()',
            'accelerometer=()',
            'gyroscope=()',
            'bluetooth=()',
            'midi=()',
            'notifications=()',
            'push=()',
            'speaker-selection=()',
            'ambient-light-sensor=()',
            'battery=()',
            'display-capture=()',
            'document-domain=()',
            'execution-while-not-rendered=()',
            'execution-while-out-of-viewport=()',
            'fullscreen=(self)',
            'gamepad=()',
            'hid=()',
            'idle-detection=()',
            'local-fonts=()',
            'serial=()',
            'storage-access=()',
            'window-management=()',
            'xr-spatial-tracking=()'
          ].join(', '),
        },
        ...(isProduction
          ? [
              {
                key: 'Strict-Transport-Security',
                value: 'max-age=63072000; includeSubDomains; preload',
              },
            ]
          : []),
        { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
      ],
    },
  ]
}

