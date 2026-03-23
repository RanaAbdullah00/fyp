/**
 * Unwraps standard backend envelope { success, message, data } or returns legacy body.
 */
export function unwrapResponseData(res) {
  const body = res?.data;
  if (body && typeof body.success === 'boolean' && 'data' in body) {
    return body.data;
  }
  return body;
}

/** Error payload from axios err.response.data */
export function unwrapErrorMessage(err) {
  const d = err?.response?.data;
  if (!d) return err?.message || '';
  if (typeof d.message === 'string') return d.message;
  if (typeof d.error === 'string') return d.error;
  return err?.message || '';
}
