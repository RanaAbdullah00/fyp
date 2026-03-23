import React, { useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';

// Simple in-app messaging UI (demo). Later wire to WebSocket / REST inbox.
const Messages = () => {
  const { user } = useAuth();
  const { t, isUrdu } = useLanguage();
  const activeRole = user?.activeRole || user?.role || '';

  const [threads] = useState([
    { id: 1, name: 'PakTrans Logistics', last: 'Can you confirm pickup window?', time: '5m' },
    { id: 2, name: 'Alpha FMCG Shipper', last: 'Bid received. Reviewing.', time: '2h' }
  ]);
  const [activeId, setActiveId] = useState(threads[0]?.id);
  const active = threads.find((x) => x.id === activeId);

  const [messages, setMessages] = useState([
    { id: 1, from: 'them', text: 'Assalam-o-Alaikum, pickup timing?', time: '10:12' },
    { id: 2, from: 'me', text: 'Walaikum Salam. Pickup 8-10 AM works.', time: '10:14' }
  ]);
  const [draft, setDraft] = useState('');

  const send = () => {
    if (!draft.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), from: 'me', text: draft.trim(), time: 'now' }
    ]);
    setDraft('');
  };

  return (
    <div className={`container py-3 ${isUrdu ? 'tp-rtl' : ''}`}>
      <h5 className="mb-3">{t('common.messages')}</h5>

      <div className="row g-2">
        <div className="col-12 col-lg-4">
          <Card>
            <h6 className="mb-2">{t('common.messages')}</h6>
            <div className="list-group list-group-flush">
              {threads.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  className={`list-group-item list-group-item-action border-0 px-0 ${
                    th.id === activeId ? 'fw-semibold' : ''
                  }`}
                  onClick={() => setActiveId(th.id)}
                >
                  <div className="d-flex justify-content-between">
                    <span>{th.name}</span>
                    <small className="text-muted">{th.time}</small>
                  </div>
                  <div className="small text-muted">{th.last}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="col-12 col-lg-8">
          <Card>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <div className="fw-semibold">{active?.name || '-'}</div>
                <div className="small text-muted text-capitalize">{activeRole}</div>
              </div>
            </div>

            <div className="tp-chat-box rounded-4 p-2 mb-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`d-flex mb-2 ${m.from === 'me' ? 'justify-content-end' : 'justify-content-start'}`}
                >
                  <div className={`tp-chat-bubble ${m.from === 'me' ? 'me' : 'them'}`}>
                    <div className="small">{m.text}</div>
                    <div className="tp-chat-time">{m.time}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="d-flex gap-2">
              <input
                className={`form-control form-control-sm rounded-pill ${isUrdu ? 'text-end' : ''}`}
                placeholder={isUrdu ? 'پیغام لکھیں…' : 'Type a message…'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button variant="primary" className="btn-sm px-3" onClick={send}>
                {isUrdu ? 'بھیجیں' : 'Send'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Messages;

