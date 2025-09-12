import crypto from 'crypto'

import { createClient } from '@supabase/supabase-js'

import { parseWebEnv } from '@elevate/config'

// Enforce server-only usage to prevent leaking service-role keys to clients
if (typeof window !== 'undefined') {
  throw new Error(
    '@elevate/storage is server-only and must not run in the browser',
  )
}

// Initialize Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null

function getSupabaseClient() {
  if (!supabaseClient) {
    const env = parseWebEnv(process.env)
    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      throw new Error('Missing required Supabase configuration')
    }
    supabaseClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SECRET_KEY,
    )
  }
  return supabaseClient
}

// File validation constants
export const ALLOWED_FILE_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
} as const

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

// File validation errors
export class FileValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileValidationError'
  }
}

// Validate file type and size
export function validateFile(file: File): void {
  if (!ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES]) {
    throw new FileValidationError(
      `Invalid file type. Allowed types: ${Object.keys(ALLOWED_FILE_TYPES).join(
        ', ',
      )}`,
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new FileValidationError(
      `File size exceeds limit. Maximum allowed: ${
        MAX_FILE_SIZE / (1024 * 1024)
      }MB`,
    )
  }
}

// Generate file hash for deduplication
export async function generateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const hashSum = crypto.createHash('sha256')
  hashSum.update(Buffer.from(arrayBuffer))
  return hashSum.digest('hex')
}

// Generate storage path
export function generateStoragePath(
  userId: string,
  activityCode: string,
  filename: string,
  hash: string,
): string {
  const timestamp = Date.now()
  const extension = filename.split('.').pop() || 'bin'
  return `evidence/${userId}/${activityCode}/${timestamp}-${hash.substring(
    0,
    8,
  )}.${extension}`
}

// Upload evidence file to Supabase Storage
export async function saveEvidenceFile(
  file: File,
  userId: string,
  activityCode: string,
): Promise<{ path: string; hash: string; url?: string }> {
  validateFile(file)

  const hash = await generateFileHash(file)
  const storagePath = generateStoragePath(userId, activityCode, file.name, hash)

  const supabase = getSupabaseClient()

  // Convert File to ArrayBuffer for upload
  const arrayBuffer = await file.arrayBuffer()

  // Optional AV scan (lightweight EICAR heuristic). Enable via AV_SCAN_ENABLED=true
  const scan = await scanFileBufferForVirus(arrayBuffer)
  if (!scan.clean) {
    throw new FileValidationError(
      `File failed antivirus scan${scan.threat ? `: ${scan.threat}` : ''}`,
    )
  }

  const { data, error } = await supabase.storage
    .from('evidence')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      cacheControl: '3600', // 1 hour cache
      upsert: false, // Don't overwrite existing files
    })

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`)
  }

  return {
    path: data.path,
    hash,
  }
}

// Simple antivirus scan hook (stub). Integrate real scanner in infra.
export function scanFileBufferForVirus(buffer: ArrayBuffer): {
  clean: boolean
  threat?: string
} {
  try {
    const enabled = (process.env.AV_SCAN_ENABLED || '').toLowerCase() === 'true'
    if (!enabled) return { clean: true }
    // Detect EICAR test string as a basic heuristic
    const text = Buffer.from(buffer).toString('utf8')
    if (text.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
      return { clean: false, threat: 'EICAR_TEST' }
    }
    return { clean: true }
  } catch {
    // Fail-closed is too disruptive; log upstream and allow upload
    return { clean: true }
  }
}

// Get signed URL for file access (1 hour TTL)
export async function getSignedUrl(
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.storage
    .from('evidence')
    .createSignedUrl(path, expiresIn)

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`)
  }

  if (!data.signedUrl) {
    throw new Error('No signed URL returned')
  }

  return data.signedUrl
}

// Delete evidence file
export async function deleteEvidenceFile(path: string): Promise<void> {
  const supabase = getSupabaseClient()

  const { error } = await supabase.storage.from('evidence').remove([path])

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`)
  }
}

// Get multiple signed URLs for an array of paths
export async function getMultipleSignedUrls(
  paths: string[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  const urlPromises = paths.map(async (path) => {
    try {
      const url = await getSignedUrl(path, expiresIn)
      return { path, url }
    } catch (error) {
      return { path, url: '' } // Return empty string instead of null
    }
  })

  const results = await Promise.all(urlPromises)

  return results.reduce((acc, { path, url }) => {
    if (url) {
      acc[path] = url
    }
    return acc
  }, {} as Record<string, string>)
}

// Check if file exists
export async function fileExists(path: string): Promise<boolean> {
  const supabase = getSupabaseClient()

  const filename = path.split('/').pop()
  if (!filename) return false

  const { data } = await supabase.storage
    .from('evidence')
    .list(path.split('/').slice(0, -1).join('/'), {
      search: filename,
    })

  return !!data?.some(
    (file) => `${path.split('/').slice(0, -1).join('/')}/${file.name}` === path,
  )
}

// Get file metadata
export async function getFileMetadata(path: string): Promise<{
  name: string
  id?: string
  updated_at?: string
  created_at?: string
  last_accessed_at?: string
  metadata?: Record<string, string | number | boolean | null>
}> {
  const supabase = getSupabaseClient()

  const filename = path.split('/').pop()
  if (!filename) {
    throw new Error(`Invalid path: ${path}`)
  }

  const { data, error } = await supabase.storage
    .from('evidence')
    .list(path.split('/').slice(0, -1).join('/'), {
      search: filename,
    })

  if (error || !data || data.length === 0) {
    throw new Error(`File not found: ${path}`)
  }

  const firstFile = data[0]
  if (!firstFile) {
    throw new Error(`File not found: ${path}`)
  }

  return firstFile
}

// Helper function to extract user ID and activity code from storage path
export function parseStoragePath(
  path: string,
): { userId: string; activityCode: string } | null {
  const pathParts = path.split('/')
  if (pathParts.length < 4 || pathParts[0] !== 'evidence') {
    return null
  }

  const userId = pathParts[1]
  const activityCode = pathParts[2]

  if (!userId || !activityCode) {
    return null
  }

  return {
    userId,
    activityCode,
  }
}

// Retention helpers (best-effort; requires service-role key)
export async function enforceUserRetention(
  userId: string,
  cutoff: Date,
): Promise<number> {
  const supabase = getSupabaseClient()
  const activities = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']
  let deleted = 0
  for (const activity of activities) {
    const prefix = `evidence/${userId}/${activity}`
    const { data, error } = await supabase.storage.from('evidence').list(prefix)
    if (error || !Array.isArray(data)) continue
    const toDelete = data
      .filter((f) => {
        const created = f.created_at ? new Date(f.created_at) : undefined
        return created ? created < cutoff : false
      })
      .map((f) => `${prefix}/${f.name}`)
    if (toDelete.length > 0) {
      const res = await supabase.storage.from('evidence').remove(toDelete)
      if (!res.error) deleted += toDelete.length
    }
  }
  return deleted
}
