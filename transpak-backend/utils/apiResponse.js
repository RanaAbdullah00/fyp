/**
 * Standard API envelope for TransPak backend.
 * { success, message, data }
 */
function sendSuccess(res, statusCode, data, message = "OK") {
  return res.status(statusCode || 200).json({
    success: true,
    message,
    data: data !== undefined ? data : null
  });
}

function sendError(res, statusCode, message, data = null) {
  return res.status(statusCode || 400).json({
    success: false,
    message: message || "Error",
    data
  });
}

module.exports = { sendSuccess, sendError };
