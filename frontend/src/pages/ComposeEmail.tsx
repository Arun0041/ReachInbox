import { useState, type FormEvent } from 'react';
import { emailsApi } from '../api/emails';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';
import { toLocalInputValue } from '../utils/format';

export function ComposeEmail(): JSX.Element {
  const { addToast } = useToast();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError('All fields are required.');
      return;
    }
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime())) {
      setError('Please enter a valid scheduled time.');
      return;
    }
    setLoading(true);
    try {
      await emailsApi.create({ to: to.trim(), subject: subject.trim(), body, scheduledAt: date.toISOString() });
      addToast('Email scheduled successfully.');
      setTo('');
      setSubject('');
      setBody('');
      setScheduledAt(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Compose Email</h2>
        <p>Pick a recipient and a future send time.</p>
      </div>
      <form className="form" onSubmit={handleSubmit}>
        <Input
          label="Recipient"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com"
          required
        />
        <Input
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Meeting reminder"
          maxLength={200}
          required
        />
        <Textarea
          label="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Hi, just a reminder that we meet at 3pm tomorrow…"
          rows={6}
          required
        />
        <Input
          label="Scheduled time"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          hint="Local time. You can schedule up to 48 hours ahead."
          required
        />
        {error && <p className="form__error">{error}</p>}
        <div className="form__actions">
          <Button type="submit" loading={loading}>
            Schedule email
          </Button>
        </div>
      </form>
    </section>
  );
}