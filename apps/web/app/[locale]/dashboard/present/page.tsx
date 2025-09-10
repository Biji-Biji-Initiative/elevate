'use client'

import React, { useState } from 'react'

import { useAuth } from '@clerk/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'

import { useFormSubmission, useFileUpload } from '@elevate/forms'
import { PRESENT } from '@elevate/types'
import { PresentSchema, type PresentInput } from '@elevate/types/schemas'
import {
  Button,
  Input,
  Textarea,
  Card,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@elevate/ui'
import {
  FormField,
  LoadingSpinner,
  FileUpload,
  FileList,
} from '@elevate/ui/blocks'

import { getApiClient } from '../../../../lib/api-client'

export default function PresentFormPage() {
  const t = useTranslations('homepage')
  const { userId } = useAuth()
  const [makePublic, setMakePublic] = useState(false)

  const {
    isSubmitting,
    submitStatus,
    handleSubmit: handleFormSubmit,
  } = useFormSubmission({
    successMessage:
      'LinkedIn post submitted successfully! You could earn 20 points once approved.',
  })

  const {
    uploadedFiles,
    handleFileSelect: handleFileUpload,
    removeFile,
  } = useFileUpload({
    maxFiles: 1,
    onUpload: async (files) => {
      if (files.length === 0 || !files[0]) return []
      const file = files[0]
      // Validate that it's an image
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file for the screenshot')
      }

      const api = getApiClient()
      const result = await api.uploadFile(file, PRESENT)

      return [
        {
          file,
          path: result.data.path,
          hash: result.data.hash,
        },
      ]
    },
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PresentInput>({
    resolver: zodResolver(PresentSchema),
  })

  const watchedUrl = watch('linkedin_url')
  const watchedCaption = watch('caption')

  // Validate LinkedIn URL format
  const isValidLinkedInUrl = (url: string) => {
    if (!url) return false
    const linkedinPattern =
      /^https:\/\/(www\.)?linkedin\.com\/(posts|feed\/update)/
    return linkedinPattern.test(url)
  }

  const handleFileSelect = async (files: File[]) => {
    const results = await handleFileUpload(files)
    const first = results[0]
    if (first && first.path) {
      setValue('screenshot_url', first.path)
    }
  }

  const handleFileRemove = (index: number) => {
    removeFile(index)
    setValue('screenshot_url', undefined)
  }

  const onSubmit = async (data: PresentInput) => {
    await handleFormSubmit(async () => {
      if (!userId) {
        throw new Error(t('validation.missing_file'))
      }

      if (!isValidLinkedInUrl(data.linkedin_url)) {
        throw new Error(t('validation.bad_url'))
      }

      const firstFile = uploadedFiles[0]
      if (uploadedFiles.length === 0 || !firstFile || !firstFile.path) {
        throw new Error(t('validation.missing_file'))
      }

      const payload = {
        linkedin_url: data.linkedin_url,
        caption: data.caption,
        screenshot_url: firstFile.path,
        screenshot_hash: firstFile.hash,
      }

      const api = getApiClient()
      await api.createSubmission({
        activityCode: PRESENT,
        payload,
        attachments: [firstFile.path],
        visibility: makePublic ? 'PUBLIC' : 'PRIVATE',
      })

      // Reset form
      setMakePublic(false)
    })
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Present — Share Your AI Journey
          </h1>
          <p className="text-gray-600">
            Share your AI in education experience on LinkedIn to inspire other
            educators. Earn 20 points for approved posts.
          </p>
        </div>

        {submitStatus && (
          <Alert
            variant={submitStatus.type === 'error' ? 'destructive' : 'default'}
            className="mb-6"
          >
            <AlertTitle>
              {submitStatus.type === 'success' ? 'Success!' : 'Error'}
            </AlertTitle>
            <AlertDescription>{submitStatus.message}</AlertDescription>
          </Alert>
        )}

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              label="LinkedIn Post URL"
              required
              error={
                errors.linkedin_url?.message ||
                (!isValidLinkedInUrl(watchedUrl) && watchedUrl
                  ? 'Please enter a valid LinkedIn post URL'
                  : undefined)
              }
              description="Paste the URL of your LinkedIn post about AI in education"
            >
              <Input
                {...register('linkedin_url')}
                type="url"
                placeholder="https://www.linkedin.com/posts/..."
              />
              {watchedUrl && isValidLinkedInUrl(watchedUrl) && (
                <div className="text-sm text-green-600 mt-1">
                  ✓ Valid LinkedIn URL
                </div>
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
              <FileList files={uploadedFiles} onRemove={handleFileRemove} />
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
                {watchedCaption?.length || 0}/10 characters minimum
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
                <label
                  htmlFor="makePublic"
                  className="text-sm font-medium text-gray-700"
                >
                  Make this submission visible on my public profile
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                When enabled, this submission will be visible to others viewing
                your public profile page.
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
            <li>
              • Posts must be publicly visible on LinkedIn for verification
            </li>
          </ul>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <h4 className="font-medium text-blue-800 text-sm">
              Why Share on LinkedIn?
            </h4>
            <div className="text-xs text-blue-700 mt-1">
              Sharing your AI education experience helps inspire other educators
              and builds your professional network. Your story could motivate
              others to join the movement!
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
