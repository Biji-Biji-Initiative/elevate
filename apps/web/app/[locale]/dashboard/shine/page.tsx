'use client'

import React, { useState } from 'react'

import { useAuth } from '@clerk/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ShineSchema, type ShineInput } from '@elevate/types/schemas'
import { Button, Input, Textarea, Card, FormField, LoadingSpinner, Alert, AlertTitle, AlertDescription, FileUpload, FileList, type UploadedFile } from '@elevate/ui'

import { isSuccessfulUpload, filterSuccessfulUploads } from '../../../../lib/file-upload-helpers'
import { getApiClient } from '../../../../lib/api-client'

export default function ShineFormPage() {
  const { userId } = useAuth()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [makePublic, setMakePublic] = useState(true) // Default to public for Shine

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<ShineInput>({
    resolver: zodResolver(ShineSchema)
  })

  const watchedTitle = watch('ideaTitle')
  const watchedSummary = watch('ideaSummary')

  // Narrow to successful uploaded files with path
  const filterSuccessfulUploads = <T extends { path?: string; error?: unknown }>(
    files: T[]
  ): Array<T & { path: string }> => {
    return files.filter((f) => typeof f.path === 'string' && !f.error) as Array<
      T & { path: string }
    >
  }

  const handleFileSelect = async (files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => ({
      file,
      uploading: true
    }))

    setUploadedFiles(prev => [...prev, ...newFiles])

    // Upload each file
    const uploadPromises = files.map(async (file) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('activityCode', 'SHINE')

      const api = getApiClient()
      const result = await api.uploadFile(file, 'SHINE')
      return { file, path: result.data.path, hash: result.data.hash, uploading: false }

      } catch (error) {
        return {
          file,
          uploading: false,
          error: error instanceof Error ? error.message : 'Upload failed'
        }
      }
    })

    const results = await Promise.all(uploadPromises)
    
    setUploadedFiles(prev => {
      const newList = [...prev]
      // Replace the uploading files with results
      const startIndex = prev.length - files.length
      results.forEach((result, index) => {
        newList[startIndex + index] = result
      })
      return newList
    })

    // Update form value with successful uploads
    const successfulPaths = filterSuccessfulUploads(results).map(r => r.path)
    
    setValue('attachment', successfulPaths.length > 0 ? successfulPaths : undefined)
  }

  const handleFileRemove = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index)
    setUploadedFiles(newFiles)
    
    const successfulPaths = filterSuccessfulUploads(newFiles).map(f => f.path)
    
    setValue('attachment', successfulPaths.length > 0 ? successfulPaths : undefined)
  }

  const onSubmit = async (data: ShineInput) => {
    if (!userId) {
      setSubmitStatus({ type: 'error', message: 'You must be logged in to submit' })
      return
    }

    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      const successfulFiles = filterSuccessfulUploads(uploadedFiles)
      
      const payload = {
        ideaTitle: data.ideaTitle,
        ideaSummary: data.ideaSummary,
        attachments: successfulFiles.length > 0 ? successfulFiles.map(f => f.path) : undefined
      }

      const api2 = getApiClient()
      await api2.createSubmission({
        activityCode: 'SHINE',
        payload,
        attachments: successfulFiles.map(f => f.path),
        visibility: makePublic ? 'PUBLIC' : 'PRIVATE'
      })

      setSubmitStatus({ 
        type: 'success', 
        message: 'Innovation idea submitted successfully! Your idea is now under review for recognition.' 
      })

      // Reset form
      setUploadedFiles([])
      
    } catch (error) {
      setSubmitStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to submit innovation idea'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Shine — Innovation & Recognition</h1>
          <p className="text-gray-600">
            Share your innovative ideas for using AI in education. Outstanding submissions receive special recognition and showcase opportunities.
          </p>
        </div>

        {submitStatus && (
          <Alert 
            variant={submitStatus.type === 'error' ? 'destructive' : 'default'} 
            className="mb-6"
          >
            <AlertTitle>{submitStatus.type === 'success' ? 'Success!' : 'Error'}</AlertTitle>
            <AlertDescription>{submitStatus.message}</AlertDescription>
          </Alert>
        )}

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              label="Innovation Title"
              required
              error={errors.ideaTitle?.message}
              description="Give your innovation idea a compelling title (minimum 4 characters)"
            >
              <Input
                {...register('ideaTitle')}
                placeholder="e.g. AI-Powered Personalized Learning Pathways"
              />
              <div className="text-right text-sm text-gray-500 mt-1">
                {(watchedTitle?.length || 0)}/4 characters minimum
              </div>
            </FormField>

            <FormField
              label="Innovation Summary"
              required
              error={errors.ideaSummary?.message}
              description="Describe your innovative approach, implementation, and impact (minimum 50 characters)"
            >
              <Textarea
                {...register('ideaSummary')}
                placeholder="Describe your innovative idea: What problem does it solve? How did you implement it? What was the impact on learning? What makes it unique and scalable?"
                rows={8}
              />
              <div className="text-right text-sm text-gray-500 mt-1">
                {(watchedSummary?.length || 0)}/50 characters minimum
              </div>
            </FormField>

            <FormField
              label="Supporting Documents (Optional)"
              error={uploadedFiles.some(f => f.error) ? 'Some files failed to upload' : undefined}
              description="Upload presentations, prototypes, research, or other materials that showcase your innovation"
            >
              <FileUpload
                onFileSelect={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png"
                multiple={true}
                maxFiles={3}
                disabled={isSubmitting}
              />
              <FileList 
                files={uploadedFiles} 
                onRemove={handleFileRemove}
              />
            </FormField>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="makePublic"
                  checked={makePublic}
                  onChange={(e) => setMakePublic(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="makePublic" className="text-sm font-medium text-gray-700">
                  Make this innovation visible on my public profile
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Recommended: Showcase your innovation to inspire other educators and increase recognition opportunities.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <Button 
                type="submit" 
                disabled={
                  isSubmitting || 
                  (watchedTitle?.length || 0) < 4 ||
                  (watchedSummary?.length || 0) < 50
                }
                className="w-full"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <LoadingSpinner size="sm" />
                    <span>Submitting...</span>
                  </div>
                ) : (
                  'Submit Innovation for Recognition'
                )}
              </Button>
            </div>
          </form>
        </Card>

        <div className="mt-6 text-sm text-gray-500">
          <h3 className="font-medium text-gray-700 mb-2">What Makes a Great Shine Submission?</h3>
          <ul className="space-y-1">
            <li>• Novel approach to using AI in education</li>
            <li>• Clear evidence of positive student impact</li>
            <li>• Scalable solution that others can adopt</li>
            <li>• Well-documented process and results</li>
            <li>• Creative integration of technology and pedagogy</li>
          </ul>

          <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded">
            <h4 className="font-medium text-purple-800 text-sm">Recognition Opportunities</h4>
            <div className="text-xs text-purple-700 mt-1">
              Outstanding Shine submissions may be featured in program showcases, Microsoft events, and educational publications. Top innovators receive special recognition and networking opportunities.
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
            <h4 className="font-medium text-gray-700 text-sm">Evaluation Criteria</h4>
            <div className="text-xs text-gray-600 mt-1">
              <strong>Innovation:</strong> Uniqueness and creativity of approach<br/>
              <strong>Impact:</strong> Evidence of improved learning outcomes<br/>
              <strong>Scalability:</strong> Potential for broader adoption<br/>
              <strong>Documentation:</strong> Quality of explanation and evidence
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
