'use client'

import React, { useState } from 'react'

import { useAuth } from '@clerk/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { PresentSchema, type PresentInput } from '@elevate/types/schemas'
import { Button, Input, Textarea, Card, FormField, LoadingSpinner, Alert, AlertTitle, AlertDescription, FileUpload, FileList, type UploadedFile } from '@elevate/ui'


import { getApiClient } from '../../../../lib/api-client'

export default function PresentFormPage() {
  const { userId } = useAuth()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [makePublic, setMakePublic] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<PresentInput>({
    resolver: zodResolver(PresentSchema)
  })

  const watchedUrl = watch('linkedinUrl')
  const watchedCaption = watch('caption')

  // Validate LinkedIn URL format
  const isValidLinkedInUrl = (url: string) => {
    if (!url) return false
    const linkedinPattern = /^https:\/\/(www\.)?linkedin\.com\/(posts|feed\/update)/
    return linkedinPattern.test(url)
  }

  const handleFileSelect = async (files: File[]) => {
    const file = files[0] // Only allow one screenshot file
    if (!file) {
      return // Early exit if no file selected
    }
    
    // Validate that it's an image
    if (!file.type.startsWith('image/')) {
      setSubmitStatus({ type: 'error', message: 'Please upload an image file for the screenshot' })
      return
    }
    
    const newUploadedFile: UploadedFile = {
      file,
      uploading: true
    }

    setUploadedFiles([newUploadedFile])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('activityCode', 'PRESENT')

      const api = getApiClient()
      const result = await api.uploadFile(file, 'PRESENT')

      // Update the file with upload results
      setUploadedFiles([{
        file,
        path: result.data.path,
        hash: result.data.hash,
        uploading: false
      }])

      // Update form value
      setValue('screenshotFile', result.data.path)

    } catch (error) {
      setUploadedFiles([{
        file,
        uploading: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }])
    }
  }

  const handleFileRemove = (index: number) => {
    setUploadedFiles([])
    setValue('screenshotFile', undefined)
  }

  const onSubmit = async (data: PresentInput) => {
    if (!userId) {
      setSubmitStatus({ type: 'error', message: 'You must be logged in to submit' })
      return
    }

    if (!isValidLinkedInUrl(data.linkedinUrl)) {
      setSubmitStatus({ type: 'error', message: 'Please enter a valid LinkedIn post URL' })
      return
    }

    const firstFile = uploadedFiles[0]
    if (uploadedFiles.length === 0 || !firstFile || !firstFile.path) {
      setSubmitStatus({ type: 'error', message: 'Please upload a screenshot of your LinkedIn post' })
      return
    }

    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      const payload = {
        linkedinUrl: data.linkedinUrl,
        caption: data.caption,
        screenshotFile: firstFile.path,
        screenshotHash: firstFile.hash
      }

      const api2 = getApiClient()
      await api2.createSubmission({
        activityCode: 'PRESENT',
        payload,
        attachments: [firstFile.path],
        visibility: makePublic ? 'PUBLIC' : 'PRIVATE'
      })

      setSubmitStatus({ 
        type: 'success', 
        message: 'LinkedIn post submitted successfully! You could earn 20 points once approved.' 
      })

      // Reset form
      setUploadedFiles([])
      setMakePublic(false)
      
    } catch (error) {
      setSubmitStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to submit LinkedIn post'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Present — Share Your AI Journey</h1>
          <p className="text-gray-600">
            Share your AI in education experience on LinkedIn to inspire other educators. Earn 20 points for approved posts.
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
              label="LinkedIn Post URL"
              required
              error={errors.linkedinUrl?.message || (!isValidLinkedInUrl(watchedUrl) && watchedUrl ? 'Please enter a valid LinkedIn post URL' : undefined)}
              description="Paste the URL of your LinkedIn post about AI in education"
            >
              <Input
                {...register('linkedinUrl')}
                type="url"
                placeholder="https://www.linkedin.com/posts/..."
              />
              {watchedUrl && isValidLinkedInUrl(watchedUrl) && (
                <div className="text-sm text-green-600 mt-1">✓ Valid LinkedIn URL</div>
              )}
            </FormField>

            <FormField
              label="Screenshot"
              required
              error={uploadedFiles[0]?.error}
              description="Upload a screenshot of your LinkedIn post (JPG or PNG only)"
            >
              <FileUpload
                onFileSelect={handleFileSelect}
                accept=".jpg,.jpeg,.png"
                maxFiles={1}
                disabled={isSubmitting}
              />
              <FileList 
                files={uploadedFiles} 
                onRemove={handleFileRemove}
              />
            </FormField>

            <FormField
              label="Post Caption"
              required
              error={errors.caption?.message}
              description="Briefly describe what your LinkedIn post is about (minimum 10 characters)"
            >
              <Textarea
                {...register('caption')}
                placeholder="Describe your LinkedIn post content, key message, and how it relates to AI in education..."
                rows={4}
              />
              <div className="text-right text-sm text-gray-500 mt-1">
                {(watchedCaption?.length || 0)}/10 characters minimum
              </div>
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
                  Make this submission visible on my public profile
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                When enabled, this submission will be visible to others viewing your public profile page.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <Button 
                type="submit" 
                disabled={
                  isSubmitting || 
                  !isValidLinkedInUrl(watchedUrl) ||
                  (watchedCaption?.length || 0) < 10 ||
                  uploadedFiles.length === 0 || 
                  !!uploadedFiles[0]?.error
                }
                className="w-full"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <LoadingSpinner size="sm" />
                    <span>Submitting...</span>
                  </div>
                ) : (
                  'Submit LinkedIn Post (20 potential points)'
                )}
              </Button>
            </div>
          </form>
        </Card>

        <div className="mt-6 text-sm text-gray-500">
          <h3 className="font-medium text-gray-700 mb-2">Submission Tips:</h3>
          <ul className="space-y-1">
            <li>• Post should be about your AI in education experience</li>
            <li>• Use relevant hashtags like #AIInEducation #EducationTech</li>
            <li>• Share specific examples and insights from your journey</li>
            <li>• Screenshots should clearly show the post and engagement</li>
            <li>• Posts must be publicly visible on LinkedIn for verification</li>
          </ul>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <h4 className="font-medium text-blue-800 text-sm">Why Share on LinkedIn?</h4>
            <div className="text-xs text-blue-700 mt-1">
              Sharing your AI education experience helps inspire other educators and builds your professional network. Your story could motivate others to join the movement!
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
