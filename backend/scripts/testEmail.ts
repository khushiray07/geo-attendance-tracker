import dotenv from 'dotenv';
import path from 'path';
import { sendLateArrivalEmail } from '../services/emailService';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  console.log('SMTP configuration loaded for test email', {
    SMTP_HOST: process.env.SMTP_HOST || '(not set)',
    SMTP_PORT: process.env.SMTP_PORT || '(not set)',
    SMTP_USER: process.env.SMTP_USER || '(not set)',
    SMTP_FROM: process.env.SMTP_FROM || '(not set)',
    hasPass: Boolean(process.env.SMTP_PASS)
  });

  const recipient = process.env.TEST_EMAIL_TO || process.env.SMTP_USER;
  if (!recipient) {
    console.error('No recipient configured. Set TEST_EMAIL_TO or SMTP_USER in backend/.env.');
    process.exitCode = 1;
    return;
  }

  const result = await sendLateArrivalEmail({
    employeeName: 'Test Employee',
    employeeEmail: recipient,
    checkInTime: '10:15:00',
    shiftStartTime: '09:00',
    lateByMinutes: 75,
    date: new Date().toISOString().split('T')[0]
  });

  console.log('EMAIL RESULT', {
    attempted: true,
    sent: result.sent,
    skipped: Boolean(result.skipped),
    reason: result.reason || result.error || null
  });

  if (!result.sent) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`Late email failed with error: ${err.message || 'Unknown error'}`);
  process.exitCode = 1;
});
