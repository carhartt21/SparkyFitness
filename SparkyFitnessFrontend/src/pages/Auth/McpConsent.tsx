import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useMcpAuthorization } from '@/hooks/Auth/useMcpAuthorization';

type ConsentResponse = {
  redirect_uri?: string;
  message?: string;
  error?: string;
};

export default function McpConsent() {
  const { fetchMcpPublicClient, submitMcpConsent } = useMcpAuthorization();
  const { i18n } = useTranslation();
  const de = i18n.language.startsWith('de');
  const { user, loading } = useAuth();
  const [clientName, setClientName] = useState('the connected assistant');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = window.location.search.replace(/^\?/, '');
  const params = new URLSearchParams(query);
  const clientId = params.get('client_id');
  const scopes = (params.get('scope') ?? '').split(/\s+/).filter(Boolean);

  useEffect(() => {
    if (!loading && !user) {
      window.location.assign(`/login?${query}`);
    }
  }, [loading, user, query]);

  useEffect(() => {
    if (!clientId || !user) return;
    const controller = new AbortController();
    void fetchMcpPublicClient(clientId, controller.signal)
      .then(async (response) => {
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (
          data &&
          typeof data === 'object' &&
          'name' in data &&
          typeof data.name === 'string'
        ) {
          setClientName(data.name);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [clientId, user, fetchMcpPublicClient]);

  async function decide(accept: boolean): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const response = await submitMcpConsent(query, accept);
      const result = (await response.json()) as ConsentResponse;
      if (!response.ok || !result.redirect_uri) {
        throw new Error(
          result.message ??
            result.error ??
            'Authorization could not be completed.'
        );
      }
      window.location.assign(result.redirect_uri);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Authorization could not be completed.'
      );
      setPending(false);
    }
  }

  if (loading || !user)
    return (
      <main className="p-6">
        {de ? 'Anmeldung wird geprüft…' : 'Checking your session…'}
      </main>
    );
  if (!clientId || !params.has('sig'))
    return (
      <main className="p-6">
        {de
          ? 'Ungültige Verbindungsanfrage.'
          : 'Invalid authorization request.'}
      </main>
    );
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            {de
              ? `${clientName} mit X on Track verbinden?`
              : `Connect ${clientName} to X on Track?`}
          </CardTitle>
          <CardDescription>
            {de
              ? 'Entscheide, ob dieser Assistent auf dein Konto zugreifen darf. Du kannst die Verbindung später in den Kontoeinstellungen trennen.'
              : 'Choose whether this assistant can access your account. You can disconnect it later in your account settings.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2 text-sm">
            {scopes.includes('mcp:read') && (
              <p>
                {de
                  ? 'Lebensmittel-, Trainings- und Benachrichtigungsdaten lesen.'
                  : 'Read food, exercise, and notification information.'}
              </p>
            )}
            {scopes.includes('mcp:write') && (
              <p>
                {de
                  ? 'Auf deine Anweisung Lebensmittel- und Trainingseinträge sowie Benachrichtigungseinstellungen ändern.'
                  : 'Add or change food and exercise entries, and change notification settings when you ask.'}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button disabled={pending} onClick={() => void decide(true)}>
              {de ? 'Verbinden' : 'Connect'}
            </Button>
            <Button
              disabled={pending}
              variant="outline"
              onClick={() => void decide(false)}
            >
              {de ? 'Abbrechen' : 'Cancel'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
