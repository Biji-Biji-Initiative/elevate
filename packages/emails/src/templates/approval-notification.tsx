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

interface ApprovalNotificationEmailProps {
  name: string;
  activityName: string;
  pointsAwarded: number;
  reviewerNote?: string;
  totalPoints: number;
  leaderboardPosition: number;
  dashboardUrl: string;
  leaderboardUrl: string;
}

export const ApprovalNotificationEmail = ({ 
  name, 
  activityName, 
  pointsAwarded,
  reviewerNote,
  totalPoints,
  leaderboardPosition,
  dashboardUrl,
  leaderboardUrl
}: ApprovalNotificationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>🎉 Submisi {activityName} Anda telah disetujui!</Preview>
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
          <Heading style={h1}>Selamat! Submisi Disetujui! 🎉</Heading>
          <Text style={heroText}>
            Halo {name}! Kabar baik untuk Anda - submisi untuk tahap <strong>{activityName}</strong> telah disetujui!
          </Text>
          
          <Section style={approvalDetails}>
            <Text style={detailItem}><strong>Aktivitas:</strong> {activityName}</Text>
            <Text style={detailItem}><strong>Poin Diperoleh:</strong> +{pointsAwarded} poin</Text>
            <Text style={detailItem}><strong>Total Poin Anda:</strong> {totalPoints} poin</Text>
            <Text style={detailItem}><strong>Posisi Leaderboard:</strong> #{leaderboardPosition}</Text>
          </Section>

          {reviewerNote && (
            <Section style={noteContainer}>
              <Text style={noteHeader}><strong>📝 Catatan Reviewer:</strong></Text>
              <Text style={noteText}>{reviewerNote}</Text>
            </Section>
          )}

          <Text style={text}>
            Fantastis! Anda telah berhasil menyelesaikan satu tahap lagi dalam LEAPS journey Anda. 
            Poin yang Anda peroleh telah ditambahkan ke total skor Anda.
          </Text>

          <Section style={buttonContainer}>
            <Link style={primaryButton} href={dashboardUrl}>
              Lihat Dashboard
            </Link>
            <Link style={secondaryButton} href={leaderboardUrl}>
              Cek Leaderboard
            </Link>
          </Section>

          <Text style={nextStepsText}>
            <strong>🚀 Langkah Selanjutnya:</strong><br />
            Jangan berhenti di sini! Lanjutkan journey Anda dengan mengeksplorasi tahap LEAPS berikutnya. 
            Setiap tahap membawa Anda lebih dekat untuk menjadi educator yang memanfaatkan AI secara optimal.
          </Text>

          <Text style={footer}>
            Terus semangat dalam perjalanan LEAPS Anda!<br />
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
  color: '#22c55e',
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

const text = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
};

const approvalDetails = {
  margin: '24px 0',
  padding: '20px',
  backgroundColor: '#f0fdf4',
  borderRadius: '8px',
  border: '1px solid #86efac',
};

const detailItem = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '8px 0',
};

const noteContainer = {
  margin: '24px 0',
  padding: '16px',
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  borderLeft: '4px solid #f59e0b',
};

const noteHeader = {
  color: '#92400e',
  fontSize: '16px',
  margin: '0 0 8px 0',
};

const noteText = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
  fontStyle: 'italic',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const primaryButton = {
  backgroundColor: '#22c55e',
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
  backgroundColor: '#0066cc',
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

const nextStepsText = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '24px 0',
  padding: '16px',
  backgroundColor: '#f0f7ff',
  borderRadius: '8px',
  borderLeft: '4px solid #0066cc',
};

const footer = {
  color: '#666666',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '32px 0 0',
};

export default ApprovalNotificationEmail;