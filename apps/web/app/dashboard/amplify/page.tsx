'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@clerk/nextjs'
import { Button } from '@elevate/ui'
import { Input } from '@elevate/ui/Input'
import { Card } from '@elevate/ui/Card'
import { FormField, LoadingSpinner, Alert } from '@elevate/ui/FormField'
import { FileUpload, FileList, UploadedFile } from '@elevate/ui/FileUpload'
import { AmplifySchema, AmplifyInput } from '@elevate/types/schemas'

export default function AmplifyFormPage() {
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
  } = useForm<AmplifyInput>({
    resolver: zodResolver(AmplifySchema),
    defaultValues: {
      peersTrained: 0,
      studentsTrained: 0
    }
  })

  const watchedPeers = watch('peersTrained')
  const watchedStudents = watch('studentsTrained')

  // Calculate potential points (2 points per peer, 1 point per student)
  const calculatePoints = () => {
    const peersPoints = Math.min(watchedPeers || 0, 50) * 2
    const studentsPoints = Math.min(watchedStudents || 0, 200) * 1
    return peersPoints + studentsPoints
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
        formData.append('activityCode', 'AMPLIFY')

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
        console.error('Upload error:', error)
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
    
    setValue('attendanceProofFiles', successfulPaths)
  }

  const handleFileRemove = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index)
    setUploadedFiles(newFiles)
    
    const successfulPaths = newFiles
      .filter(file => file.path && !file.error)
      .map(file => file.path!)
    
    setValue('attendanceProofFiles', successfulPaths)
  }

  const onSubmit = async (data: AmplifyInput) => {
    if (!userId) {
      setSubmitStatus({ type: 'error', message: 'You must be logged in to submit' })
      return
    }

    const successfulFiles = uploadedFiles.filter(file => file.path && !file.error)
    
    if (successfulFiles.length === 0) {
      setSubmitStatus({ type: 'error', message: 'Please upload at least one attendance proof file' })
      return
    }

    if ((data.peersTrained || 0) + (data.studentsTrained || 0) === 0) {
      setSubmitStatus({ type: 'error', message: 'Please train at least one peer or student' })
      return
    }

    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      const payload = {
        peersTrained: Math.min(data.peersTrained || 0, 50),
        studentsTrained: Math.min(data.studentsTrained || 0, 200),
        attendanceProofFiles: successfulFiles.map(f => f.path!)
      }

      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activityCode: 'AMPLIFY',
          payload,
          attachments: successfulFiles.map(f => f.path!)
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed')
      }

      const potentialPoints = calculatePoints()
      
      setSubmitStatus({ 
        type: 'success', 
        message: `Amplify submission successful! You could earn up to ${potentialPoints} points once approved.` 
      })

      // Reset form
      setUploadedFiles([])
      
    } catch (error) {
      console.error('Submission error:', error)
      setSubmitStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to submit amplify activity'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Amplify — Train Peers & Students</h1>
          <p className="text-gray-600">
            Share your AI knowledge by training peers and students. Earn 2 points per peer (max 50) and 1 point per student (max 200).
          </p>
        </div>

        {submitStatus && (
          <Alert 
            type={submitStatus.type} 
            className="mb-6"
            title={submitStatus.type === 'success' ? 'Success!' : 'Error'}
          >
            {submitStatus.message}
          </Alert>
        )}

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Peers Trained"
                required
                error={errors.peersTrained?.message}
                description="Number of fellow educators trained (max 50)"
              >
                <Input
                  {...register('peersTrained')}
                  type="number"
                  min={0}
                  max={50}
                  placeholder="0"
                  error={!!errors.peersTrained}
                />
              </FormField>

              <FormField
                label="Students Trained"
                required
                error={errors.studentsTrained?.message}
                description="Number of students trained (max 200)"
              >
                <Input
                  {...register('studentsTrained')}
                  type="number"
                  min={0}
                  max={200}
                  placeholder="0"
                  error={!!errors.studentsTrained}
                />
              </FormField>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Potential Points</h3>
              <div className="text-sm text-blue-700">
                <div>Peers: {Math.min(watchedPeers || 0, 50)} × 2 = {Math.min(watchedPeers || 0, 50) * 2} points</div>
                <div>Students: {Math.min(watchedStudents || 0, 200)} × 1 = {Math.min(watchedStudents || 0, 200) * 1} points</div>
                <div className="font-medium border-t border-blue-300 mt-2 pt-2">
                  Total: {calculatePoints()} points
                </div>
              </div>
            </div>

            <FormField
              label="Attendance Proof"
              required
              error={uploadedFiles.some(f => f.error) ? 'Some files failed to upload' : undefined}
              description="Upload photos, certificates, or documents proving the training sessions occurred"
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
                  ((watchedPeers || 0) + (watchedStudents || 0) === 0) ||
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
                  `Submit Training (${calculatePoints()} potential points)`
                )}
              </Button>
            </div>
          </form>
        </Card>

        <div className="mt-6 text-sm text-gray-500">
          <h3 className="font-medium text-gray-700 mb-2">Submission Guidelines:</h3>
          <ul className="space-y-1">
            <li>• Provide honest counts of people trained</li>
            <li>• Include photos of training sessions or workshops</li>
            <li>• Upload certificates or attendance lists as proof</li>
            <li>• Each submission is subject to 7-day rolling limits</li>
            <li>• Gaming prevention measures are in place</li>
          </ul>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <h4 className="font-medium text-yellow-800 text-sm">Anti-Gaming Measures</h4>
            <div className="text-xs text-yellow-700 mt-1">
              Maximum 50 peers and 200 students per submission. Submissions are tracked over 7-day rolling periods to prevent abuse.
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}