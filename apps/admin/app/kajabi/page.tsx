'use client';

import { useState, useEffect } from 'react';
import { Card } from '@elevate/ui/Card';
import { Button } from '@elevate/ui/Button';
import { Input } from '@elevate/ui/Input';
import { Alert } from '@elevate/ui/Alert';
import { LoadingSpinner } from '@elevate/ui/LoadingSpinner';
import { withRoleGuard } from '@elevate/auth/context';

interface KajabiEvent {
  id: string;
  received_at: string;
  processed_at: string | null;
  user_match: string | null;
  payload: any;
}

interface Stats {
  total_events: number;
  processed_events: number;
  matched_users: number;
  unmatched_events: number;
  points_awarded: number;
}

function KajabiPage() {
  const [events, setEvents] = useState<KajabiEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    fetchKajabiData();
  }, []);

  const fetchKajabiData = async () => {
    try {
      const response = await fetch('/api/admin/kajabi');
      if (!response.ok) throw new Error('Failed to fetch Kajabi data');
      const data = await response.json();
      setEvents(data.events || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!testEmail) {
      setError('Please enter an email address');
      return;
    }

    setTestLoading(true);
    setTestResult(null);
    setError(null);

    try {
      const response = await fetch('/api/kajabi/webhook', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: testEmail,
          course_name: 'Test Course - Admin Console',
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Test failed');
      }

      setTestResult(data);
      // Refresh the events list
      await fetchKajabiData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTestLoading(false);
    }
  };

  const handleReprocess = async (eventId: string) => {
    try {
      const response = await fetch(`/api/admin/kajabi/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      });

      if (!response.ok) throw new Error('Failed to reprocess event');
      
      await fetchKajabiData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reprocess failed');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kajabi Integration</h1>
        <p className="text-gray-600 mt-2">
          Manage Kajabi webhook events and automatic Learn stage crediting
        </p>
      </div>

      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Events</div>
            <div className="text-2xl font-bold">{stats.total_events}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Processed</div>
            <div className="text-2xl font-bold text-green-600">
              {stats.processed_events}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Matched Users</div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.matched_users}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Unmatched</div>
            <div className="text-2xl font-bold text-orange-600">
              {stats.unmatched_events}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Points Awarded</div>
            <div className="text-2xl font-bold text-purple-600">
              {stats.points_awarded}
            </div>
          </Card>
        </div>
      )}

      {/* Test Webhook */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Test Webhook</h2>
        <div className="flex gap-4">
          <Input
            type="email"
            placeholder="Enter user email to test"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={handleTestWebhook}
            disabled={testLoading || !testEmail}
          >
            {testLoading ? 'Testing...' : 'Send Test Event'}
          </Button>
        </div>
        
        {testResult && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
            <div className="text-sm font-medium text-green-800">Test Successful!</div>
            <pre className="text-xs mt-2 text-green-700">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      {/* Recent Events */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Events</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Event ID</th>
                <th className="text-left p-2">Received</th>
                <th className="text-left p-2">User Email</th>
                <th className="text-left p-2">Course</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-mono text-sm">
                    {event.id.substring(0, 8)}...
                  </td>
                  <td className="p-2 text-sm">
                    {new Date(event.received_at).toLocaleString()}
                  </td>
                  <td className="p-2 text-sm">
                    {event.payload?.user_email || 'N/A'}
                  </td>
                  <td className="p-2 text-sm">
                    {event.payload?.course_name || 'N/A'}
                  </td>
                  <td className="p-2">
                    {event.processed_at ? (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                        Processed
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    {!event.processed_at && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReprocess(event.id)}
                      >
                        Reprocess
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {events.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No Kajabi events received yet
            </div>
          )}
        </div>
      </Card>

      {/* Configuration Info */}
      <Card className="p-6 bg-blue-50">
        <h3 className="font-semibold mb-2">Webhook Configuration</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Webhook URL:</span>{' '}
            <code className="bg-white px-2 py-1 rounded">
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/kajabi/webhook
            </code>
          </div>
          <div>
            <span className="font-medium">HTTP Method:</span> POST
          </div>
          <div>
            <span className="font-medium">Events to Subscribe:</span> course.completed, offer.purchased
          </div>
          <div>
            <span className="font-medium">Headers Required:</span> X-Kajabi-Signature
          </div>
        </div>
      </Card>
    </div>
  );
}

export default withRoleGuard(KajabiPage, ['ADMIN', 'SUPERADMIN']);