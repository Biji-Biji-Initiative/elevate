"use server"
import 'server-only'

import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export async function getRootFontClass(): Promise<string> {
  try {
    const fontRelPath = '../fonts/Inter-Variable.woff2'
    const fileUrl = new URL(fontRelPath, import.meta.url)
    const filePath = fileURLToPath(fileUrl)
    await fs.access(filePath)
    const localFont = (await import('next/font/local')).default
    const inter = localFont({
      src: [{ path: fontRelPath, style: 'normal', weight: '100 900' }],
      display: 'swap',
      variable: '--font-inter',
    })
    return inter.className
  } catch {
    // Font file not present; fall back to system fonts
    return ''
  }
}
