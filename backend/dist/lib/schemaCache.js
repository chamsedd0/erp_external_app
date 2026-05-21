"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModelSchema = getModelSchema;
exports.getCustomFields = getCustomFields;
exports.validatePayload = validatePayload;
const redis_1 = require("./redis");
// ── Constants ─────────────────────────────────────────────────────────────────
const SCHEMA_TTL_S = 86400; // 24 hours
/** Fields that Odoo manages automatically — never sent by callers, never validated. */
const SYSTEM_FIELDS = new Set([
    'id', 'create_date', 'write_date', 'create_uid', 'write_uid',
    '__last_update', 'display_name', 'active',
]);
// ── Helpers ───────────────────────────────────────────────────────────────────
function schemaKey(tenantId, model) {
    // e.g. shadow:t:isec-v17:schema:hr_expense
    return `shadow:t:${tenantId}:schema:${model.replace(/\./g, '_')}`;
}
// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Returns the full fields_get() schema for a model.
 * Checks Redis first (24h TTL), falls back to live Odoo call.
 * Returns {} on any failure so callers always get a safe value.
 */
async function getModelSchema(tenantId, client, uid, model) {
    const key = schemaKey(tenantId, model);
    // 1. Try cache
    try {
        const cached = await (0, redis_1.redisGet)(key);
        if (cached)
            return JSON.parse(cached);
    }
    catch {
        // cache miss or parse error — fall through to live fetch
    }
    // 2. Live fetch from Odoo
    try {
        const schema = await client.getSchema(uid, model);
        // 3. Write to cache (best-effort)
        (0, redis_1.redisSet)(key, JSON.stringify(schema), SCHEMA_TTL_S).catch(() => { });
        return schema;
    }
    catch {
        // Model may not exist on this Odoo version — return empty gracefully
        return {};
    }
}
/**
 * Returns only custom fields (prefixed `x_`) with their definitions.
 * Empty object if none exist or on any failure.
 */
async function getCustomFields(tenantId, client, uid, model) {
    const schema = await getModelSchema(tenantId, client, uid, model);
    return Object.fromEntries(Object.entries(schema).filter(([key]) => key.startsWith('x_')));
}
/**
 * Pre-validates a payload against the live Odoo schema before createRecord.
 *
 * Checks:
 * - Selection fields: value must be in the allowed list
 * - Required fields that ARE in the payload: value must not be null/false/undefined
 *
 * Does NOT check required fields absent from the payload — those may have
 * server-side defaults. Does NOT replicate Odoo business rules.
 *
 * Returns { valid: true } on schema fetch failure so routes degrade gracefully.
 */
async function validatePayload(tenantId, client, uid, model, payload) {
    let schema;
    try {
        schema = await getModelSchema(tenantId, client, uid, model);
    }
    catch {
        return { valid: true, missing: [], invalid: [] };
    }
    if (!schema || Object.keys(schema).length === 0) {
        return { valid: true, missing: [], invalid: [] };
    }
    const missing = [];
    const invalid = [];
    for (const [fieldName, fieldDef] of Object.entries(schema)) {
        if (SYSTEM_FIELDS.has(fieldName))
            continue;
        if (!(fieldName in payload))
            continue; // only validate what we're actually sending
        const value = payload[fieldName];
        // Check selection fields
        if (fieldDef.type === 'selection' &&
            Array.isArray(fieldDef.selection) &&
            value !== null && value !== undefined && value !== false) {
            const validValues = fieldDef.selection.map(([v]) => v);
            if (!validValues.includes(value)) {
                invalid.push(`${fieldDef.string} ("${value}" not in: ${validValues.join(', ')})`);
            }
        }
        // Check required fields sent with empty values
        if (fieldDef.required && (value === null || value === undefined || value === false)) {
            missing.push(fieldDef.string);
        }
    }
    return {
        valid: missing.length === 0 && invalid.length === 0,
        missing,
        invalid,
    };
}
