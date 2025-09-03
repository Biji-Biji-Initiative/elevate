'use client'

import React, { useCallback, useState } from 'react'

export interface FileUploadProps {
  onFileSelect: (files: File[]) => void
  accept?: string
  multiple?: boolean
  maxFiles?: number
  maxSizeBytes?: number
  className?: string
  children?: React.ReactNode
  disabled?: boolean
}

export function FileUpload({
  onFileSelect,
  accept = '.pdf,.jpg,.jpeg,.png',
  multiple = false,
  maxFiles = 1,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB
  className = '',
  children,
  disabled = false
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleFileValidation = useCallback((files: FileList) => {
    const validFiles: File[] = []
    const errors: string[] = []

    const filesToProcess = multiple ? Array.from(files) : (files[0] ? [files[0]] : [])

    if (filesToProcess.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} file${maxFiles > 1 ? 's' : ''} allowed`)
      return { validFiles: [], errors }
    }

    for (const file of filesToProcess) {
      if (!file) continue
      
      if (file.size > maxSizeBytes) {
        errors.push(`${file.name} is too large (max ${Math.round(maxSizeBytes / (1024 * 1024))}MB)`)
        continue
      }

      // Check file type
      const acceptedTypes = accept.split(',').map(type => type.trim())
      const fileExtension = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
      const isValidType = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return type.toLowerCase() === fileExtension
        }
        return file.type === type
      })

      if (!isValidType) {
        errors.push(`${file.name} is not a valid file type`)
        continue
      }

      validFiles.push(file)
    }

    return { validFiles, errors }
  }, [accept, multiple, maxFiles, maxSizeBytes])

  const handleFileInput = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return

    const { validFiles, errors } = handleFileValidation(files)

    if (errors.length > 0) {
      alert(errors.join('\n'))
      return
    }

    if (validFiles.length > 0) {
      onFileSelect(validFiles)
    }
  }, [handleFileValidation, onFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled) return

    handleFileInput(e.dataTransfer.files)
  }, [handleFileInput, disabled])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileInput(e.target.files)
  }, [handleFileInput])

  const handleClick = useCallback(() => {
    if (!disabled) {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = accept
      input.multiple = multiple
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement
        handleFileInput(target.files)
      }
      input.click()
    }
  }, [accept, multiple, handleFileInput, disabled])

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
        ${isDragging 
          ? 'border-blue-400 bg-blue-50' 
          : 'border-gray-300 hover:border-gray-400'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={disabled}
        className="hidden"
      />
      
      {children || (
        <div className="space-y-2">
          <div className="text-gray-600">
            <svg
              className="mx-auto h-8 w-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div className="text-sm text-gray-600">
            Drop files here or click to browse
          </div>
          <div className="text-xs text-gray-500">
            {accept.split(',').join(', ')} • Max {Math.round(maxSizeBytes / (1024 * 1024))}MB
            {multiple && ` • Up to ${maxFiles} file${maxFiles > 1 ? 's' : ''}`}
          </div>
        </div>
      )}
    </div>
  )
}

export interface UploadedFile {
  file: File
  path?: string
  hash?: string
  url?: string
  uploading?: boolean
  error?: string
}

export interface FileListProps {
  files: UploadedFile[]
  onRemove?: (index: number) => void
  className?: string
}

export function FileList({ files, onRemove, className = '' }: FileListProps) {
  if (files.length === 0) return null

  return (
    <div className={`space-y-2 ${className}`}>
      {files.map((file, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
        >
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {file.file.type.startsWith('image/') ? (
                <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate">
                {file.file.name}
              </div>
              <div className="text-xs text-gray-500">
                {(file.file.size / 1024 / 1024).toFixed(1)} MB
                {file.uploading && ' • Uploading...'}
                {file.error && (
                  <span className="text-red-500"> • {file.error}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {file.uploading && (
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            )}
            {file.error && (
              <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            {!file.uploading && onRemove && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
