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

interface WelcomeEmailProps {
  name: string;
  dashboardUrl: string;
}

export const WelcomeEmail = ({ name, dashboardUrl }: WelcomeEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome to MS Elevate LEAPS Tracker</Preview>
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
          <Heading style={h1}>Selamat datang di LEAPS Journey! 🚀</Heading>
          <Text style={heroText}>
            Halo {name}! Kami sangat senang Anda bergabung dengan MS Elevate LEAPS Tracker.
          </Text>
          <Text style={text}>
            LEAPS adalah perjalanan pembelajaran yang akan memberdayakan Anda untuk mengintegrasikan 
            AI dalam pengajaran Anda melalui 5 tahapan:
          </Text>
          <Section style={stagesContainer}>
            <Text style={stageItem}><strong>🎓 Learn:</strong> Pelajari dasar-dasar AI untuk pendidikan</Text>
            <Text style={stageItem}><strong>🔍 Explore:</strong> Terapkan AI di kelas Anda</Text>
            <Text style={stageItem}><strong>📢 Amplify:</strong> Bagikan pengetahuan dengan sesama pendidik</Text>
            <Text style={stageItem}><strong>🎤 Present:</strong> Presentasikan pengalaman Anda</Text>
            <Text style={stageItem}><strong>✨ Shine:</strong> Raih pengakuan atas inovasi Anda</Text>
          </Section>
          <Section style={buttonContainer}>
            <Link style={button} href={dashboardUrl}>
              Mulai Journey Anda
            </Link>
          </Section>
          <Text style={text}>
            Dalam dashboard Anda, Anda dapat:
          </Text>
          <ul style={list}>
            <li>Melacak progress di setiap tahap LEAPS</li>
            <li>Mengunggah bukti penyelesaian</li>
            <li>Melihat posisi Anda di leaderboard</li>
            <li>Mengatur visibilitas profil publik</li>
          </ul>
          <Text style={text}>
            Jika Anda memiliki pertanyaan, jangan ragu untuk menghubungi tim support kami.
          </Text>
          <Text style={footer}>
            Salam hangat,<br />
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

const stagesContainer = {
  margin: '32px 0',
  padding: '20px',
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
};

const stageItem = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '12px 0',
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

const list = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
  paddingLeft: '20px',
};

const footer = {
  color: '#666666',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '32px 0 0',
};

export default WelcomeEmail;