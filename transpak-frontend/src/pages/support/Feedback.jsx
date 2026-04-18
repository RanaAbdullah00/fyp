import React, { useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import api from '../../services/api.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';

// Simple feedback form.
const Feedback = () => {
  const [form, setForm] = useState({ subject: '', message: '' });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/notifications', {
        title: form.subject.trim().slice(0, 120),
        message: form.message.trim().slice(0, 2000),
        roleType: 'support',
        meta: { type: 'FEEDBACK' }
      });
      notifySuccess('Feedback submitted');
      setForm({ subject: '', message: '' });
    } catch (err) {
      notifyError(err?.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Feedback</h5>
      <Card>
        <form onSubmit={handleSubmit}>
          <div className="mb-2">
            <label className="form-label small">Subject</label>
            <input
              name="subject"
              className="form-control form-control-sm rounded-3"
              placeholder="Feedback subject"
              value={form.subject}
              onChange={handleChange}
            />
          </div>
          <div className="mb-3">
            <label className="form-label small">Message</label>
            <textarea
              name="message"
              className="form-control form-control-sm rounded-3"
              placeholder="Your comments about the platform"
              rows={4}
              value={form.message}
              onChange={handleChange}
            />
          </div>
          <Button
            variant="primary"
            className="w-100"
            type="submit"
            disabled={submitting || !form.subject.trim() || !form.message.trim()}
          >
            {submitting ? 'Submitting…' : 'Submit feedback'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Feedback;

