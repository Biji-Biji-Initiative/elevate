'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@clerk/nextjs'
import { Button, Input, Card, CardContent, FormField, LoadingSpinner, Alert, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@elevate/ui'
import { FileUpload, FileList, UploadedFile } from '@elevate/ui/FileUpload'
import { LearnSchema, LearnInput } from '@elevate/types/schemas'

const providerOptions = [
  { value: 'SPL', label: 'SPL (School of Professional Learning)' },
  { value: 'ILS', label: 'ILS (Integrated Learning Solutions)' },
]

export default function LearnFormPage() {
  const { userId } = useAuth()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<LearnInput>({
    resolver: zodResolver(LearnSchema)
  })

  const watchedProvider = watch('provider')

  const handleFileSelect = async (files: File[]) => {
    const file = files[0] // Only allow one certificate file
    
    const newUploadedFile: UploadedFile = {
      file,
      uploading: true
    }

    setUploadedFiles([newUploadedFile])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('activityCode', 'LEARN')

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      // Update the file with upload results
      setUploadedFiles([{
        file,
        path: result.data.path,
        hash: result.data.hash,
        uploading: false
      }])

      // Update form value
      setValue('certificateFile', result.data.path)

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
    setValue('certificateFile', undefined)
  }

  const onSubmit = async (data: LearnInput) => {
    if (!userId) {
      setSubmitStatus({ type: 'error', message: 'You must be logged in to submit' })
      return
    }

    if (uploadedFiles.length === 0 || !uploadedFiles[0].path) {
      setSubmitStatus({ type: 'error', message: 'Please upload a certificate file' })
      return
    }

    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      const payload = {
        provider: data.provider,
        course: data.course,
        completedAt: data.completedAt,
        certificateFile: uploadedFiles[0].path,
        certificateHash: uploadedFiles[0].hash
      }

      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activityCode: 'LEARN',
          payload,
          attachments: [uploadedFiles[0].path]
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed')
      }

      setSubmitStatus({ 
        type: 'success', 
        message: 'Certificate submitted successfully! Your submission is now under review.' 
      })

      // Reset form
      setUploadedFiles([])
      
    } catch (error) {
      setSubmitStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to submit certificate'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Learn — Submit Certificate</h1>
          <p className="text-gray-600">
            Upload your completion certificate to earn 20 points. Certificates are verified for authenticity.
          </p>
        </div>

        {submitStatus && (
          <Alert 
            variant={submitStatus.type === 'error' ? 'destructive' : 'default'} 
            className="mb-6"
          >
            <h4 className="font-semibold">{submitStatus.type === 'success' ? 'Success!' : 'Error'}</h4>
            {submitStatus.message}
          </Alert>
        )}

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              label="Training Provider"
              required
              error={errors.provider?.message}
            >
              <Select value={watchedProvider || ''} onValueChange={(value) => setValue('provider', value as 'SPL' | 'ILS')}>
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
              error={errors.course?.message}
              description="Enter the full name of the course you completed"
            >
              <Input
                {...register('course')}
                placeholder="e.g. AI in Education Fundamentals"
                error={!!errors.course}
              />
            </FormField>

            <FormField
              label="Completion Date"
              required
              error={errors.completedAt?.message}
            >
              <Input
                {...register('completedAt')}
                type="date"
                error={!!errors.completedAt}
              />
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
              <FileList 
                files={uploadedFiles} 
                onRemove={handleFileRemove}
              />
            </FormField>

            <div className="pt-4 border-t border-gray-200">
              <Button 
                type="submit" 
                disabled={isSubmitting || uploadedFiles.length === 0 || !!uploadedFiles[0]?.error}
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
          <h3 className="font-medium text-gray-700 mb-2">Submission Guidelines:</h3>
          <ul className="space-y-1">
            <li>• Certificates must be from approved training providers (SPL or ILS)</li>
            <li>• Files should be clear and readable</li>
            <li>• Duplicate certificates will be automatically detected</li>
            <li>• Review process typically takes 24-48 hours</li>
          </ul>
        </div>
      </div>
    </main>
  )
}