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
import { scheduleDailyAutoCheckout } from './services/autoCheckoutService';

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

  app.get('/', (_req, res) => {
    res.json({ ok: true, service: 'geo-attendance-tracker-api' });
  });
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/reports', reportRoutes);

  app.use('/auth', authRoutes);
  app.use('/settings', settingsRoutes);
  app.use('/attendance', attendanceRoutes);
  app.use('/admin', adminRoutes);
  app.use('/organizations', organizationRoutes);
  app.use('/reports', reportRoutes);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled request error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  });

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  server.on('error', (err) => {
    console.error('Server failed:', err);
    process.exit(1);
  });
  scheduleDailyAutoCheckout();
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});
