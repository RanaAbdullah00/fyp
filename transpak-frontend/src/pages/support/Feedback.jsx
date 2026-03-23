import React, { useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';

// Simple feedback form.
const Feedback = () => {
  const [form, setForm] = useState({ subject: '', message: '' });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Feedback submitted (demo only).');
    setForm({ subject: '', message: '' });
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
          <Button variant="primary" className="w-100" type="submit">
            Submit feedback
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Feedback;

