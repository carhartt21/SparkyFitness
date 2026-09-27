import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2 } from 'lucide-react';
import { AccordionContent, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useEngagementApi } from '@/hooks/Engagement/useEngagementApi';

type Connection = {
  id: string;
  name: string;
  scopes: string[];
  created_at: string;
};

export default function McpConnectionsSettings() {
  const { fetchMcpConnections, revokeMcpConnection } = useEngagementApi();
  const { i18n } = useTranslation();
  const de = i18n.language.startsWith('de');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    void fetchMcpConnections()
      .then(async (response) => {
        if (response.status === 503) return { connections: [] };
        if (!response.ok) throw new Error('load');
        return response.json() as Promise<{ connections: Connection[] }>;
      })
      .then((data) => {
        if (mounted) setConnections(data.connections);
      })
      .catch(() => {
        if (mounted)
          setError(
            de
              ? 'Verbindungen konnten nicht geladen werden.'
              : 'Connections could not be loaded.'
          );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [de, fetchMcpConnections]);

  async function revoke(id: string): Promise<void> {
    setBusyId(id);
    setError(null);
    try {
      const response = await revokeMcpConnection(id);
      if (!response.ok) throw new Error('revoke');
      setConnections((existing) =>
        existing.filter((connection) => connection.id !== id)
      );
    } catch {
      setError(
        de
          ? 'Verbindung konnte nicht getrennt werden.'
          : 'Could not disconnect the assistant.'
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AccordionTrigger
        className="p-4 hover:no-underline"
        description={
          de
            ? 'Zugriff verbundener Assistenten prüfen und beenden.'
            : 'Review and end assistant access to your account.'
        }
      >
        <span className="flex items-center gap-3">
          <Link2 className="h-5 w-5 text-primary" aria-hidden="true" />
          {de ? 'Verbundene Assistenten' : 'Connected assistants'}
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 p-4 pt-0">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {loading ? (
          <p aria-live="polite">{de ? 'Wird geladen…' : 'Loading…'}</p>
        ) : connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {de ? 'Keine Assistenten verbunden.' : 'No assistants connected.'}
          </p>
        ) : (
          connections.map((connection) => (
            <div
              key={connection.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
            >
              <div>
                <p className="font-medium">{connection.name}</p>
                <p className="text-sm text-muted-foreground">
                  {connection.scopes.includes('mcp:write')
                    ? de
                      ? 'Lesen und Schreiben'
                      : 'Read and write'
                    : de
                      ? 'Nur lesen'
                      : 'Read only'}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={busyId !== null}
                onClick={() => void revoke(connection.id)}
              >
                {de ? 'Trennen' : 'Disconnect'}
              </Button>
            </div>
          ))
        )}
      </AccordionContent>
    </>
  );
}
