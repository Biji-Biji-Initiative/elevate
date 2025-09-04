import * as React from 'react';

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

interface SubmissionConfirmationEmailProps {
  name: string;
  activityName: string;
  submissionDate: string;
  dashboardUrl: string;
}

export const SubmissionConfirmationEmail = ({ 
  name, 
  activityName, 
  submissionDate, 
  dashboardUrl 
}: SubmissionConfirmationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Submisi Anda untuk {activityName} telah diterima</Preview>
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
          <Heading style={h1}>Submisi Berhasil Diterima! ✅</Heading>
          <Text style={heroText}>
            Halo {name}! Submisi Anda untuk tahap <strong>{activityName}</strong> telah berhasil diterima.
          </Text>
          <Section style={submissionDetails}>
            <Text style={detailItem}><strong>Aktivitas:</strong> {activityName}</Text>
            <Text style={detailItem}><strong>Tanggal Submisi:</strong> {submissionDate}</Text>
            <Text style={detailItem}><strong>Status:</strong> Menunggu Review</Text>
          </Section>
          <Text style={text}>
            Submisi Anda sedang dalam antrian review oleh tim evaluator kami. Proses review biasanya 
            memakan waktu 1-2 hari kerja.
          </Text>
          <Text style={text}>
            Anda akan menerima notifikasi email segera setelah review selesai, baik itu disetujui 
            maupun memerlukan perbaikan.
          </Text>
          <Section style={buttonContainer}>
            <Link style={button} href={dashboardUrl}>
              Lihat Status Dashboard
            </Link>
          </Section>
          <Text style={tipText}>
            <strong>💡 Tips:</strong> Sementara menunggu, Anda dapat melanjutkan ke tahap LEAPS 
            berikutnya atau menjelajahi resources pembelajaran tambahan di dashboard.
          </Text>
          <Text style={footer}>
            Terima kasih atas partisipasi Anda!<br />
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

const text = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
};

const submissionDetails = {
  margin: '24px 0',
  padding: '20px',
  backgroundColor: '#f0f7ff',
  borderRadius: '8px',
  border: '1px solid #b3d9ff',
};

const detailItem = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '8px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#0066cc',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 28px',
};

const tipText = {
  color: '#0066cc',
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

export default SubmissionConfirmationEmail;