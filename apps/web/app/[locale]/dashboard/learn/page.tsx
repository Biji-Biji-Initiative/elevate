'use client'

import React from 'react'

import { useAuth } from '@clerk/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { useFormSubmission, useFileUpload } from '@elevate/forms'
import { VISIBILITY_OPTIONS, LEARN } from '@elevate/types'
import { LearnSchema, type LearnInput } from '@elevate/types/schemas'
import {
  Button,
  Input,
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

import { getApiClient } from '../../../../lib/api-client'

const providerOptions = [
  { value: 'SPL', label: 'SPL (School of Professional Learning)' },
  { value: 'ILS', label: 'ILS (Integrated Learning Solutions)' },
]

export default function LearnFormPage() {
  const { userId } = useAuth()
  
  const { isSubmitting, submitStatus, handleSubmit: handleFormSubmit } = useFormSubmission({
    successMessage: 'Certificate submitted successfully! Your submission is now under review.'
  })
  
  const { uploadedFiles, handleFileSelect: handleFileUpload, removeFile } = useFileUpload({
    maxFiles: 1,
    onUpload: async (files) => {
      if (files.length === 0 || !files[0]) return []
      const file = files[0]
      const api = getApiClient()
      const result = await api.uploadFile(file, LEARN)

      return [{
        file,
        path: result.data.path,
        hash: result.data.hash,
      }]
    }
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LearnInput>({
    resolver: zodResolver(LearnSchema),
  })

  // Accessing provider ensures validation feedback; value not used elsewhere
  watch('provider')

  const handleFileSelect = async (files: File[]) => {
    const results = await handleFileUpload(files)
    if (results.length > 0) {
      setValue('certificate_url', results[0].path)
    }
  }

  const handleFileRemove = (index: number) => {
    removeFile(index)
    setValue('certificate_url', undefined)
  }

  const onSubmit = async (data: LearnInput) => {
    await handleFormSubmit(async () => {
      if (!userId) {
        throw new Error('You must be logged in to submit')
      }

      const firstFile = uploadedFiles[0]
      if (uploadedFiles.length === 0 || !firstFile || !firstFile.path) {
        throw new Error('Please upload a certificate file')
      }

      const payload = {
        provider: data.provider,
        course_name: data.course_name,
        completed_at: data.completed_at,
        certificate_url: firstFile.path,
        certificate_hash: firstFile.hash,
      }

      const api = getApiClient()
      await api.createSubmission({
        activityCode: LEARN,
        payload,
        attachments: [firstFile.path],
        visibility: VISIBILITY_OPTIONS[0], // PRIVATE
      })
    })
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Learn — Submit Certificate
          </h1>
          <p className="text-gray-600">
            Upload your completion certificate to earn 20 points. Certificates
            are verified for authenticity.
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
              label="Training Provider"
              required
              error={errors.provider?.message}
            >
              <Select
                value={watchedProvider || ''}
                onValueChange={(value) => {
                  if (value === 'SPL' || value === 'ILS') {
                    setValue('provider', value)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your training provider" />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Course Name"
              required
              error={errors.course_name?.message}
              description="Enter the full name of the course you completed"
            >
              <Input
                {...register('course_name')}
                placeholder="e.g. AI in Education Fundamentals"
              />
            </FormField>

            <FormField
              label="Completion Date"
              required
              error={errors.completed_at?.message}
            >
              <Input {...register('completed_at')} type="date" />
            </FormField>

            <FormField
              label="Certificate File"
              required
              error={uploadedFiles[0]?.error}
              description="Upload your completion certificate (PDF, JPG, or PNG, max 10MB)"
            >
              <FileUpload
                onFileSelect={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png"
                maxFiles={1}
                disabled={isSubmitting}
              />
              <FileList files={uploadedFiles} onRemove={handleFileRemove} />
            </FormField>

            <div className="pt-4 border-t border-gray-200">
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
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
                  'Submit Certificate'
                )}
              </Button>
            </div>
          </form>
        </Card>

        <div className="mt-6 text-sm text-gray-500">
          <h3 className="font-medium text-gray-700 mb-2">
            Submission Guidelines:
          </h3>
          <ul className="space-y-1">
            <li>
              • Certificates must be from approved training providers (SPL or
              ILS)
            </li>
            <li>• Files should be clear and readable</li>
            <li>• Duplicate certificates will be automatically detected</li>
            <li>• Review process typically takes 24-48 hours</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
