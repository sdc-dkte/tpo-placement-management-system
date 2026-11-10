import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GraduationCap,
  IndianRupee,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Users,
  BriefcaseBusiness,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/useAuth';

const numberFormat = new Intl.NumberFormat('en-IN');
const packageFormat = (value) =>
  Number.isFinite(Number(value)) ? `₹${Number(value).toFixed(2)} LPA` : '—';
const formatNumber = (value) =>
  Number.isFinite(Number(value)) ? numberFormat.format(Number(value)) : '—';
const formatPercent = (value) =>
  Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '—';

function MetricCard({ title, value, note, icon, accent = 'gold', detail }) {
  const accentClasses = {
    gold: 'bg-[#FECC00]/15 text-[#8A6500]',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-violet-50 text-violet-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  const barColors = {
    gold: 'from-[#FECC00] to-[#FFE066]',
    green: 'from-emerald-400 to-emerald-500',
    blue: 'from-blue-400 to-blue-500',
    purple: 'from-violet-400 to-violet-500',
    slate: 'from-slate-300 to-slate-400',
  };

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_12px_30px_-8px_rgba(15,23,42,0.15)] sm:p-5">
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${barColors[accent] || barColors.gold} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-slate-500">{title}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accentClasses[accent] || accentClasses.gold} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          {React.createElement(icon, { size: 17, strokeWidth: 2.1 })}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="min-w-0 truncate font-mono text-[clamp(1.45rem,2.2vw,1.9rem)] font-bold leading-none tracking-tight text-[#111827] tabular-nums">
          {value}
        </p>
        {detail ? <span className="shrink-0 text-[10px] font-semibold text-slate-400">{detail}</span> : null}
      </div>
      <p className="mt-2 min-h-[16px] text-xs leading-5 text-slate-500">{note}</p>
    </article>
  );
}

function SectionHeading({ eyebrow, title, action, onAction }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{eyebrow}</p> : null}
        <h2 className="text-base font-bold tracking-tight text-[#111827] sm:text-lg">{title}</h2>
      </div>
      {action ? (
        <button type="button" onClick={onAction} className="group inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-[#111827]">
          {action}<ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      ) : null}
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-[142px] animate-pulse rounded-xl border border-slate-200 bg-white p-5">
          <div className="h-3 w-28 rounded bg-slate-100" />
          <div className="mt-6 h-7 w-24 rounded bg-slate-100" />
          <div className="mt-3 h-3 w-36 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, message, action, onAction }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        <BriefcaseBusiness size={18} />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{message}</p>
      {action ? <button type="button" onClick={onAction} className="mt-4 text-xs font-bold text-slate-800 underline decoration-[#FECC00] decoration-2 underline-offset-4">{action}</button> : null}
    </div>
  );
}

function PlacementDonut({ placed, unplaced, percentage }) {
  const safePlaced = Math.max(0, Number(placed) || 0);
  const safeUnplaced = Math.max(0, Number(unplaced) || 0);
  const total = safePlaced + safeUnplaced;
  const progress = total > 0 ? (safePlaced / total) * 100 : 0;
  const circumference = 2 * Math.PI * 48;
  const dash = (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-8">
      <div className="relative h-40 w-40 shrink-0">
        <div className="absolute inset-0 rounded-full bg-emerald-400/10 blur-xl" />
        <svg viewBox="0 0 120 120" className="relative h-full w-full -rotate-90" role="img" aria-label={`Placement rate ${formatPercent(percentage)}`}>
          <circle cx="60" cy="60" r="48" fill="none" stroke="#E9EEF4" strokeWidth="11" />
          <circle
            cx="60" cy="60" r="48" fill="none" stroke="url(#donutGradient)" strokeWidth="11"
            strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`}
            className="transition-all duration-1000 ease-out" />
          <defs>
            <linearGradient id="donutGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#16A36A" />
              <stop offset="60%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#4ADE80" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[27px] font-bold tracking-tight text-[#111827] tabular-nums">{formatPercent(percentage)}</span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Placed</span>
        </div>
      </div>
      <div className="w-full max-w-[210px] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />Placed</div>
          <span className="font-mono text-sm font-bold text-[#111827] tabular-nums">{formatNumber(safePlaced)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-slate-300 ring-2 ring-slate-100" />Not yet placed</div>
          <span className="font-mono text-sm font-bold text-[#111827] tabular-nums">{formatNumber(safeUnplaced)}</span>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <p className="text-[11px] leading-5 text-slate-500">Placement progress is calculated from students currently marked SELECTED or OFFER_ACCEPTED by the backend.</p>
        </div>
      </div>
    </div>
  );
}

function DepartmentPerformance({ departments }) {
  if (!departments.length) {
    return <EmptyState title="No department data yet" message="Department performance will appear here when the overview API returns department summaries." />;
  }

  const palette = [
    'from-[#D9A900] to-[#FECC00]',
    'from-emerald-500 to-emerald-400',
    'from-blue-500 to-blue-400',
    'from-violet-500 to-violet-400',
  ];

  return (
    <div className="space-y-4">
      {departments.slice(0, 4).map((department, idx) => {
        const rate = Math.max(0, Math.min(100, Number(department.placementPercentage) || 0));
        return (
          <div key={department.departmentId ?? department.departmentCode} className="group">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-700">{department.departmentCode || department.departmentName || 'Department'}</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-400">{department.departmentName || 'Department'} · {formatNumber(department.placedStudents)} / {formatNumber(department.totalStudents)} placed</p>
              </div>
              <span className="shrink-0 font-mono text-xs font-bold text-[#111827] tabular-nums">{formatPercent(rate)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${palette[idx % palette.length]} transition-all duration-700 group-hover:brightness-110 w-[${rate}%]`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DriveItem({ drive, onClick }) {
  const status = String(drive.status || 'UPCOMING').toUpperCase();
  const date = drive.driveDate ? new Date(drive.driveDate) : null;
  const validDate = date && !Number.isNaN(date.getTime());
  const dateLabel = validDate
    ? date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Date not announced';

  return (
    <button type="button" onClick={onClick} className="group w-full rounded-lg border border-slate-100 p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#111827]">{drive.company?.name || drive.companyName || 'Recruiting company'}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{drive.title || drive.jobRole?.title || 'Placement opportunity'}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${status === 'ONGOING' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'}`}>
          {status === 'ONGOING' ? 'Ongoing' : 'Upcoming'}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{dateLabel}</span>
        {drive.venue ? <span className="inline-flex items-center gap-1"><Building2 size={12} />{drive.venue}</span> : null}
        {drive.packageLPA !== undefined && drive.packageLPA !== null ? <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-700"><IndianRupee size={11} />{Number(drive.packageLPA).toFixed(2)} LPA</span> : null}
      </div>
    </button>
  );
}

export default function TpoDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drivesLoading, setDrivesLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [drivesError, setDrivesError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setDrivesLoading(true);
    setOverviewError('');
    setDrivesError('');

    const [overviewResult, drivesResult] = await Promise.allSettled([
      apiClient('/dashboard/overview'),
      apiClient('/drives?status=UPCOMING&limit=2&sortBy=driveDate&sortOrder=asc'),
    ]);

    if (overviewResult.status === 'fulfilled') {
      const result = overviewResult.value;
      if (result?.success && result.data) {
        setOverview(result.data);
        setLastUpdated(new Date());
      } else {
        setOverviewError(result?.message || 'The dashboard overview response did not contain data.');
      }
    } else {
      setOverviewError(overviewResult.reason?.message || 'Unable to load dashboard overview.');
    }

    if (drivesResult.status === 'fulfilled') {
      const result = drivesResult.value;
      if (result?.success) {
        const driveData = Array.isArray(result.data) ? result.data : result.data?.data;
        setDrives(Array.isArray(driveData) ? driveData : []);
      } else {
        setDrivesError(result?.message || 'Unable to load recruitment drives.');
      }
    } else {
      setDrivesError(drivesResult.reason?.message || 'Unable to load recruitment drives.');
    }

    setLoading(false);
    setDrivesLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const departments = useMemo(() => {
    return [...(overview?.departmentSummaries || [])].sort(
      (a, b) => (Number(b.placementPercentage) || 0) - (Number(a.placementPercentage) || 0),
    );
  }, [overview]);

  const ongoingDrives = Number(overview?.ongoingDrives) || 0;
  const upcomingDrives = Number(overview?.upcomingDrives) || 0;
  const placedStudents = Number(overview?.placedStudents) || 0;
  const unplacedStudents = Number(overview?.unplacedStudents) || 0;
  const placementPercentage = Number(overview?.placementPercentage) || 0;

  const greetingName = user?.name?.trim()?.split(' ')[0] || 'there';
  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';

  const handleSearch = (event) => {
    event.preventDefault();
    navigate('/students', { state: { searchQuery: searchTerm.trim() } });
  };

  return (
    <main className="min-h-screen min-w-0 bg-[#F8FAFC] px-4 pb-8 pt-5 text-[#111827] sm:px-6 lg:px-8 lg:pt-7">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        {/* Page header */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
              <span>Placement Operations</span><ChevronRight size={13} /><span className="font-semibold text-slate-700">Overview</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <form onSubmit={handleSearch} className="relative min-w-0 sm:w-64">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search PRN, student..."
                  aria-label="Search students"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-[#C69A00] focus:ring-2 focus:ring-[#FECC00]/20"
                />
              </form>
              <div className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600">
                <CalendarDays size={14} className="text-slate-400" /> AY 2025–26
              </div>
              <button type="button" onClick={() => navigate('/drives')} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#FECC00] px-4 text-xs font-extrabold text-[#111827] shadow-sm transition hover:bg-[#F2C000] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#D6A900] focus:ring-offset-2">
                <span className="text-base leading-none">+</span> New Placement Drive
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-[#111827] px-5 py-6 text-white shadow-[0_10px_30px_rgba(17,24,39,0.12)] sm:px-7 sm:py-7">
            <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border-[35px] border-white/[0.035]" />
            <div className="pointer-events-none absolute -bottom-24 right-32 h-52 w-52 rounded-full border-[25px] border-[#FECC00]/[0.08]" />
            <div className="pointer-events-none absolute left-1/3 top-0 h-40 w-40 rounded-full bg-emerald-400/[0.06] blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-10 h-32 w-32 rounded-full bg-[#FECC00]/[0.07] blur-2xl" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> LIVE PHASE II · 2025–26
                  </span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium text-slate-300">TPO Executive Console</span>
                </div>
                <p className="text-xs font-medium text-slate-300">Good day, {greetingName}</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Institutional Placement Operations</h1>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-300 sm:text-sm">Your live overview of student placements, department performance and recruitment activity across DKTE.</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FECC00] text-[#111827] shadow-[0_0_20px_rgba(254,204,0,0.25)]"><Activity size={18} /></div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Last refreshed</p>
                  <p className="mt-0.5 text-sm font-bold text-white">{updatedLabel}</p>
                  <p className="text-[10px] text-slate-400">Local device time</p>
                </div>
                <button type="button" onClick={loadDashboard} aria-label="Refresh dashboard" title="Refresh dashboard" className="ml-1 rounded-md p-2 text-slate-300 transition hover:bg-white/10 hover:text-white">
                  <RefreshCw size={15} className={loading || drivesLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* KPI cards */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Executive snapshot</p>
              <h2 className="mt-1 text-sm font-bold text-[#111827]">Placement at a glance</h2>
            </div>
            <span className="hidden items-center gap-1.5 text-[10px] font-medium text-slate-400 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live data from placement database</span>
          </div>
          {loading && !overview ? <LoadingBlock /> : overviewError && !overview ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
              <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 text-rose-600" size={18} /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-rose-900">Dashboard data could not be loaded</p><p className="mt-1 text-xs text-rose-700">{overviewError}</p><button type="button" onClick={loadDashboard} className="mt-3 text-xs font-bold text-rose-900 underline underline-offset-4">Try again</button></div></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <MetricCard title="Total Eligible" value={formatNumber(overview?.totalStudents)} note="Students registered in the placement database" icon={GraduationCap} accent="gold" />
              <MetricCard title="Placed Students" value={formatNumber(overview?.placedStudents)} note={`${formatPercent(overview?.placementPercentage)} overall placement rate`} icon={Award} accent="green" />
              <MetricCard title="Seeking Placement" value={formatNumber(overview?.unplacedStudents)} note="Students not currently marked as placed" icon={Users} accent="blue" />
              <MetricCard title="Average Package" value={packageFormat(overview?.averagePackage)} note="Average CTC among placed students" icon={IndianRupee} accent="purple" />
              <MetricCard title="Highest Package" value={packageFormat(overview?.highestPackage)} note="Highest recorded CTC in current data" icon={Target} accent="gold" />
              <MetricCard title="Active Drives" value={formatNumber(ongoingDrives + upcomingDrives)} note={`${formatNumber(ongoingDrives)} ongoing · ${formatNumber(upcomingDrives)} upcoming`} icon={BriefcaseBusiness} accent="slate" />
            </div>
          )}
        </section>

        {/* Middle intelligence tier */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <article className="relative overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] xl:col-span-4">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/[0.06] blur-2xl" />
            <div className="relative">
              <SectionHeading eyebrow="Placement intelligence" title="Placement progress" />
              {overview ? <PlacementDonut placed={placedStudents} unplaced={unplacedStudents} percentage={placementPercentage} /> : (
                <div className="flex min-h-[180px] items-center justify-center text-xs text-slate-400">Waiting for placement data…</div>
              )}
              <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-700" />
                <p className="text-[11px] leading-5 text-amber-900"><span className="font-bold">Clause 4.2 · Placement Lockdown.</span> Students marked SELECTED or OFFER_ACCEPTED are counted as placed by the backend. Ensure selected PRNs are locked from subsequent standard campus drives.</p>
              </div>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] xl:col-span-4">
            <div className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-[#FECC00]/[0.07] blur-2xl" />
            <div className="relative">
              <SectionHeading eyebrow="Branch-wise insights" title="Department performance" action="Student directory" onAction={() => navigate('/students')} />
              <DepartmentPerformance departments={departments} />
              {departments.length > 0 ? <div className="mt-4 border-t border-slate-100 pt-3 text-[10px] text-slate-400">Showing top 4 departments by placement percentage</div> : null}
            </div>
          </article>

          <article className="relative overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] xl:col-span-4">
            <div className="pointer-events-none absolute -right-10 top-1/3 h-32 w-32 rounded-full bg-amber-400/[0.06] blur-2xl" />
            <div className="relative">
              <SectionHeading eyebrow="Recruitment calendar" title="Ongoing & upcoming drives" action="All drives" onAction={() => navigate('/drives')} />
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-emerald-50 px-3 py-2.5 ring-1 ring-emerald-100"><p className="text-[10px] font-semibold text-emerald-700">Ongoing now</p><p className="mt-1 font-mono text-xl font-bold text-emerald-900 tabular-nums">{formatNumber(ongoingDrives)}</p></div>
                <div className="rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-amber-100"><p className="text-[10px] font-semibold text-amber-800">Upcoming</p><p className="mt-1 font-mono text-xl font-bold text-amber-950 tabular-nums">{formatNumber(upcomingDrives)}</p></div>
              </div>
              {drivesLoading ? (
                <div className="space-y-2"><div className="h-20 animate-pulse rounded-lg bg-slate-100" /><div className="h-20 animate-pulse rounded-lg bg-slate-100" /></div>
              ) : drivesError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{drivesError}</div>
              ) : drives.length ? (
                <div className="space-y-2">{drives.slice(0, 5).map((drive) => <DriveItem key={drive.id} drive={drive} onClick={() => navigate('/drives')} />)}</div>
              ) : (
                <EmptyState title="No upcoming drives found" message="New recruitment drives will appear here when they are published." action="Create a placement drive" onAction={() => navigate('/drives')} />
              )}
              <p className="mt-3 text-[10px] leading-4 text-slate-400">Showing the next 2 upcoming drives from the recruitment API. Click 'View All Drives' to explore all ongoing and upcoming recruitment activities. Venues are displayed as simple location descriptors.</p>
            </div>
          </article>
        </section>

        {/* Operational tier */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <article className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:col-span-7">
            <SectionHeading eyebrow="Daily workflow" title="Quick actions" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => navigate('/drives')} className="group flex items-center gap-3 rounded-xl border border-[#F1D66A] bg-[#FFF9DE] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#D8AC00] hover:bg-[#FFF4C2] hover:shadow-md">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FECC00] text-[#111827] shadow-sm transition-transform group-hover:scale-110"><BriefcaseBusiness size={19} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#111827]">Create Drive</span><span className="mt-1 block text-[11px] text-slate-600">Start a new placement opportunity</span></span><ArrowRight size={16} className="shrink-0 text-slate-500 transition group-hover:translate-x-1" />
              </button>
              <button type="button" onClick={() => navigate('/companies')} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-transform group-hover:scale-110"><Building2 size={19} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#111827]">Add Company</span><span className="mt-1 block text-[11px] text-slate-500">Register a recruiting partner</span></span><ArrowRight size={16} className="shrink-0 text-slate-400 transition group-hover:translate-x-1" />
              </button>
              <button type="button" onClick={() => navigate('/students')} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition-transform group-hover:scale-110"><Users size={19} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#111827]">Manage Students</span><span className="mt-1 block text-[11px] text-slate-500">Review profiles and eligibility data</span></span><ArrowRight size={16} className="shrink-0 text-slate-400 transition group-hover:translate-x-1" />
              </button>
              <button type="button" onClick={() => navigate('/analytics')} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 transition-transform group-hover:scale-110"><BarChart3 size={19} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#111827]">View Analytics</span><span className="mt-1 block text-[11px] text-slate-500">Explore detailed placement reports</span></span><ArrowRight size={16} className="shrink-0 text-slate-400 transition group-hover:translate-x-1" />
              </button>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:col-span-5">
            <div className="pointer-events-none absolute -bottom-12 -right-10 h-40 w-40 rounded-full bg-[#FECC00]/10 blur-2xl" />
            <div className="relative">
              <SectionHeading eyebrow="Institutional communication" title="Placement communications" />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-[#FECC00]"><Layers3 size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#111827]">Email campaign insights</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Broadcast and delivery information will appear here when a verified communication metrics endpoint is connected.</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Metrics status</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600"><Clock3 size={11} /> Not connected</span>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-5 text-slate-400">Only real Nodemailer delivery metrics should be displayed. No estimated open rates, click rates or fabricated broadcast counts are shown.</p>
            </div>
          </article>
        </section>
        <div className="pointer-events-none bottom-0 left-0 z-0 w-full overflow-hidden">
          <img
            src="/DKTE_IMG.png"
            alt=""
            aria-hidden="true"
            className="block h-auto w-full object-contain opacity-[0.10]"
          />
        </div>

        {/* Footer */}
        <footer className="flex flex-col gap-2 border-t border-slate-200 pt-4 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>DKTE Society&apos;s Textile &amp; Engineering Institute · Training &amp; Placement Cell</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> Institutional placement console · AY 2025–26</span>
        </footer>

      </div>
    </main>
  );
}