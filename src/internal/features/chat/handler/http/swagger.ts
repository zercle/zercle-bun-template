/**
 * @openapi
 * /api/v1/chat/rooms:
 *   post:
 *     tags: [Chat]
 *     summary: Create a new chat room
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 100 }
 *               description: { type: string }
 *               type: { type: string, enum: [public, private, direct] }
 *               member_ids: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       201: { description: Room created successfully }
 *       401: { description: Unauthorized }
 *
 *   get:
 *     tags: [Chat]
 *     summary: List rooms for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: limit, in: query, schema: { type: integer, default: 20 } }
 *       - { name: offset, in: query, schema: { type: integer, default: 0 } }
 *     responses:
 *       200: { description: List of rooms }
 */
export const swagger = {};
