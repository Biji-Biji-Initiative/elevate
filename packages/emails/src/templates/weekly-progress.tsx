import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface WeeklyProgressEmailProps {
  name: string;
  weekStartDate: string;
  weekEndDate: string;
  totalPoints: number;
  pointsThisWeek: number;
  completedActivities: string[];
  pendingSubmissions: number;
  leaderboardPosition: number;
  nextSuggestedActivity: string;
  dashboardUrl: string;
  leaderboardUrl: string;
}

export const WeeklyProgressEmail = ({ 
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
}: WeeklyProgressEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Ringkasan Progress LEAPS Minggu Ini</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img
              src="https://leaps.mereka.org/logo.png"
              width="120"
              height="36"
              alt="MS Elevate LEAPS"
              style={logo}
            />
          </Section>
          <Heading style={h1}>Progress Report Mingguan 📊</Heading>
          <Text style={heroText}>
            Halo {name}! Inilah ringkasan aktivitas LEAPS Anda dari {weekStartDate} hingga {weekEndDate}.
          </Text>
          
          <Section style={statsContainer}>
            <div style={statRow}>
              <div style={statItem}>
                <Text style={statNumber}>{totalPoints}</Text>
                <Text style={statLabel}>Total Poin</Text>
              </div>
              <div style={statItem}>
                <Text style={statNumber}>+{pointsThisWeek}</Text>
                <Text style={statLabel}>Poin Minggu Ini</Text>
              </div>
              <div style={statItem}>
                <Text style={statNumber}>#{leaderboardPosition}</Text>
                <Text style={statLabel}>Posisi Leaderboard</Text>
              </div>
            </div>
          </Section>

          <Section style={activitiesContainer}>
            <Text style={sectionHeader}><strong>🎯 Aktivitas Selesai Minggu Ini:</strong></Text>
            {completedActivities.length > 0 ? (
              completedActivities.map((activity, index) => (
                <Text key={index} style={activityItem}>✅ {activity}</Text>
              ))
            ) : (
              <Text style={noActivityText}>Belum ada aktivitas yang diselesaikan minggu ini.</Text>
            )}
          </Section>

          {pendingSubmissions > 0 && (
            <Section style={pendingContainer}>
              <Text style={pendingHeader}><strong>⏳ Submisi Menunggu Review:</strong></Text>
              <Text style={pendingText}>
                Anda memiliki {pendingSubmissions} submisi yang sedang dalam antrian review. 
                Tim kami akan segera memprocessnya dalam 1-2 hari kerja.
              </Text>
            </Section>
          )}

          <Section style={suggestionContainer}>
            <Text style={suggestionHeader}><strong>🚀 Langkah Berikutnya:</strong></Text>
            <Text style={suggestionText}>
              Berdasarkan progress Anda, kami merekomendasikan untuk fokus pada: 
              <strong> {nextSuggestedActivity}</strong>
            </Text>
          </Section>

          <Section style={buttonContainer}>
            <Link style={primaryButton} href={dashboardUrl}>
              Lanjutkan Journey
            </Link>
            <Link style={secondaryButton} href={leaderboardUrl}>
              Lihat Leaderboard
            </Link>
          </Section>

          <Section style={motivationContainer}>
            <Text style={motivationText}>
              <strong>💪 Tetap Semangat!</strong><br />
              Setiap langkah kecil membawa Anda lebih dekat untuk menjadi educator yang 
              memanfaatkan AI secara optimal. Konsistensi adalah kunci sukses!
            </Text>
          </Section>

          <Text style={footer}>
            Terus berkarya dan berinovasi!<br />
            Tim MS Elevate Indonesia
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '580px',
};

const logoContainer = {
  textAlign: 'center' as const,
  margin: '0 0 40px',
};

const logo = {
  margin: '0 auto',
};

const h1 = {
  color: '#0066cc',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const heroText = {
  fontSize: '18px',
  lineHeight: '26px',
  margin: '16px 0',
  color: '#333333',
};

const statsContainer = {
  margin: '32px 0',
  padding: '20px',
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
};

const statRow = {
  display: 'flex',
  justifyContent: 'space-around',
  textAlign: 'center' as const,
};

const statItem = {
  flex: 1,
  padding: '0 10px',
};

const statNumber = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#0066cc',
  margin: '0 0 4px 0',
  display: 'block',
};

const statLabel = {
  fontSize: '14px',
  color: '#666666',
  margin: '0',
  display: 'block',
};

const activitiesContainer = {
  margin: '24px 0',
  padding: '16px',
  backgroundColor: '#f0fdf4',
  borderRadius: '8px',
  borderLeft: '4px solid #22c55e',
};

const sectionHeader = {
  color: '#16a34a',
  fontSize: '16px',
  margin: '0 0 12px 0',
};

const activityItem = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '8px 0',
};

const noActivityText = {
  color: '#666666',
  fontSize: '16px',
  fontStyle: 'italic',
  margin: '8px 0',
};

const pendingContainer = {
  margin: '24px 0',
  padding: '16px',
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  borderLeft: '4px solid #f59e0b',
};

const pendingHeader = {
  color: '#92400e',
  fontSize: '16px',
  margin: '0 0 8px 0',
};

const pendingText = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
};

const suggestionContainer = {
  margin: '24px 0',
  padding: '16px',
  backgroundColor: '#f0f7ff',
  borderRadius: '8px',
  borderLeft: '4px solid #0066cc',
};

const suggestionHeader = {
  color: '#0066cc',
  fontSize: '16px',
  margin: '0 0 8px 0',
};

const suggestionText = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const primaryButton = {
  backgroundColor: '#0066cc',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 28px',
  margin: '0 8px 8px 0',
};

const secondaryButton = {
  backgroundColor: '#22c55e',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 28px',
  margin: '0 0 8px 8px',
};

const motivationContainer = {
  margin: '24px 0',
  padding: '16px',
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  borderLeft: '4px solid #ef4444',
};

const motivationText = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
};

const footer = {
  color: '#666666',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '32px 0 0',
};

export default WeeklyProgressEmail;