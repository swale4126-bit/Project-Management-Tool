import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  FileCheck,
  Flame,
  Mail,
  Scan,
} from 'lucide-react';
import { notificationsApi } from '../api/endpoints.js';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  PageHeader,
} from '../components/ui/Primitives.jsx';
import { formatDateTime } from '../utils/format.js';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications', { unreadOnly }],
    queryFn: () => notificationsApi.list({ unreadOnly: unreadOnly ? 'true' : undefined, limit: 100 }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const checkDeadlinesMutation = useMutation({
    mutationFn: () => notificationsApi.checkDeadlines(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = data?.data?.items || [];
  const unreadCount = data?.data?.unreadCount || 0;

  const getTypeIcon = (type) => {
    switch (type) {
      case 'deadline_approaching':
      case 'deadline_overdue':
        return <Clock className="h-4 w-4 text-rose-500" />;
      case 'field_report_submitted':
      case 'field_report_approved':
        return <FileCheck className="h-4 w-4 text-emerald-500" />;
      case 'risk_escalated':
        return <Flame className="h-4 w-4 text-amber-500" />;
      default:
        return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications & Alerts"
        subtitle="Operational notifications, automated deadline reminders, and sign-off updates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => checkDeadlinesMutation.mutate()}
              disabled={checkDeadlinesMutation.isPending}
            >
              <Scan className="h-3.5 w-3.5" />
              {checkDeadlinesMutation.isPending ? 'Scanning...' : 'Scan Deadlines'}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark All as Read
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setUnreadOnly(false)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            !unreadOnly
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          All Notifications
        </button>
        <button
          type="button"
          onClick={() => setUnreadOnly(true)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            unreadOnly
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Unread Only {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      {isLoading && <LoadingSkeleton rows={5} />}
      {isError && <ErrorBanner message={error?.response?.data?.message} onRetry={refetch} />}

      {!isLoading && !isError && notifications.length === 0 && (
        <EmptyState
          icon={Mail}
          title={unreadOnly ? 'No unread notifications' : 'Your inbox is clear'}
          description="You'll be alerted when tasks are assigned, field reports need review, or milestone deadlines approach."
        />
      )}

      {!isLoading && !isError && notifications.length > 0 && (
        <Card className="divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`flex items-start justify-between gap-4 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                !notif.is_read ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                  {getTypeIcon(notif.notification_type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {notif.title}
                    </h4>
                    {!notif.is_read && (
                      <span className="h-2 w-2 rounded-full bg-blue-600" title="Unread" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{notif.message}</p>
                  <p className="mt-2 text-[10px] text-slate-400">
                    {formatDateTime(notif.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!notif.is_read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => markReadMutation.mutate(notif.id)}
                    title="Mark as read"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                )}
                {notif.entity_type === 'task' && notif.entity_id && (
                  <Link
                    to={`/tasks/${notif.entity_id}`}
                    className="text-slate-400 hover:text-blue-500"
                    title="View task"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
