import { Clock3, TrendingUp } from 'lucide-react';

const TARGET_MINUTES = 8 * 60;

type WorkingHoursCardProps = {
  minutes: number;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  attendanceType?: string | null;
};

export default function WorkingHoursCard({ minutes, checkInTime, checkOutTime, attendanceType }: WorkingHoursCardProps) {
  const safeMinutes = Math.max(0, Math.round(minutes || 0));
  const percentage = Math.min(100, Math.round((safeMinutes / TARGET_MINUTES) * 100));
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const hoursLabel = formatDuration(safeMinutes);
  const status = workingHoursStatus(percentage, checkInTime, checkOutTime);
  const typeLabel = String(attendanceType || 'on_site').replaceAll('_', ' ');

  return (
    <section className="group relative overflow-hidden rounded-2xl border border-blue-100/80 bg-white/85 p-5 shadow-sm shadow-blue-100/60 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/80 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-blue-50 via-white to-transparent" />
      <div className="pointer-events-none absolute right-6 top-8 h-20 w-20 rounded-full bg-brand/10 blur-2xl transition duration-300 group-hover:bg-brand/15" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-gray-500">Today's Working Hours</p>
          <h2 className="mt-1 text-xl font-black text-gray-950">Shift Progress</h2>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light text-brand shadow-sm">
          <Clock3 size={22} />
        </div>
      </div>

      <div className="relative mt-6 flex justify-center">
        <div className="relative h-48 w-48">
          <svg className="h-full w-full -rotate-90 drop-shadow-sm" viewBox="0 0 180 180" role="img" aria-label={`${percentage}% of today's working hours completed`}>
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="#E0E7FF"
              strokeWidth="14"
            />
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="url(#working-hours-gradient)"
              strokeLinecap="round"
              strokeWidth="14"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out"
            />
            <defs>
              <linearGradient id="working-hours-gradient" x1="24" y1="24" x2="156" y2="156" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38BDF8" />
                <stop offset="0.55" stopColor="#0A58CA" />
                <stop offset="1" stopColor="#1D4ED8" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-gray-950">{hoursLabel}</span>
            <span className="mt-1 text-sm font-black text-brand">{percentage}% completed</span>
          </div>
        </div>
      </div>

      <div className="relative mt-5 rounded-2xl border border-blue-100 bg-white/75 p-4 shadow-inner shadow-blue-50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-black ${status.className}`}>{status.label}</p>
            <p className="mt-1 text-xs font-semibold text-gray-500">{status.description}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brand">
            <TrendingUp size={20} />
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-light">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-brand to-blue-700 transition-all duration-700"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <p className="relative mt-4 text-sm font-semibold leading-6 text-gray-500">
        Attendance summary: {checkInTime ? `Checked in at ${checkInTime.substring(0, 5)}` : 'No check-in recorded yet'}
        {checkOutTime ? ` and checked out at ${checkOutTime.substring(0, 5)}.` : checkInTime ? ' with the session currently active.' : '.'} Target is 8h for {typeLabel}.
      </p>
    </section>
  );
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function workingHoursStatus(percentage: number, checkInTime?: string | null, checkOutTime?: string | null) {
  if (percentage >= 100) {
    return {
      label: 'Goal Reached',
      description: checkOutTime ? 'Full day completed for this shift.' : 'You have completed the expected daily target.',
      className: 'text-success-text'
    };
  }
  if (!checkInTime) {
    return {
      label: 'Below Target',
      description: "Punch in to start tracking today's shift progress.",
      className: 'text-danger-text'
    };
  }
  if (percentage >= 55) {
    return {
      label: 'On Track',
      description: 'Progress looks healthy against the 8h benchmark.',
      className: 'text-brand'
    };
  }
  return {
    label: 'Below Target',
    description: 'Work duration is still below the daily benchmark.',
    className: 'text-warning-text'
  };
}
