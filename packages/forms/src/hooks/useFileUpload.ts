import { useState, useCallback } from 'react'

export interface UploadedFile {
  file: File
  path?: string
  hash?: string
  url?: string
  uploading?: boolean
  error?: string
}

export interface UseFileUploadOptions {
  maxFiles?: number
  maxSizeBytes?: number
  acceptedTypes?: string[]
  onUpload?: (files: File[]) => Promise<UploadedFile[]>
  onError?: (error: Error) => void
}

// Helper: return the first successful upload (has a string path and no error)
export function getFirstSuccessfulUpload<T extends UploadedFile>(
  files: T[]
): (T & { path: string }) | undefined {
  for (const f of files) {
    if (typeof f.path === 'string' && !f.error) {
      return f as T & { path: string }
    }
  }
  return undefined
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const filterSuccessfulUploads = useCallback(<T extends UploadedFile>(
    files: T[]
  ): Array<T & { path: string }> => {
    return files.filter(
      (f): f is T & { path: string } => 
        typeof f.path === 'string' && !f.error
    )
  }, [])

  const handleFileSelect = useCallback(async (files: File[]) => {
    setUploadError(null)
    
    // Validate file count
    if (options.maxFiles && files.length > options.maxFiles) {
      const error = `Maximum ${options.maxFiles} files allowed`
      setUploadError(error)
      options.onError?.(new Error(error))
      return []
    }

    // Validate file sizes
    if (options.maxSizeBytes) {
      const maxSize = options.maxSizeBytes
      const oversized = files.filter(f => f.size > maxSize)
      if (oversized.length > 0) {
        const error = `Files too large: ${oversized.map(f => f.name).join(', ')}`
        setUploadError(error)
        options.onError?.(new Error(error))
        return []
      }
    }

    // Validate file types
    if (options.acceptedTypes && options.acceptedTypes.length > 0) {
      const acceptedTypes = options.acceptedTypes
      const invalidTypes = files.filter(f => {
        const fileType = f.type.toLowerCase()
        return !acceptedTypes.some(accepted => {
          if (accepted.includes('*')) {
            const [category] = accepted.split('/')
            return fileType.startsWith(category + '/')
          }
          return fileType === accepted.toLowerCase()
        })
      })
      
      if (invalidTypes.length > 0) {
        const error = `Invalid file types: ${invalidTypes.map(f => f.name).join(', ')}`
        setUploadError(error)
        options.onError?.(new Error(error))
        return []
      }
    }

    setIsUploading(true)
    
    try {
      let results: UploadedFile[]
      
      if (options.onUpload) {
        results = await options.onUpload(files)
      } else {
        // Default behavior - just store the files
        results = files.map(file => ({ file, path: URL.createObjectURL(file) }))
      }
      
      setUploadedFiles(prev => [...prev, ...results])
      return filterSuccessfulUploads(results)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      setUploadError(message)
      options.onError?.(error instanceof Error ? error : new Error(message))
      return []
    } finally {
      setIsUploading(false)
    }
  }, [options, filterSuccessfulUploads])

  const removeFile = useCallback((index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const clearFiles = useCallback(() => {
    setUploadedFiles([])
    setUploadError(null)
  }, [])

  const successfulUploads = filterSuccessfulUploads(uploadedFiles)

  return {
    uploadedFiles,
    successfulUploads,
    isUploading,
    uploadError,
    handleFileSelect,
    removeFile,
    clearFiles,
    filterSuccessfulUploads
  }
}
