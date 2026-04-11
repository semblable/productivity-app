import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../api/apiClient';
import {
  RefreshCw,
  Unplug,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  CalendarDays,
} from 'lucide-react';

export const GoogleCalendarSettings = () => {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [calendars, setCalendars] = useState([]);

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['gcal-status'],
    queryFn: () => api.gcal.getStatus(),
    refetchInterval: 30000, // poll every 30s
  });

  const loadCalendars = useCallback(async () => {
    if (!status?.connected) return;
    try {
      const cals = await api.gcal.listCalendars();
      setCalendars(cals);
    } catch {
      // silently fail — user might not be connected yet
    }
  }, [status?.connected]);

  useEffect(() => {
    loadCalendars();
  }, [loadCalendars]);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcalParam = params.get('gcal');
    if (gcalParam === 'connected') {
      toast.success('Google Calendar connected successfully!');
      refetchStatus();
      // Clean the URL
      const url = new URL(window.location);
      url.searchParams.delete('gcal');
      window.history.replaceState({}, '', url.pathname);
    } else if (gcalParam === 'error') {
      const message = params.get('message') || 'Connection failed';
      toast.error(`Google Calendar: ${message}`);
      const url = new URL(window.location);
      url.searchParams.delete('gcal');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.pathname);
    }
  }, [refetchStatus]);

  const handleConnect = async () => {
    try {
      const { url } = await api.gcal.getAuthUrl();
      window.location.href = url;
    } catch (err) {
      toast.error(err.message || 'Failed to get auth URL');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Calendar? Events already synced will remain.')) return;
    try {
      await api.gcal.disconnect();
      toast.success('Google Calendar disconnected');
      setCalendars([]);
      refetchStatus();
    } catch (err) {
      toast.error('Failed to disconnect');
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await api.gcal.sync();
      if (result.success) {
        const { pull, push } = result;
        toast.success(
          `Synced! Pulled: ${pull.created + pull.updated + pull.deleted} changes, Pushed: ${push.created + push.updated} changes`
        );
        queryClient.invalidateQueries();
      } else if (result.skipped) {
        toast('Sync skipped — not connected', { icon: 'ℹ️' });
      } else {
        toast.error(`Sync failed: ${result.error}`);
      }
      refetchStatus();
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCalendarChange = async (calendarId) => {
    try {
      await api.gcal.updateSettings({ calendarId });
      toast.success('Calendar changed — next sync will pull from new calendar');
      refetchStatus();
    } catch (err) {
      toast.error('Failed to update calendar');
    }
  };

  const formatLastSync = (iso) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString();
  };

  if (!status) {
    return (
      <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Loading Google Calendar status...
        </div>
      </div>
    );
  }

  if (!status.configured) {
    return (
      <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
        <h2 className="text-lg font-bold mb-2 text-card-foreground flex items-center gap-2">
          <CalendarDays size={20} />
          Google Calendar
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          To enable Google Calendar sync, add your API credentials to the{' '}
          <code className="bg-secondary px-1 rounded text-xs">.env</code> file:
        </p>
        <pre className="bg-secondary p-3 rounded text-xs overflow-x-auto text-muted-foreground">
{`GCAL_CLIENT_ID=your_client_id
GCAL_CLIENT_SECRET=your_client_secret
GCAL_REDIRECT_URI=http://localhost:3001/api/gcal/callback`}
        </pre>
      </div>
    );
  }

  return (
    <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
      <h2 className="text-lg font-bold mb-4 text-card-foreground flex items-center gap-2">
        <CalendarDays size={20} />
        Google Calendar
      </h2>

      {!status.connected ? (
        // --- Disconnected state ---
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <XCircle size={16} className="text-red-400" />
            Not connected
          </div>
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 w-full p-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <ExternalLink size={16} />
            Connect Google Calendar
          </button>
        </div>
      ) : (
        // --- Connected state ---
        <div className="space-y-4">
          {/* Status indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 size={16} className="text-green-400" />
              <span className="text-green-400 font-medium">Connected</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Last sync: {formatLastSync(status.lastSyncAt)}
            </span>
          </div>

          {/* Calendar selector */}
          {calendars.length > 0 && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Sync with calendar:
              </label>
              <select
                value={status.calendarId || 'primary'}
                onChange={(e) => handleCalendarChange(e.target.value)}
                className="w-full p-2 rounded-md bg-secondary text-foreground text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              >
                {calendars.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.summary}
                    {cal.primary ? ' (Primary)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center justify-center gap-2 p-2 rounded-md text-sm font-medium bg-secondary hover:bg-border text-secondary-foreground transition-colors disabled:opacity-50"
            >
              {isSyncing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center justify-center gap-2 p-2 rounded-md text-sm font-medium bg-red-600/10 hover:bg-red-600/20 text-red-400 transition-colors"
            >
              <Unplug size={16} />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
