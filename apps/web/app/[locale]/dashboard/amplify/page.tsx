'use client'
/* eslint-disable @typescript-eslint/no-unsafe-call */

import React from 'react'
import { useAuth } from '@clerk/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { CSRF_TOKEN_HEADER } from '@elevate/security/constants'

import { useFormSubmission, useFileUpload } from '@elevate/forms'
import { AMPLIFY } from '@elevate/types'
import { computeAmplifyPoints, activityCanon } from '@elevate/types/activity-canon'
import { AmplifySchema, type AmplifyInput } from '@elevate/types/schemas'
import { Button, Input, Card, Alert, AlertTitle, AlertDescription, Textarea } from '@elevate/ui'
import { FormField, LoadingSpinner, FileUpload, FileList } from '@elevate/ui/blocks'
import { useEducatorGuard } from '@/hooks/useEducatorGuard'
import { safeJsonParse } from '@/lib/utils/safe-json'

//

export default function AmplifyFormPage() {
  useEducatorGuard()
  const { userId } = useAuth()

  const { isSubmitting, submitStatus, handleSubmit: handleFormSubmit, setSubmitStatus } = useFormSubmission({
    successMessage: 'Amplify submission successful! You could earn points once approved.'
  })
  
  const { uploadedFiles, handleFileSelect: handleFileUpload, removeFile, successfulUploads } = useFileUpload({
    maxFiles: 5,
    onUpload: async (files) => {
      const uploadPromises = files.map(async (file) => {
        try {
          const form = new FormData()
          form.append('file', file)
          form.append('activityCode', AMPLIFY)
          const resp = await fetch('/api/files/upload', { method: 'POST', body: form })
          if (!resp.ok) throw new Error('Upload failed')
          const text = await resp.text()
          type UploadResp = { data?: { path: string; hash: string } }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const parsed: UploadResp | undefined = safeJsonParse<UploadResp>(text)
          const { data } = (parsed ?? {}) as UploadResp
          if (!data) throw new Error('Malformed upload response')
          return { file, path: data.path, hash: data.hash }
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
  } = useForm<AmplifyInput>({
    resolver: zodResolver(AmplifySchema),
    defaultValues: {
      peers_trained: 0,
      students_trained: 0,
      session_date: new Date().toISOString().slice(0, 10),
    },
  })

  

  const watchedPeers = watch('peers_trained')
  const watchedStudents = watch('students_trained')

  // Canonical potential points using activity canon
  const maxPeers = activityCanon.amplify.limits.weeklyPeers
  const maxStudents = activityCanon.amplify.limits.weeklyStudents
  const peersCoef = activityCanon.amplify.peersCoefficient
  const studentsCoef = activityCanon.amplify.studentsCoefficient

  const calculatePoints = () => {
    const peers = Math.min(watchedPeers || 0, maxPeers)
    const students = Math.min(watchedStudents || 0, maxStudents)
    return computeAmplifyPoints(peers, students)
  }

  const handleFileSelect = async (files: File[]) => {
    const results = await handleFileUpload(files)
    setValue('attendance_proof_files', results.map((r) => r.path))
  }

  const handleFileRemove = (index: number) => {
    removeFile(index)
    setValue('attendance_proof_files', successfulUploads.map((f) => f.path))
  }

  const submit = (handleFormSubmit as unknown as (fn: () => Promise<void>) => Promise<void>)
  const onSubmit = async (data: AmplifyInput) => {
    const potentialPoints = calculatePoints()
    
    try {
      await submit(async () => {
        if (!userId) {
          throw new Error('You must be logged in to submit')
        }

        if (successfulUploads.length === 0) {
          throw new Error('Please upload at least one attendance proof file')
        }

        if ((data.peers_trained || 0) + (data.students_trained || 0) === 0) {
          throw new Error('Please train at least one peer or student')
        }

        const payload: {
          peersTrained: number
          studentsTrained: number
          attendanceProofFiles: string[]
          sessionDate: string
          sessionStartTime?: string
          durationMinutes?: number
          location?: { venue?: string; city?: string; country?: string }
          sessionTitle?: string
          coFacilitators?: string[]
          evidenceNote?: string
        } = {
          peersTrained: Math.min(data.peers_trained || 0, maxPeers),
          studentsTrained: Math.min(data.students_trained || 0, maxStudents),
          attendanceProofFiles: successfulUploads.map((f) => f.path),
          sessionDate: data.session_date || new Date().toISOString().slice(0, 10),
        }

        // Optional fields (only include if provided)
        if (data.session_start_time) payload.sessionStartTime = data.session_start_time
        if (typeof data.duration_minutes === 'number' && !Number.isNaN(data.duration_minutes)) {
          payload.durationMinutes = data.duration_minutes
        }
        const loc = watch('location') as AmplifyInput['location'] | undefined
        if (loc) {
          const location: { venue?: string; city?: string; country?: string } = {}
          if (loc.venue) location.venue = loc.venue
          if (loc.city) location.city = loc.city
          if (loc.country) location.country = loc.country
          if (Object.keys(location).length > 0) payload.location = location
        }
        const sessionTitle = watch('session_title') as string | undefined
        if (sessionTitle) payload.sessionTitle = sessionTitle
        const coFacilitatorsRaw = (watch('co_facilitators') as string | undefined) || ''
        const coFacilitators = coFacilitatorsRaw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
        if (coFacilitators.length > 0) payload.coFacilitators = coFacilitators
        const evidenceNote = watch('evidence_note') as string | undefined
        if (evidenceNote) payload.evidenceNote = evidenceNote

        const tokenRes = await fetch('/api/csrf-token')
        const tokenText = await tokenRes.text().catch(() => '')
        type TokenResp = { data?: { token?: string } }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const parsedToken: TokenResp | undefined = safeJsonParse<TokenResp>(tokenText)
        const token = ((parsedToken ?? {}) as TokenResp).data?.token
        const resp = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', [CSRF_TOKEN_HEADER]: String(token || '') },
          body: JSON.stringify({
            activityCode: AMPLIFY,
            payload,
            attachments: successfulUploads.map((f) => f.path),
            visibility: 'PRIVATE',
          }),
        })
        if (!resp.ok) throw new Error('Submission failed')
      })
      
      // Override success message with points info
      setSubmitStatus({
        type: 'success',
        message: `Amplify submission successful! You could earn up to ${potentialPoints} points once approved.`
      })
    } catch (error) {
      // Error already handled by handleFormSubmit
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Amplify — Train Peers & Students
          </h1>
          <p className="text-gray-600">
            Share your AI knowledge by training peers and students. Earn 2
            points per peer (max 50) and 1 point per student (max 200).
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Peers Trained"
                required
                error={errors.peers_trained?.message}
                description="Number of fellow educators trained (max 50)"
              >
                <Input
                  {...register('peers_trained', { valueAsNumber: true })}
                  type="number"
                  min={0}
                  max={50}
                  placeholder="0"
                />
              </FormField>

              <FormField
                label="Students Trained"
                required
                error={errors.students_trained?.message}
                description="Number of students trained (max 200)"
              >
                <Input
                  {...register('students_trained', { valueAsNumber: true })}
                  type="number"
                  min={0}
                  max={200}
                  placeholder="0"
                />
              </FormField>

              <FormField
                label="Session Date"
                required
                error={errors.session_date?.message}
                description="Date of the training session"
              >
                <Input
                  {...register('session_date')}
                  type="date"
                />
              </FormField>

              <FormField
                label="Session Start Time"
                error={errors.session_start_time?.message}
                description="When did the session start? (optional)"
              >
                <Input
                  {...register('session_start_time')}
                  type="time"
                />
              </FormField>

              <FormField
                label="Duration (minutes)"
                error={errors.duration_minutes?.message}
                description="Length of the session in minutes (optional)"
              >
                <Input
                  {...register('duration_minutes', { valueAsNumber: true })}
                  type="number"
                  min={0}
                  placeholder="e.g. 90"
                />
              </FormField>

              <FormField
                label="Venue"
                description="Location details (optional)"
              >
                <Input
                  {...register('location.venue')}
                  placeholder="e.g. Auditorium"
                />
              </FormField>

              <FormField label="City" description="Optional">
                <Input
                  {...register('location.city')}
                  placeholder="e.g. Jakarta"
                />
              </FormField>

              <FormField label="Country" description="Optional">
                <Input
                  {...register('location.country')}
                  placeholder="e.g. Indonesia"
                />
              </FormField>

              <FormField
                label="Session Title"
                description="Give your training a short title (optional)"
              >
                <Input
                  {...register('session_title')}
                  placeholder="e.g. AI in Education Workshop"
                />
              </FormField>

              <FormField
                label="Co‑facilitators"
                description="Comma‑separated list of names (optional)"
              >
                <Input
                  {...register('co_facilitators')}
                  placeholder="e.g. Rina S., Budi P."
                />
              </FormField>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">
                Potential Points
              </h3>
              <div className="text-sm text-blue-700">
                <div>
                  Peers: {Math.min(watchedPeers || 0, maxPeers)} × {peersCoef} ={' '}
                  {Math.min(watchedPeers || 0, maxPeers) * peersCoef} points
                </div>
                <div>
                  Students: {Math.min(watchedStudents || 0, maxStudents)} × {studentsCoef} ={' '}
                  {Math.min(watchedStudents || 0, maxStudents) * studentsCoef} points
                </div>
                <div className="font-medium border-t border-blue-300 mt-2 pt-2">
                  Total: {calculatePoints()} points
                </div>
              </div>
            </div>

            <FormField
              label="Attendance Proof"
              required
              error={
                uploadedFiles.some((f) => f.error)
                  ? 'Some files failed to upload'
                  : undefined
              }
              description="Upload photos, certificates, or documents proving the training sessions occurred"
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

            <FormField
              label="Notes"
              description="Context or evidence notes (optional)"
            >
              <Textarea
                {...register('evidence_note')}
                placeholder="Add any context or references that help reviewers"
                rows={3}
              />
            </FormField>

            <div className="pt-4 border-t border-gray-200">
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  (watchedPeers || 0) + (watchedStudents || 0) === 0 ||
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
                  `Submit Training (${calculatePoints()} potential points)`
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
            <li>• Provide honest counts of people trained</li>
            <li>• Include photos of training sessions or workshops</li>
            <li>• Upload certificates or attendance lists as proof</li>
            <li>• Each submission is subject to 7-day rolling limits</li>
            <li>• Gaming prevention measures are in place</li>
          </ul>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <h4 className="font-medium text-yellow-800 text-sm">
              Anti-Gaming Measures
            </h4>
            <div className="text-xs text-yellow-700 mt-1">
              Maximum 50 peers and 200 students per submission. Submissions are
              tracked over 7-day rolling periods to prevent abuse.
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
