import { Resend } from 'resend';
import { render } from '@react-email/render';
import WelcomeEmail from './templates/welcome';
import SubmissionConfirmationEmail from './templates/submission-confirmation';
import ApprovalNotificationEmail from './templates/approval-notification';
import RejectionNotificationEmail from './templates/rejection-notification';
import WeeklyProgressEmail from './templates/weekly-progress';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Email sender configuration
const FROM_EMAIL = process.env.FROM_EMAIL || 'MS Elevate <noreply@leaps.mereka.org>';
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || 'support@leaps.mereka.org';

// Base email sending function
async function sendEmail(to: string, subject: string, html: string, text?: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
      replyTo: REPLY_TO_EMAIL,
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    throw error;
  }
}

// Welcome Email
export async function sendWelcomeEmail(to: string, name: string, dashboardUrl: string) {
  const html = await render(WelcomeEmail({ name, dashboardUrl }));
  const subject = `Selamat datang di MS Elevate LEAPS, ${name}! 🚀`;
  
  return sendEmail(to, subject, html);
}

// Submission Confirmation Email
export async function sendSubmissionConfirmationEmail(
  to: string, 
  name: string, 
  activityName: string, 
  submissionDate: string, 
  dashboardUrl: string
) {
  const html = await render(SubmissionConfirmationEmail({ 
    name, 
    activityName, 
    submissionDate, 
    dashboardUrl 
  }));
  const subject = `Submisi ${activityName} berhasil diterima`;
  
  return sendEmail(to, subject, html);
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
  leaderboardUrl: string
) {
  const html = await render(ApprovalNotificationEmail({ 
    name, 
    activityName, 
    pointsAwarded,
    reviewerNote,
    totalPoints,
    leaderboardPosition,
    dashboardUrl,
    leaderboardUrl
  }));
  const subject = `🎉 Submisi ${activityName} Anda disetujui!`;
  
  return sendEmail(to, subject, html);
}

// Rejection Notification Email
export async function sendRejectionNotificationEmail(
  to: string,
  name: string,
  activityName: string,
  reviewerNote: string,
  dashboardUrl: string,
  supportUrl: string
) {
  const html = await render(RejectionNotificationEmail({ 
    name, 
    activityName, 
    reviewerNote,
    dashboardUrl,
    supportUrl
  }));
  const subject = `Submisi ${activityName} memerlukan perbaikan`;
  
  return sendEmail(to, subject, html);
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
  leaderboardUrl: string
) {
  const html = await render(WeeklyProgressEmail({ 
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
    leaderboardUrl
  }));
  const subject = `Ringkasan Progress LEAPS - Minggu ${weekStartDate}`;
  
  return sendEmail(to, subject, html);
}

// Batch email sending for performance
export async function sendBatchEmails(emails: Array<{
  to: string;
  subject: string;
  html: string;
  text?: string;
}>) {
  try {
    const { data, error } = await resend.batch.send(
      emails.map(email => ({
        from: FROM_EMAIL,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        reply_to: REPLY_TO_EMAIL,
      }))
    );

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    throw error;
  }
}

// Email validation utility
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Export templates for preview/testing
export {
  WelcomeEmail,
  SubmissionConfirmationEmail,
  ApprovalNotificationEmail,
  RejectionNotificationEmail,
  WeeklyProgressEmail,
};