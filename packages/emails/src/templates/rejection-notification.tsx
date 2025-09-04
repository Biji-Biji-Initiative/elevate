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

interface RejectionNotificationEmailProps {
  name: string;
  activityName: string;
  reviewerNote: string;
  dashboardUrl: string;
  supportUrl: string;
}

export const RejectionNotificationEmail = ({ 
  name, 
  activityName, 
  reviewerNote,
  dashboardUrl,
  supportUrl
}: RejectionNotificationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Submisi {activityName} memerlukan perbaikan</Preview>
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
          <Heading style={h1}>Submisi Perlu Diperbaiki 📝</Heading>
          <Text style={heroText}>
            Halo {name}! Tim reviewer telah mengevaluasi submisi Anda untuk tahap <strong>{activityName}</strong>.
          </Text>
          
          <Text style={text}>
            Sayangnya, submisi Anda belum memenuhi kriteria yang diperlukan dan memerlukan beberapa perbaikan 
            sebelum dapat disetujui. Tapi jangan khawatir - ini adalah bagian normal dari proses pembelajaran!
          </Text>

          <Section style={feedbackContainer}>
            <Text style={feedbackHeader}><strong>📋 Feedback dari Reviewer:</strong></Text>
            <Text style={feedbackText}>{reviewerNote}</Text>
          </Section>

          <Text style={text}>
            Silakan tinjau feedback di atas dan lakukan perbaikan yang diperlukan pada submisi Anda. 
            Anda dapat mengedit dan mengirim ulang submisi melalui dashboard.
          </Text>

          <Section style={buttonContainer}>
            <Link style={primaryButton} href={dashboardUrl}>
              Perbaiki Submisi
            </Link>
            <Link style={secondaryButton} href={supportUrl}>
              Bantuan Support
            </Link>
          </Section>

          <Section style={tipsContainer}>
            <Text style={tipsHeader}><strong>💡 Tips untuk Submisi yang Lebih Baik:</strong></Text>
            <ul style={tipsList}>
              <li>Pastikan semua dokumen yang diperlukan telah dilampirkan</li>
              <li>Berikan penjelasan yang detail dan spesifik</li>
              <li>Sertakan bukti konkret dari implementasi atau pencapaian Anda</li>
              <li>Periksa kembali format dan kualitas file yang diunggah</li>
            </ul>
          </Section>

          <Text style={encouragingText}>
            <strong>🌟 Ingat:</strong> Setiap educator hebat pernah mengalami proses revisi. Yang terpenting 
            adalah terus belajar dan berkembang. Kami yakin Anda akan berhasil!
          </Text>

          <Text style={footer}>
            Kami siap membantu Anda sukses!<br />
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
  color: '#f59e0b',
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

const feedbackContainer = {
  margin: '24px 0',
  padding: '16px',
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  borderLeft: '4px solid #f59e0b',
};

const feedbackHeader = {
  color: '#92400e',
  fontSize: '16px',
  margin: '0 0 12px 0',
};

const feedbackText = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
  fontStyle: 'italic',
  backgroundColor: '#ffffff',
  padding: '12px',
  borderRadius: '4px',
  border: '1px solid #fed7aa',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const primaryButton = {
  backgroundColor: '#f59e0b',
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
  backgroundColor: '#6b7280',
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

const tipsContainer = {
  margin: '24px 0',
  padding: '16px',
  backgroundColor: '#f0f7ff',
  borderRadius: '8px',
};

const tipsHeader = {
  color: '#0066cc',
  fontSize: '16px',
  margin: '0 0 12px 0',
};

const tipsList = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
  paddingLeft: '20px',
};

const encouragingText = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '24px 0',
  padding: '16px',
  backgroundColor: '#f0f7ff',
  borderRadius: '8px',
  borderLeft: '4px solid #22c55e',
};

const footer = {
  color: '#666666',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '32px 0 0',
};

export default RejectionNotificationEmail;