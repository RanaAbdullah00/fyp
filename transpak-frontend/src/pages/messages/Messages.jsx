import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { AppContext } from '../../context/AppContext.jsx';
import * as chatApi from '../../services/chatApi.js';

const SEEN_DEBOUNCE_MS = 800;

/** Strict dedupe: Mongo _id or API `id`, else clientMessageId. */
function chatMessageDedupeKey(m) {
  if (!m) return null;
  const mid = m._id ?? m.id;
  if (mid != null && String(mid).trim() !== '') return `id:${String(mid)}`;
  if (m.clientMessageId != null && String(m.clientMessageId).trim() !== '') {
    return `c:${String(m.clientMessageId)}`;
  }
  return null;
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const Messages = () => {
  const { user } = useAuth();
  const { t, isUrdu } = useLanguage();
  const activeRole = user?.activeRole || user?.role || '';
  const uid = user?.id || user?._id;
  const app = useContext(AppContext);
  const getSocket = app?.getSocket;
  const registerChatMessageHandler = app?.registerChatMessageHandler;
  const registerChatSeenHandler = app?.registerChatSeenHandler;

  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [err, setErr] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newPeer, setNewPeer] = useState('');
  const [newLoad, setNewLoad] = useState('');
  const seenTimer = useRef(null);

  const mergeMessage = useCallback((convId, msg) => {
    if (!convId || !msg) return;
    const k = chatMessageDedupeKey(msg);
    if (!k) return;
    setMessagesByConv((prev) => {
      const list = prev[convId] || [];
      if (list.some((m) => chatMessageDedupeKey(m) === k)) return prev;
      return { ...prev, [convId]: [...list, msg] };
    });
  }, []);

  const loadThreads = useCallback(async () => {
    setLoadingList(true);
    setErr('');
    try {
      const rows = await chatApi.fetchConversations();
      setThreads(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to load conversations');
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (convId) => {
      if (!convId) return;
      setLoadingMsg(true);
      try {
        const rows = await chatApi.fetchMessages(convId, { limit: 80 });
        const raw = Array.isArray(rows) ? rows : [];
        const seen = new Set();
        const deduped = [];
        for (const m of raw) {
          const k = chatMessageDedupeKey(m);
          if (!k || seen.has(k)) continue;
          seen.add(k);
          deduped.push(m);
        }
        setMessagesByConv((prev) => ({ ...prev, [convId]: deduped }));
      } catch {
        setMessagesByConv((prev) => ({ ...prev, [convId]: prev[convId] || [] }));
      } finally {
        setLoadingMsg(false);
      }
    },
    []
  );

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    const peer = searchParams.get('peer');
    const load = searchParams.get('load');
    if (!peer) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await chatApi.openConversation({
          peerUserId: peer,
          loadId: load || undefined
        });
        if (cancelled || !data?.conversationId) return;
        await loadThreads();
        setActiveId(data.conversationId);
        setSearchParams({}, { replace: true });
      } catch {
        // ignore invalid deep link
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, loadThreads]);

  useEffect(() => {
    if (!registerChatMessageHandler) return undefined;
    return registerChatMessageHandler((msg) => {
      const cid = msg?.conversationId;
      if (!cid) return;
      mergeMessage(cid, msg);
      setThreads((prev) =>
        prev.map((t) =>
          t.id === cid
            ? { ...t, lastPreview: msg.body?.slice(0, 120), lastMessageAt: msg.createdAt }
            : t
        )
      );
    });
  }, [registerChatMessageHandler, mergeMessage]);

  useEffect(() => {
    if (!registerChatSeenHandler) return undefined;
    return registerChatSeenHandler(() => {
      if (activeId) loadMessages(activeId);
    });
  }, [registerChatSeenHandler, activeId, loadMessages]);

  useEffect(() => {
    if (!activeId) return undefined;
    loadMessages(activeId);
    const s = getSocket?.();
    if (!s) return undefined;
    const join = () => {
      s.emit('chat:join', { conversationId: activeId }, () => {});
    };
    join();
    s.on('connect', join);
    return () => {
      s.off('connect', join);
    };
  }, [activeId, loadMessages, getSocket]);

  const scheduleSeen = useCallback(
    (convId) => {
      if (!convId || !getSocket) return;
      if (seenTimer.current) window.clearTimeout(seenTimer.current);
      seenTimer.current = window.setTimeout(() => {
        const list = messagesByConv[convId] || [];
        const last = list[list.length - 1];
        const lastId = last?._id ?? last?.id ?? null;
        const s = getSocket();
        if (s?.connected) {
          s.emit('chat:seen', { conversationId: convId, upToMessageId: lastId });
        }
        chatApi.markConversationReadHttp(convId, lastId).catch(() => {});
      }, SEEN_DEBOUNCE_MS);
    },
    [getSocket, messagesByConv]
  );

  useEffect(() => {
    if (activeId) scheduleSeen(activeId);
    return () => {
      if (seenTimer.current) window.clearTimeout(seenTimer.current);
    };
  }, [activeId, messagesByConv, scheduleSeen]);

  const active = useMemo(() => threads.find((x) => x.id === activeId), [threads, activeId]);
  const messages = activeId ? messagesByConv[activeId] || [] : [];

  const send = async () => {
    if (!draft.trim() || !activeId) return;
    const text = draft.trim();
    setDraft('');
    const clientMessageId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    try {
      const msg = await chatApi.sendMessageHttp(activeId, text, clientMessageId);
      mergeMessage(activeId, msg);
      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, lastPreview: text, lastMessageAt: msg?.createdAt } : t
        )
      );
    } catch (e) {
      setDraft(text);
      setErr(e?.response?.data?.message || e?.message || 'Send failed');
    }
  };

  const openNew = async () => {
    setErr('');
    if (!newPeer.trim()) return;
    try {
      const data = await chatApi.openConversation({
        peerUserId: newPeer.trim(),
        loadId: newLoad.trim() || undefined
      });
      setShowNew(false);
      setNewPeer('');
      setNewLoad('');
      await loadThreads();
      if (data?.conversationId) setActiveId(data.conversationId);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Could not open chat');
    }
  };

  return (
    <div className={`container py-3 ${isUrdu ? 'tp-rtl' : ''}`}>
      <h5 className="mb-3">{t('common.messages')}</h5>
      {err ? <div className="alert alert-warning py-2 small mb-2">{err}</div> : null}

      <div className="row g-2">
        <div className="col-12 col-lg-4">
          <Card>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">{t('common.messages')}</h6>
              <Button variant="outline-primary" className="btn-sm" type="button" onClick={() => setShowNew(true)}>
                {isUrdu ? 'نیا' : 'New'}
              </Button>
            </div>
            {loadingList ? (
              <div className="small text-muted">{isUrdu ? 'لوڈ ہو رہا ہے…' : 'Loading…'}</div>
            ) : threads.length === 0 ? (
              <div className="small text-muted">
                {isUrdu
                  ? 'کوئی گفتگو نہیں۔ نیا چیٹ شروع کریں یا قبول شدہ لوڈ سے لنک استعمال کریں۔'
                  : 'No conversations yet. Start one with “New” or open from an accepted load link (?peer=&load=).'}
              </div>
            ) : (
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
                      <span>{th.peerName || 'User'}</span>
                      <small className="text-muted">{formatTime(th.lastMessageAt)}</small>
                    </div>
                    <div className="small text-muted text-truncate">{th.lastPreview || '—'}</div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="col-12 col-lg-8">
          <Card>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <div className="fw-semibold">{active?.peerName || (activeId ? '…' : '—')}</div>
                <div className="small text-muted text-capitalize">{activeRole}</div>
              </div>
            </div>

            {!activeId ? (
              <div className="small text-muted py-4 text-center">
                {isUrdu ? 'گفتگو منتخب کریں' : 'Select a conversation'}
              </div>
            ) : (
              <>
                <div className="tp-chat-box rounded-4 p-2 mb-2" style={{ minHeight: 220 }}>
                  {loadingMsg && messages.length === 0 ? (
                    <div className="small text-muted p-2">{isUrdu ? 'لوڈ…' : 'Loading…'}</div>
                  ) : null}
                  {messages.map((m, idx) => {
                    const mine = String(m.senderId) === String(uid);
                    return (
                      <div
                        key={chatMessageDedupeKey(m) || `m-${idx}`}
                        className={`d-flex mb-2 ${mine ? 'justify-content-end' : 'justify-content-start'}`}
                      >
                        <div className={`tp-chat-bubble ${mine ? 'me' : 'them'}`}>
                          <div className="small">{m.body}</div>
                          <div className="tp-chat-time d-flex align-items-center gap-1">
                            <span>{formatTime(m.createdAt)}</span>
                            {mine && m.seenByPeer ? <span title="Seen">✓✓</span> : mine ? <span>✓</span> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                  <Button variant="primary" className="btn-sm px-3" type="button" onClick={send}>
                    {isUrdu ? 'بھیجیں' : 'Send'}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {showNew ? (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header py-2">
                <h6 className="modal-title">{isUrdu ? 'نیا چیٹ' : 'New chat'}</h6>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowNew(false)} />
              </div>
              <div className="modal-body">
                <label className="form-label small">Peer user ID (Mongo)</label>
                <input
                  className="form-control form-control-sm mb-2"
                  value={newPeer}
                  onChange={(e) => setNewPeer(e.target.value)}
                  placeholder="507f1f77bcf86cd799439011"
                />
                <label className="form-label small">{isUrdu ? 'لوڈ (اختیاری)' : 'Load ID (optional)'}</label>
                <input
                  className="form-control form-control-sm"
                  value={newLoad}
                  onChange={(e) => setNewLoad(e.target.value)}
                />
              </div>
              <div className="modal-footer py-2">
                <Button variant="secondary" className="btn-sm" type="button" onClick={() => setShowNew(false)}>
                  {isUrdu ? 'بند' : 'Cancel'}
                </Button>
                <Button variant="primary" className="btn-sm" type="button" onClick={openNew}>
                  {isUrdu ? 'کھولیں' : 'Open'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Messages;
