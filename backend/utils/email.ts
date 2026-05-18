import nodemailer from 'nodemailer';

export interface LateEmailPayload {
  employeeName: string;
  employeeEmail: string;
  adminEmail?: string;
  organizationName: string;
  date: string;
  checkInTime: string;
  shiftStartTime: string;
  lateByMinutes: number;
}

export async function sendLateCheckInEmail(payload: LateEmailPayload) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    const message = 'Email skipped: SMTP not configured';
    console.log(message);
    return { sent: false, error: message };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    const recipients = [payload.employeeEmail, payload.adminEmail].filter(Boolean).join(',');
    await transporter.sendMail({
      from: SMTP_FROM,
      to: recipients,
      subject: `Late Check-in Alert - ${payload.employeeName}`,
      text: [
        `Employee: ${payload.employeeName}`,
        `Organization: ${payload.organizationName}`,
        `Date: ${payload.date}`,
        `Check-in time: ${payload.checkInTime}`,
        `Shift start time: ${payload.shiftStartTime}`,
        `Late by: ${payload.lateByMinutes} minutes`
      ].join('\n')
    });

    return { sent: true, error: null };
  } catch (err: any) {
    return { sent: false, error: err.message || 'Email failed' };
  }
}
