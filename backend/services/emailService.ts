import nodemailer from 'nodemailer';

export interface LateArrivalEmailPayload {
  employeeName: string;
  employeeEmail: string;
  adminEmail?: string | null;
  checkInTime: string;
  shiftStartTime: string;
  lateByMinutes: number;
  date: string;
}

export async function sendLateArrivalEmail(payload: LateArrivalEmailPayload) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    const message = 'Late email skipped because SMTP is not configured.';
    console.log(message);
    return { sent: false, skipped: true, reason: message, error: message };
  }

  try {
    console.log('Attempting late arrival email', {
      employeeEmail: payload.employeeEmail,
      adminEmail: payload.adminEmail || null,
      SMTP_HOST,
      SMTP_PORT,
      SMTP_FROM
    });

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to: [payload.employeeEmail, payload.adminEmail].filter(Boolean).join(','),
      subject: 'Late Check-in Alert - Geo Attendance Tracker',
      text: [
        `Employee name: ${payload.employeeName}`,
        `Employee email: ${payload.employeeEmail}`,
        `Date: ${payload.date}`,
        `Check-in time: ${payload.checkInTime}`,
        `Shift start time: ${payload.shiftStartTime}`,
        `Late by minutes: ${payload.lateByMinutes}`
      ].join('\n')
    });

    console.log('Late email sent successfully');
    return { sent: true, skipped: false, reason: 'Late email sent successfully', error: null };
  } catch (err: any) {
    const message = err.message || 'Late email failed';
    console.error(`Late email failed with error: ${message}`);
    return { sent: false, skipped: false, reason: message, error: message };
  }
}
