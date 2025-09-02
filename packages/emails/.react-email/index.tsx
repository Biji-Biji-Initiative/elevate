import React from 'react';
import WelcomeEmail from '../src/templates/welcome';
import SubmissionConfirmationEmail from '../src/templates/submission-confirmation';
import ApprovalNotificationEmail from '../src/templates/approval-notification';
import RejectionNotificationEmail from '../src/templates/rejection-notification';
import WeeklyProgressEmail from '../src/templates/weekly-progress';

// Sample data for email previews
const sampleUser = {
  name: 'Sari Dewi',
  email: 'sari.dewi@example.com',
};

const dashboardUrl = 'https://leaps.mereka.org/dashboard';
const leaderboardUrl = 'https://leaps.mereka.org/leaderboard';
const supportUrl = 'https://leaps.mereka.org/support';

export default function EmailPreview() {
  return (
    <div>
      <h1>Email Templates Preview</h1>
      
      <section>
        <h2>Welcome Email</h2>
        <WelcomeEmail 
          name={sampleUser.name}
          dashboardUrl={dashboardUrl}
        />
      </section>

      <section>
        <h2>Submission Confirmation</h2>
        <SubmissionConfirmationEmail 
          name={sampleUser.name}
          activityName="Learn - AI Foundations"
          submissionDate="2 September 2024"
          dashboardUrl={dashboardUrl}
        />
      </section>

      <section>
        <h2>Approval Notification</h2>
        <ApprovalNotificationEmail 
          name={sampleUser.name}
          activityName="Learn - AI Foundations"
          pointsAwarded={20}
          reviewerNote="Sertifikat lengkap dan sesuai kriteria. Excellent work!"
          totalPoints={20}
          leaderboardPosition={15}
          dashboardUrl={dashboardUrl}
          leaderboardUrl={leaderboardUrl}
        />
      </section>

      <section>
        <h2>Rejection Notification</h2>
        <RejectionNotificationEmail 
          name={sampleUser.name}
          activityName="Explore - Classroom Implementation"
          reviewerNote="Bukti implementasi perlu diperjelas dengan screenshot atau video yang menunjukkan penggunaan AI tool di kelas. Refleksi juga perlu lebih detail tentang dampak terhadap siswa."
          dashboardUrl={dashboardUrl}
          supportUrl={supportUrl}
        />
      </section>

      <section>
        <h2>Weekly Progress</h2>
        <WeeklyProgressEmail 
          name={sampleUser.name}
          weekStartDate="26 Agustus"
          weekEndDate="2 September"
          totalPoints={70}
          pointsThisWeek={50}
          completedActivities={['Learn - AI Foundations', 'Explore - Classroom Implementation']}
          pendingSubmissions={1}
          leaderboardPosition={8}
          nextSuggestedActivity="Amplify - Train Your Peers"
          dashboardUrl={dashboardUrl}
          leaderboardUrl={leaderboardUrl}
        />
      </section>
    </div>
  );
}