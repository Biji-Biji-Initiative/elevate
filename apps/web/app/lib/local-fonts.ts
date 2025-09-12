"use server"
import 'server-only'

export async function getRootFontClass(): Promise<string> {
  if (process.env.NEXT_USE_LOCAL_FONTS === 'true') {
    const localFont = (await import('next/font/local')).default
    // Place Inter variable font at apps/web/app/fonts/Inter-Variable.woff2
    const inter = localFont({
      src: [{ path: '../fonts/Inter-Variable.woff2', style: 'normal', weight: '100 900' }],
      display: 'swap',
      variable: '--font-inter',
    })
    return inter.className
  }
  return ''
}

