import { render } from '@react-email/render'
import { Resend } from 'resend'

import ApprovalNotificationEmail from './templates/approval-notification'
import RejectionNotificationEmail from './templates/rejection-notification'
import SubmissionConfirmationEmail from './templates/submission-confirmation'
import WeeklyProgressEmail from './templates/weekly-progress'
import WelcomeEmail from './templates/welcome'

// Lazy initialize Resend client to avoid build-time errors when API key is missing
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key || key.length === 0) return null
  return new Resend(key)
}

// Email sender configuration
const FROM_EMAIL =
  process.env.FROM_EMAIL || 'MS Elevate <noreply@leaps.mereka.org>'
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || 'support@leaps.mereka.org'

// Base email sending function
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
) {
  const emailOptions: {
    from: string
    to: string
    subject: string
    html: string
    replyTo: string
    text?: string
  } = {
    from: FROM_EMAIL,
    to,
    subject,
    html,
    replyTo: REPLY_TO_EMAIL,
  }

  if (text) {
    emailOptions.text = text
  }

  const resend = getResend()
  if (!resend) {
    // No-op in environments without RESEND_API_KEY (e.g., CI build)
    return { id: 'noop' } as { id: string }
  }

  const result = await resend.emails.send(emailOptions)
  if (result.error) throw result.error
  return result.data
}

// Welcome Email
export async function sendWelcomeEmail(
  to: string,
  name: string,
  dashboardUrl: string,
) {
  const html = await render(WelcomeEmail({ name, dashboardUrl }))
  const subject = `Selamat datang di MS Elevate LEAPS, ${name}! 🚀`

  return sendEmail(to, subject, html)
}

// Submission Confirmation Email
export async function sendSubmissionConfirmationEmail(
  to: string,
  name: string,
  activityName: string,
  submissionDate: string,
  dashboardUrl: string,
) {
  const html = await render(
    SubmissionConfirmationEmail({
      name,
      activityName,
      submissionDate,
      dashboardUrl,
    }),
  )
  const subject = `Submisi ${activityName} berhasil diterima`

  return sendEmail(to, subject, html)
}

// Approval Notification Email
export async function sendApprovalNotificationEmail(
  to: string,
  name: string,
  activityName: string,
  pointsAwarded: number,
  reviewerNote: string | undefined,
  totalPoints: number,
  leaderboardPosition: number,
  dashboardUrl: string,
  leaderboardUrl: string,
) {
  const props: {
    name: string
    activityName: string
    pointsAwarded: number
    totalPoints: number
    leaderboardPosition: number
    dashboardUrl: string
    leaderboardUrl: string
    reviewerNote?: string
  } = {
    name,
    activityName,
    pointsAwarded,
    totalPoints,
    leaderboardPosition,
    dashboardUrl,
    leaderboardUrl,
  }

  if (reviewerNote) {
    props.reviewerNote = reviewerNote
  }

  const html = await render(ApprovalNotificationEmail(props))
  const subject = `🎉 Submisi ${activityName} Anda disetujui!`

  return sendEmail(to, subject, html)
}

// Rejection Notification Email
export async function sendRejectionNotificationEmail(
  to: string,
  name: string,
  activityName: string,
  reviewerNote: string,
  dashboardUrl: string,
  supportUrl: string,
) {
  const html = await render(
    RejectionNotificationEmail({
      name,
      activityName,
      reviewerNote,
      dashboardUrl,
      supportUrl,
    }),
  )
  const subject = `Submisi ${activityName} memerlukan perbaikan`

  return sendEmail(to, subject, html)
}

// Weekly Progress Email
export async function sendWeeklyProgressEmail(
  to: string,
  name: string,
  weekStartDate: string,
  weekEndDate: string,
  totalPoints: number,
  pointsThisWeek: number,
  completedActivities: string[],
  pendingSubmissions: number,
  leaderboardPosition: number,
  nextSuggestedActivity: string,
  dashboardUrl: string,
  leaderboardUrl: string,
) {
  const html = await render(
    WeeklyProgressEmail({
      name,
      weekStartDate,
      weekEndDate,
      totalPoints,
      pointsThisWeek,
      completedActivities,
      pendingSubmissions,
      leaderboardPosition,
      nextSuggestedActivity,
      dashboardUrl,
      leaderboardUrl,
    }),
  )
  const subject = `Ringkasan Progress LEAPS - Minggu ${weekStartDate}`

  return sendEmail(to, subject, html)
}

// Batch email sending for performance
export async function sendBatchEmails(
  emails: Array<{
    to: string
    subject: string
    html: string
    text?: string
  }>,
): Promise<{ ids: string[] } | null> {
  const resend = getResend()
  if (!resend) {
    // No-op when RESEND_API_KEY is missing
    return { ids: [] }
  }

  const result = await resend.batch.send(
    emails.map((email) => {
      const emailOptions: {
        from: string
        to: string
        subject: string
        html: string
        replyTo: string
        text?: string
      } = {
        from: FROM_EMAIL,
        to: email.to,
        subject: email.subject,
        html: email.html,
        replyTo: REPLY_TO_EMAIL,
      }

      if (email.text) {
        emailOptions.text = email.text
      }

      return emailOptions
    }),
  )

  if (result.error) throw result.error
  // Normalize provider response into { ids: string[] }
  const data: unknown = result.data
  let ids: string[] = []
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v)
  const hasArrayData = (v: unknown): v is { data: unknown[] } =>
    isRecord(v) && Array.isArray((v as Record<string, unknown>).data)
  const hasIdsArray = (v: unknown): v is { ids: unknown[] } =>
    isRecord(v) && Array.isArray((v as Record<string, unknown>).ids)
  const toIds = (arr: unknown[]): string[] =>
    arr
      .map((item) =>
        typeof item === 'string'
          ? item
          : isRecord(item) && typeof item.id === 'string'
          ? item.id
          : undefined,
      )
      .filter((v): v is string => typeof v === 'string' && v.length > 0)

  if (hasArrayData(data)) {
    // Shape: { data: Array<string | { id: string }> }
    ids = toIds(data.data)
  } else if (Array.isArray(data)) {
    // Shape: Array<string | { id: string }>
    ids = toIds(data as unknown[])
  } else if (hasIdsArray(data)) {
    ids = toIds(data.ids)
  }
  return { ids }
}

// Email validation utility
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Export templates for preview/testing
export {
  WelcomeEmail,
  SubmissionConfirmationEmail,
  ApprovalNotificationEmail,
  RejectionNotificationEmail,
  WeeklyProgressEmail,
}
