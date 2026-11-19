import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { tasksApi, milestonesApi, projectsApi } from '../api/endpoints.js';
import {
  Button,
  Card,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  inputClass,
} from '../components/ui/Primitives.jsx';
import { formatDate } from '../utils/format.js';

const getTodayDate = () => new Date();
const getTodayIso = () => new Date().toISOString().slice(0, 10);

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(getTodayDate);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'list-simple'],
    queryFn: () => projectsApi.list({ limit: 100 }),
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', 'calendar', selectedProject],
    queryFn: () =>
      tasksApi.list({
        projectId: selectedProject || undefined,
        limit: 200,
      }),
  });

  const { data: milestonesData, isLoading: msLoading } = useQuery({
    queryKey: ['milestones', 'calendar', selectedProject],
    queryFn: () =>
      milestonesApi.list({
        projectId: selectedProject || undefined,
        limit: 100,
      }),
  });

  const projects = projectsData?.data?.items || [];
  const tasks = useMemo(() => tasksData?.data?.items || [], [tasksData?.data?.items]);
  const milestones = useMemo(() => milestonesData?.data?.items || [], [milestonesData?.data?.items]);

  // Month navigation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Compute days in month
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Pad previous month days
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, dateStr: null, isCurrentMonth: false });
    }
    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, dateStr, isCurrentMonth: true });
    }
    return days;
  }, [year, month]);

  // Group events by date string "YYYY-MM-DD"
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push({ type: 'task', id: t.id, title: t.title, project: t.project_code, status: t.status, priority: t.priority });
    }
    for (const m of milestones) {
      if (!m.target_date) continue;
      const key = m.target_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push({ type: 'milestone', id: m.id, title: m.title, project: m.project_code, status: m.status });
    }
    return map;
  }, [tasks, milestones]);

  const todayStr = getTodayIso();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Calendar & Deadlines"
        subtitle="Track upcoming phase gates, inspection dates, and task due dates."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className={`${inputClass} w-auto`}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.project_code}] {p.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={goToToday}>
              Today
            </Button>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </button>
              <span className="px-2 text-xs font-semibold text-slate-900 dark:text-white">
                {monthName}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </button>
            </div>
          </div>
        }
      />

      {(tasksLoading || msLoading) && <LoadingSkeleton rows={5} />}

      {!tasksLoading && !msLoading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Main Month Grid */}
          <div className="lg:col-span-3">
            <Card className="overflow-hidden p-4">
              <div className="grid grid-cols-7 border-b border-slate-200 pb-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800">
                {calendarDays.map((cell, idx) => {
                  if (!cell.isCurrentMonth) {
                    return (
                      <div
                        key={`pad-${idx}`}
                        className="min-h-24 bg-slate-50/50 p-2 dark:bg-slate-900/40"
                      />
                    );
                  }

                  const dayEvents = eventsByDate[cell.dateStr] || [];
                  const isToday = cell.dateStr === todayStr;

                  return (
                    <div
                      key={cell.dateStr}
                      onClick={() =>
                        setSelectedDayEvents({ date: cell.dateStr, events: dayEvents })
                      }
                      className={`min-h-24 cursor-pointer bg-white p-2 transition hover:bg-blue-50/30 dark:bg-[#111827] dark:hover:bg-slate-800/60 ${
                        isToday ? 'ring-2 ring-blue-500 ring-inset' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${
                            isToday
                              ? 'bg-blue-600 font-bold text-white'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {cell.day}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] font-bold text-blue-500">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={`${ev.type}-${ev.id}`}
                            className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              ev.type === 'milestone'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                                : 'bg-blue-500/15 text-blue-600 dark:text-blue-300'
                            }`}
                          >
                            {ev.type === 'milestone' ? '🏁 ' : ''}
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <p className="text-[10px] text-slate-400">
                            +{dayEvents.length - 2} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Side Panel: Selected Day Details */}
          <div>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {selectedDayEvents
                  ? `Events on ${formatDate(selectedDayEvents.date)}`
                  : 'Upcoming Milestones'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {selectedDayEvents
                  ? `${selectedDayEvents.events.length} item(s) due`
                  : 'Key target deliverables'}
              </p>

              <div className="mt-4 space-y-3">
                {selectedDayEvents ? (
                  selectedDayEvents.events.length === 0 ? (
                    <p className="text-xs text-slate-400">No events scheduled for this day.</p>
                  ) : (
                    selectedDayEvents.events.map((ev) => (
                      <div
                        key={`${ev.type}-${ev.id}`}
                        className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/50"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] text-blue-500">[{ev.project}]</span>
                          <StatusBadge value={ev.status} />
                        </div>
                        {ev.type === 'task' ? (
                          <Link
                            to={`/tasks/${ev.id}`}
                            className="mt-1 block font-medium text-slate-900 hover:underline dark:text-white"
                          >
                            {ev.title}
                          </Link>
                        ) : (
                          <p className="mt-1 font-medium text-slate-900 dark:text-white">
                            🏁 {ev.title}
                          </p>
                        )}
                      </div>
                    ))
                  )
                ) : (
                  milestones.slice(0, 5).map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-blue-500">[{m.project_code}]</span>
                        <StatusBadge value={m.status} />
                      </div>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">{m.title}</p>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        Target: {formatDate(m.target_date)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
