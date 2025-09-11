'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CSRF_TOKEN_HEADER } from '@elevate/security/csrf'
import { useAuth } from '@clerk/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'

import { useFormSubmission, useFileUpload } from '@elevate/forms'
import { EXPLORE } from '@elevate/types'
import { ExploreSchema, type ExploreInput } from '@elevate/types/schemas'
import {
  Button,
  Input,
  Textarea,
  Card,
  Alert,
  AlertTitle,
  AlertDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@elevate/ui'
import { FormField, LoadingSpinner, FileUpload, FileList } from '@elevate/ui/blocks'
import { useCurrentLocale } from '@elevate/ui/next'

import { CSRF_TOKEN_HEADER } from '@elevate/security/csrf'

const aiToolOptions = [
  { value: 'ChatGPT', label: 'ChatGPT' },
  { value: 'Copilot', label: 'Microsoft Copilot' },
  { value: 'Claude', label: 'Anthropic Claude' },
  { value: 'Gemini', label: 'Google Gemini' },
  { value: 'Other', label: 'Other AI Tool' },
]

export default function ExploreFormPage() {
  const router = useRouter()
  const { withLocale } = useCurrentLocale()
  const t = useTranslations('homepage')
  const { userId } = useAuth()
  const [selectedAiTool, setSelectedAiTool] = useState<string>('')
  const [characterCount, setCharacterCount] = useState(0)

  const { isSubmitting, submitStatus, handleSubmit: handleFormSubmit } = useFormSubmission({
    successMessage: 'Exploration submission successful! Your submission is now under review.'
  })
  
  const { uploadedFiles, handleFileSelect: handleFileUpload, removeFile, successfulUploads } = useFileUpload({
    maxFiles: 5,
    onUpload: async (files) => {
      const uploadPromises = files.map(async (file) => {
        try {
          const form = new FormData()
          form.append('file', file)
          form.append('activityCode', EXPLORE)
          const resp = await fetch('/api/files/upload', { method: 'POST', body: form })
          if (!resp.ok) throw new Error('Upload failed')
          const result = (await resp.json()) as { data?: { path: string; hash: string } }
          return {
            file,
            path: result.data.path,
            hash: result.data.hash,
          }
        } catch (error) {
          return {
            file,
            error: error instanceof Error ? error.message : 'Upload failed',
          }
        }
      })
      return Promise.all(uploadPromises)
    }
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExploreInput>({
    resolver: zodResolver(ExploreSchema),
  })

  const watchedReflection = watch('reflection')

  React.useEffect(() => {
    setCharacterCount(watchedReflection?.length || 0)
  }, [watchedReflection])

  const handleFileSelect = async (files: File[]) => {
    const results = await handleFileUpload(files)
    setValue('evidence_files', results.map((r) => r.path))
  }

  const handleFileRemove = (index: number) => {
    removeFile(index)
    setValue('evidence_files', successfulUploads.map((f) => f.path))
  }

  const onSubmit = async (data: ExploreInput) => {
    await handleFormSubmit(async () => {
      if (!userId) {
        throw new Error(t('validation.missing_file'))
      }

      if (successfulUploads.length === 0) {
        throw new Error(t('validation.missing_file'))
      }

      const payload = {
        reflection: data.reflection,
        classDate: data.class_date,
        school: data.school,
        evidenceFiles: successfulUploads.map((f) => f.path),
      }

      const tokenRes = await fetch('/api/csrf-token')
      const tokenJson = (await tokenRes.json().catch(() => ({}))) as { data?: { token?: string } }
      const token = tokenJson?.data?.token
      const resp = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', [CSRF_TOKEN_HEADER]: String(token || '') },
        body: JSON.stringify({
          activityCode: EXPLORE,
          payload,
          attachments: successfulUploads.map((f) => f.path),
          visibility: 'PRIVATE',
        }),
      })
      if (!resp.ok) throw new Error('Submission failed')

      // Reset form
      setSelectedAiTool('')
    })
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Explore — AI in the Classroom
          </h1>
          <p className="text-gray-600">
            Share your experience applying AI tools in your classroom. Earn 50
            points for approved submissions.
          </p>
        </div>

        <Alert className="mb-6">
          <AlertTitle>Tips</AlertTitle>
          <AlertDescription>
            Include clear reflections and evidence files (lesson plans, screenshots). Quality over quantity helps reviews.
          </AlertDescription>
        </Alert>

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
              label="AI Tool Used"
              required
              description="Which AI tool did you use in your classroom?"
            >
              <Select value={selectedAiTool} onValueChange={setSelectedAiTool}>
                <SelectTrigger>
                  <SelectValue placeholder="Select the AI tool you used" />
                </SelectTrigger>
                <SelectContent>
                  {aiToolOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Class Date"
              required
              error={errors.class_date?.message}
              description="When did you implement AI in your classroom?"
            >
              <Input {...register('class_date')} type="date" />
            </FormField>

            <FormField
              label="School (Optional)"
              error={errors.school?.message}
              description="Name of your school or institution"
            >
              <Input
                {...register('school')}
                placeholder="e.g. SMA Negeri 1 Jakarta"
              />
            </FormField>

            <FormField
              label="Reflection"
              required
              error={errors.reflection?.message}
              description="Describe your experience using AI in the classroom (minimum 150 characters)"
            >
              <Textarea
                {...register('reflection')}
                placeholder="Share details about how you used AI tools, what worked well, challenges faced, student reactions, and lessons learned..."
                rows={6}
              />
              <div className="text-right text-sm text-gray-500 mt-1">
                {characterCount}/150 characters{' '}
                {characterCount >= 150 ? '✓' : '(minimum)'}
              </div>
            </FormField>

            <FormField
              label="Evidence Files"
              required
              error={
                uploadedFiles.some((f) => f.error)
                  ? 'Some files failed to upload'
                  : undefined
              }
              description="Upload photos, screenshots, or documents showing your AI implementation (multiple files allowed)"
            >
              <FileUpload
                onFileSelect={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png"
                multiple={true}
                maxFiles={5}
                disabled={isSubmitting}
              />
              <FileList files={uploadedFiles} onRemove={handleFileRemove} />
            </FormField>

            <div className="pt-4 border-t border-gray-200">
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !selectedAiTool ||
                  characterCount < 150 ||
                  successfulUploads.length === 0
                }
                className="w-full"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <LoadingSpinner size="sm" />
                    <span>Submitting...</span>
                  </div>
                ) : (
                  'Submit Exploration'
                )}
              </Button>
            </div>
          </form>
        </Card>

        <div className="mt-6 text-sm text-gray-500">
          <h3 className="font-medium text-gray-700 mb-2">Submission Tips:</h3>
          <ul className="space-y-1">
            <li>• Include specific examples of how students engaged with AI</li>
            <li>• Upload photos of classroom activities or student work</li>
            <li>
              • Share both successes and challenges for authentic reflection
            </li>
            <li>• Screenshots of AI tool interactions are valuable evidence</li>
            <li>• Review process typically takes 24-48 hours</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
  // Gate: students -> educators-only; unconfirmed educators -> onboarding
  useEffect(() => {
    const guard = async () => {
      try {
        const res = await fetch('/api/profile/me')
        if (!res.ok) return
        const me = (await res.json()) as { data?: { userType?: 'EDUCATOR' | 'STUDENT'; userTypeConfirmed?: boolean } }
        if (me?.data?.userType === 'STUDENT') {
          router.push(withLocale('/educators-only'))
          return
        }
        if (me?.data?.userTypeConfirmed === false) {
          router.push(withLocale('/onboarding/user-type'))
          return
        }
      } catch { /* noop */ }
    }
    void guard()
  }, [router, withLocale])
