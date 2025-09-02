'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@clerk/nextjs'
import { Button, Input, Textarea, Card, CardContent, FormField, LoadingSpinner, Alert, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@elevate/ui'
import { FileUpload, FileList, UploadedFile } from '@elevate/ui/FileUpload'
import { ExploreSchema, ExploreInput } from '@elevate/types/schemas'

const aiToolOptions = [
  { value: 'ChatGPT', label: 'ChatGPT' },
  { value: 'Copilot', label: 'Microsoft Copilot' },
  { value: 'Claude', label: 'Anthropic Claude' },
  { value: 'Gemini', label: 'Google Gemini' },
  { value: 'Other', label: 'Other AI Tool' },
]

export default function ExploreFormPage() {
  const { userId } = useAuth()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [selectedAiTool, setSelectedAiTool] = useState<string>('')
  const [characterCount, setCharacterCount] = useState(0)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<ExploreInput>({
    resolver: zodResolver(ExploreSchema)
  })

  const watchedReflection = watch('reflection')

  React.useEffect(() => {
    setCharacterCount(watchedReflection?.length || 0)
  }, [watchedReflection])

  const handleFileSelect = async (files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => ({
      file,
      uploading: true
    }))

    setUploadedFiles(prev => [...prev, ...newFiles])

    // Upload each file
    const uploadPromises = files.map(async (file, index) => {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('activityCode', 'EXPLORE')

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Upload failed')
        }

        return {
          file,
          path: result.data.path,
          hash: result.data.hash,
          uploading: false
        }

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
    const successfulPaths = results
      .filter(result => result.path && !result.error)
      .map(result => result.path!)
    
    setValue('evidenceFiles', successfulPaths)
  }

  const handleFileRemove = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index)
    setUploadedFiles(newFiles)
    
    const successfulPaths = newFiles
      .filter(file => file.path && !file.error)
      .map(file => file.path!)
    
    setValue('evidenceFiles', successfulPaths)
  }

  const onSubmit = async (data: ExploreInput) => {
    if (!userId) {
      setSubmitStatus({ type: 'error', message: 'You must be logged in to submit' })
      return
    }

    const successfulFiles = uploadedFiles.filter(file => file.path && !file.error)
    
    if (successfulFiles.length === 0) {
      setSubmitStatus({ type: 'error', message: 'Please upload at least one evidence file' })
      return
    }

    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      const payload = {
        reflection: data.reflection,
        classDate: data.classDate,
        school: data.school || '',
        aiTool: selectedAiTool,
        evidenceFiles: successfulFiles.map(f => f.path!)
      }

      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activityCode: 'EXPLORE',
          payload,
          attachments: successfulFiles.map(f => f.path!)
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed')
      }

      setSubmitStatus({ 
        type: 'success', 
        message: 'Exploration submission successful! Your submission is now under review.' 
      })

      // Reset form
      setUploadedFiles([])
      setSelectedAiTool('')
      
    } catch (error) {
      setSubmitStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to submit exploration'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Explore — AI in the Classroom</h1>
          <p className="text-gray-600">
            Share your experience applying AI tools in your classroom. Earn 50 points for approved submissions.
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
              error={errors.classDate?.message}
              description="When did you implement AI in your classroom?"
            >
              <Input
                {...register('classDate')}
                type="date"
              />
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
                {characterCount}/150 characters {characterCount >= 150 ? '✓' : '(minimum)'}
              </div>
            </FormField>

            <FormField
              label="Evidence Files"
              required
              error={uploadedFiles.some(f => f.error) ? 'Some files failed to upload' : undefined}
              description="Upload photos, screenshots, or documents showing your AI implementation (multiple files allowed)"
            >
              <FileUpload
                onFileSelect={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png"
                multiple={true}
                maxFiles={5}
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
                disabled={
                  isSubmitting || 
                  !selectedAiTool || 
                  characterCount < 150 ||
                  uploadedFiles.filter(f => f.path && !f.error).length === 0
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
            <li>• Share both successes and challenges for authentic reflection</li>
            <li>• Screenshots of AI tool interactions are valuable evidence</li>
            <li>• Review process typically takes 24-48 hours</li>
          </ul>
        </div>
      </div>
    </main>
  )
}