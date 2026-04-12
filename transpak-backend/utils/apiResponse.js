/**
 * Standard API envelope for TransPak backend.
 * { success, message, data }
 */
function sendSuccess(res, statusCode, data, message = "OK", code = null) {
  const payload = {
    success: true,
    message,
    data: data !== undefined ? data : null
  };
  if (code) payload.code = code;
  return res.status(statusCode || 200).json(payload);
}

function sendError(res, statusCode, message, data = null, code = null) {
  const payload = {
    success: false,
    message: message || "Error",
    data: data !== undefined ? data : null
  };
  if (code) payload.code = code;
  return res.status(statusCode || 400).json(payload);
}

module.exports = { sendSuccess, sendError };
