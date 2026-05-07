const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const { getPool, query: db } = require("../db/pool");

const router = express.Router();

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function handleVal(req, res, next) {
  const e = validationResult(req);
  if (!e.isEmpty()) {
    const first = e.array()[0];
    return sendError(res, 400, first.msg || "Validation failed");
  }
  return next();
}

router.post(
  "/conversations/open",
  protect,
  body("peerUserId")
    .custom((v) => (isUuid(v) ? true : (() => { throw new Error("Invalid peerUserId"); })()))
    .bail(),
  body("loadId")
    .optional()
    .custom((v) => (isUuid(v) ? true : (() => { throw new Error("Invalid loadId"); })()))
    .bail(),
  handleVal,
  async (req, res) => {
    const me = String(req.auth.userId);
    const peer = String(req.body.peerUserId);
    const loadId = req.body.loadId ? String(req.body.loadId) : null;

    // canonical ordering for unique constraint
    const userA = me < peer ? me : peer;
    const userB = me < peer ? peer : me;

    const { rows } = await db(
      `INSERT INTO conversations (load_id, user_a_id, user_b_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (load_id, user_a_id, user_b_id)
       DO UPDATE SET updated_at = now()
       RETURNING id, load_id AS "loadId", user_a_id AS "userAId", user_b_id AS "userBId", updated_at AS "updatedAt"`,
      [loadId, userA, userB]
    );

    return sendSuccess(res, 200, rows[0], "OK");
  }
);

router.get("/conversations", protect, async (req, res) => {
  const uid = String(req.auth.userId);
  const { rows } = await db(
    `SELECT c.id, c.load_id AS "loadId", c.user_a_id AS "userAId", c.user_b_id AS "userBId",
            c.updated_at AS "updatedAt",
            (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS "lastMessage",
            (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS "lastMessageAt"
     FROM conversations c
     WHERE c.user_a_id = $1 OR c.user_b_id = $1
     ORDER BY c.updated_at DESC
     LIMIT 200`,
    [uid]
  );
  return sendSuccess(res, 200, rows);
});

router.get(
  "/conversations/:id/messages",
  protect,
  param("id").custom((v) => (isUuid(v) ? true : (() => { throw new Error("Invalid conversation id"); })())),
  query("before").optional().custom((v) => (isUuid(v) ? true : (() => { throw new Error("Invalid before id"); })())),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  handleVal,
  async (req, res) => {
    const uid = String(req.auth.userId);
    const convId = String(req.params.id);
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const { rows: convRows } = await db(
      `SELECT id, user_a_id, user_b_id FROM conversations WHERE id = $1`,
      [convId]
    );
    const conv = convRows[0];
    if (!conv) return sendError(res, 404, "Not found");
    if (String(conv.user_a_id) !== uid && String(conv.user_b_id) !== uid) return sendError(res, 403, "Forbidden");

    const { rows } = await db(
      `SELECT id, sender_id AS "senderId", body, seen_at AS "seenAt", created_at AS "createdAt"
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [convId, limit]
    );
    return sendSuccess(res, 200, rows);
  }
);

router.post(
  "/conversations/:id/messages",
  protect,
  param("id").custom((v) => (isUuid(v) ? true : (() => { throw new Error("Invalid conversation id"); })())),
  body("body").trim().isLength({ min: 1, max: 2000 }).withMessage("Invalid body"),
  body("clientMessageId").optional().trim().isLength({ max: 128 }),
  handleVal,
  async (req, res) => {
    const uid = String(req.auth.userId);
    const convId = String(req.params.id);

    const { rows: convRows } = await db(
      `SELECT id, user_a_id, user_b_id FROM conversations WHERE id = $1`,
      [convId]
    );
    const conv = convRows[0];
    if (!conv) return sendError(res, 404, "Not found");
    if (String(conv.user_a_id) !== uid && String(conv.user_b_id) !== uid) return sendError(res, 403, "Forbidden");

    const text = String(req.body.body || "").trim();
    const { rows } = await db(
      `INSERT INTO messages (conversation_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id AS "senderId", body, created_at AS "createdAt"`,
      [convId, uid, text]
    );
    await db(`UPDATE conversations SET updated_at = now() WHERE id = $1`, [convId]);
    return sendSuccess(res, 201, rows[0], "Sent");
  }
);

router.post(
  "/conversations/:id/read",
  protect,
  param("id").custom((v) => (isUuid(v) ? true : (() => { throw new Error("Invalid conversation id"); })())),
  body("upToMessageId").optional().custom((v) => (isUuid(v) ? true : (() => { throw new Error("Invalid upToMessageId"); })())),
  handleVal,
  async (req, res) => {
    const uid = String(req.auth.userId);
    const convId = String(req.params.id);

    const { rows: convRows } = await db(
      `SELECT id, user_a_id, user_b_id FROM conversations WHERE id = $1`,
      [convId]
    );
    const conv = convRows[0];
    if (!conv) return sendError(res, 404, "Not found");
    if (String(conv.user_a_id) !== uid && String(conv.user_b_id) !== uid) return sendError(res, 403, "Forbidden");

    await db(
      `UPDATE messages
       SET seen_at = COALESCE(seen_at, now())
       WHERE conversation_id = $1 AND sender_id <> $2`,
      [convId, uid]
    );
    return sendSuccess(res, 200, { ok: true });
  }
);

module.exports = router;
