import api from './api.js';

export async function fetchConversations() {
  const res = await api.get('/chat/conversations');
  return res.data;
}

export async function fetchMessages(conversationId, { before, limit } = {}) {
  const res = await api.get(`/chat/conversations/${conversationId}/messages`, {
    params: { before, limit }
  });
  return res.data;
}

export async function openConversation({ peerUserId, loadId }) {
  const res = await api.post('/chat/conversations/open', { peerUserId, loadId });
  return res.data;
}

export async function sendMessageHttp(conversationId, body, clientMessageId) {
  const res = await api.post(`/chat/conversations/${conversationId}/messages`, {
    body,
    clientMessageId
  });
  return res.data;
}

export async function markConversationReadHttp(conversationId, upToMessageId) {
  const res = await api.post(`/chat/conversations/${conversationId}/read`, {
    upToMessageId
  });
  return res.data;
}
