import React, { useEffect, useState } from 'react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';

const ReviewsSection = ({ userId }) => {
  const { request, loading } = useApi();
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ toUser: '', rating: 5, comment: '', loadId: '' });

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const data = await request({ method: 'GET', url: `/reviews/${userId}` });
        setList(Array.isArray(data) ? data : []);
      } catch {
        setList([]);
      }
    })();
  }, [userId, request]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await request({
        method: 'POST',
        url: '/reviews',
        data: {
          toUser: form.toUser.trim(),
          rating: Number(form.rating),
          comment: form.comment.trim(),
          loadId: form.loadId.trim() || undefined
        }
      });
      notifySuccess('Review submitted');
      setForm((f) => ({ ...f, comment: '', loadId: '' }));
      const data = await request({ method: 'GET', url: `/reviews/${userId}` });
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      notifyError(err?.message || 'Could not submit review');
    }
  };

  return (
    <div className="mt-4">
      <h6 className="mb-2">Reviews</h6>
      <Card className="p-3 mb-3">
        <div className="small text-muted mb-2">Submit a rating (1–5). Optional load ID prevents duplicate reviews per shipment.</div>
        <form onSubmit={submit} className="row g-2">
          <div className="col-md-4">
            <label className="form-label small mb-0">User ID (reviewee)</label>
            <input
              className="form-control form-control-sm"
              value={form.toUser}
              onChange={(e) => setForm((f) => ({ ...f, toUser: e.target.value }))}
              placeholder="User ID (UUID)"
              required
            />
          </div>
          <div className="col-md-4">
            <label className="form-label small mb-0 d-block">Rating</label>
            <div className="d-flex gap-1 flex-wrap tp-star-row" role="group" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn btn-sm tp-star-btn ${Number(form.rating) >= n ? 'tp-star-on' : 'btn-outline-secondary'}`}
                  onClick={() => setForm((f) => ({ ...f, rating: n }))}
                  aria-pressed={Number(form.rating) >= n}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-0">Load ID (optional)</label>
            <input
              className="form-control form-control-sm"
              value={form.loadId}
              onChange={(e) => setForm((f) => ({ ...f, loadId: e.target.value }))}
              placeholder="Shipment / load id"
            />
          </div>
          <div className="col-md-12">
            <label className="form-label small mb-0">Comment</label>
            <textarea
              className="form-control form-control-sm"
              rows={2}
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              maxLength={500}
            />
          </div>
          <div className="col-12">
            <Button type="submit" variant="primary" size="sm" disabled={loading}>
              Submit review
            </Button>
          </div>
        </form>
      </Card>
      <Card className="p-0">
        {loading && !list.length ? (
          <div className="text-center py-4">
            <Loader />
          </div>
        ) : (
          <ul className="list-group list-group-flush small">
            {list.map((r) => (
              <li key={r.id} className="list-group-item d-flex justify-content-between align-items-start">
                <div>
                  <div className="fw-semibold">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                  <div className="text-muted">{r.comment || '—'}</div>
                </div>
                <div className="text-muted text-nowrap">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</div>
              </li>
            ))}
            {!list.length && (
              <li className="list-group-item text-muted text-center py-4 tp-empty-state">
                <div className="fw-semibold mb-1">No reviews yet</div>
                <div className="small">Ratings left for you will show here.</div>
              </li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default ReviewsSection;
