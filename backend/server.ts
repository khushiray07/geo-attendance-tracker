import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initDb } from './database';
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import attendanceRoutes from './routes/attendance';
import adminRoutes from './routes/admin';
import organizationRoutes from './routes/organizations';
import reportRoutes from './routes/reports';

dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('SMTP configuration loaded', {
  SMTP_HOST: process.env.SMTP_HOST || '(not set)',
  SMTP_PORT: process.env.SMTP_PORT || '(not set)',
  SMTP_USER: process.env.SMTP_USER || '(not set)',
  SMTP_FROM: process.env.SMTP_FROM || '(not set)',
  hasPass: Boolean(process.env.SMTP_PASS)
});

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());

async function start() {
  await initDb();

  app.use('/api/auth', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/reports', reportRoutes);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
