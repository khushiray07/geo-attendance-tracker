import { sendLateArrivalEmail } from '../services/emailService';

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
  return sendLateArrivalEmail(payload);
}
