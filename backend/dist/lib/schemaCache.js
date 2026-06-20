"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_CUSTOM_FIELD_TYPES = void 0;
exports.getModelSchema = getModelSchema;
exports.clearModelSchemaCache = clearModelSchemaCache;
exports.getCustomFields = getCustomFields;
exports.getCustomFieldReport = getCustomFieldReport;
exports.validateRequiredCustomFields = validateRequiredCustomFields;
exports.validatePayload = validatePayload;
const redis_1 = require("./redis");
// ── Constants ─────────────────────────────────────────────────────────────────
const SCHEMA_TTL_S = 86400; // 24 hours
exports.SUPPORTED_CUSTOM_FIELD_TYPES = new Set([
    'char',
    'text',
    'boolean',
    'integer',
    'float',
    'monetary',
    'date',
    'datetime',
    'selection',
    'many2one',
]);
/** Fields that Odoo manages automatically — never sent by callers, never validated. */
const SYSTEM_FIELDS = new Set([
    'id', 'create_date', 'write_date', 'create_uid', 'write_uid',
    '__last_update', 'display_name', 'active',
]);
/**
 * Relation models that the mobile create forms already expose via a dedicated
 * native selector, per source model. A tenant custom (x_) many2one pointing at
 * one of these would render a SECOND, duplicate picker (e.g. a Studio
 * `x_project_id` → project.project on a timesheet line duplicates the built-in
 * Project selector). We hide such custom fields from the dynamic renderer so the
 * native selector remains the single source of truth.
 */
const NATIVE_RELATION_MODELS = {
    'account.analytic.line': new Set(['project.project', 'project.task']),
    'hr.expense': new Set(['product.product', 'product.template', 'account.analytic.account']),
    'maintenance.request': new Set(['maintenance.equipment', 'maintenance.equipment.category', 'maintenance.team']),
    'hr.leave': new Set(['hr.leave.type']),
    'helpdesk.ticket': new Set(['helpdesk.team', 'helpdesk.ticket.type', 'helpdesk.tag', 'res.users']),
};
const NATIVE_FIELD_NAME_PATTERNS = {
    'account.analytic.line': [
        /(^|_)project(_id|s)?$/i,
        /(^|_)task(_id|s)?$/i,
        /project.*task/i,
        /analytic/i,
        /(^|_)ispc(_id)?$/i,
    ],
};
/**
 * Relation models that are "analytic/project dimensions". A custom (x_) many2one
 * pointing at any of these is a structural dimension the app handles through its
 * native Project/Task/Analytic-Account flow — never a free-form picker. Hidden on
 * EVERY source model to avoid duplicate selectors (e.g. a Studio `x_studio_ispc`
 * → account.analytic.account on a timesheet line).
 */
const DIMENSION_RELATION_MODELS = new Set([
    'project.project',
    'project.task',
    'account.analytic.account',
    'account.analytic.plan',
]);
/**
 * True when a custom field on `model` should be hidden from the dynamic renderer
 * because the create form already covers it natively (or it's a structural
 * project/analytic dimension that should never be a free-form picker):
 *  - ANY custom many2one on account.analytic.line (timesheet lines are fully
 *    described by the native Project + Task selectors; extra dimension pickers
 *    like "ISPC" are duplicates);
 *  - many2one fields whose relation is a native selector for this model;
 *  - many2one fields whose relation is a project/analytic dimension (any model);
 *  - fields whose name matches a known native pattern for this model.
 */
function isNativelyHandled(model, fieldName, def) {
    if (def.type !== 'many2one')
        return false;
    // Timesheet lines: the native Project/Task selectors are the single source of
    // truth — hide every custom many2one so no duplicate dimension picker renders.
    if (model === 'account.analytic.line')
        return true;
    if (def.relation) {
        const natives = NATIVE_RELATION_MODELS[model];
        if (natives?.has(def.relation))
            return true;
        // Project/analytic dimension relation on any model → hide.
        if (DIMENSION_RELATION_MODELS.has(def.relation))
            return true;
    }
    if (NATIVE_FIELD_NAME_PATTERNS[model]?.some(re => re.test(fieldName))) {
        return true;
    }
    return false;
}
// ── Helpers ───────────────────────────────────────────────────────────────────
function schemaKey(tenantId, model) {
    // e.g. shadow:t:isec-v17:schema:hr_expense
    return `shadow:t:${tenantId}:schema:${model.replace(/\./g, '_')}`;
}
function schemaMetaKey(tenantId, model) {
    return `${schemaKey(tenantId, model)}:meta`;
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
        (0, redis_1.redisSet)(schemaMetaKey(tenantId, model), JSON.stringify({ cached_at: new Date().toISOString() }), SCHEMA_TTL_S).catch(() => { });
        return schema;
    }
    catch {
        // Model may not exist on this Odoo version — return empty gracefully
        return {};
    }
}
async function clearModelSchemaCache(tenantId, model) {
    await Promise.all([
        (0, redis_1.redisDel)(schemaKey(tenantId, model)).catch(() => undefined),
        (0, redis_1.redisDel)(schemaMetaKey(tenantId, model)).catch(() => undefined),
    ]);
}
/**
 * Returns only custom fields (prefixed `x_`) with their definitions.
 * Empty object if none exist or on any failure.
 */
async function getCustomFields(tenantId, client, uid, model) {
    const schema = await getModelSchema(tenantId, client, uid, model);
    return Object.fromEntries(Object.entries(schema).filter(([key, def]) => key.startsWith('x_') &&
        // Only surface fields an employee can actually fill in: skip
        // computed/readonly and non-stored (related/computed) Studio fields.
        !def.readonly &&
        def.store !== false &&
        exports.SUPPORTED_CUSTOM_FIELD_TYPES.has(def.type) &&
        // Skip fields the create form already renders natively (avoids a
        // duplicate picker, e.g. a custom x_project_id on a timesheet line).
        !isNativelyHandled(model, key, def)));
}
async function getCustomFieldReport(tenantId, client, uid, model) {
    const schema = await getModelSchema(tenantId, client, uid, model);
    const metaRaw = await (0, redis_1.redisGet)(schemaMetaKey(tenantId, model)).catch(() => null);
    let schema_cached_at = null;
    if (metaRaw) {
        try {
            schema_cached_at = JSON.parse(metaRaw).cached_at ?? null;
        }
        catch {
            schema_cached_at = null;
        }
    }
    const writableCustom = Object.fromEntries(Object.entries(schema).filter(([key, def]) => key.startsWith('x_') &&
        !def.readonly &&
        def.store !== false &&
        !isNativelyHandled(model, key, def)));
    const supported = Object.fromEntries(Object.entries(writableCustom).filter(([, def]) => exports.SUPPORTED_CUSTOM_FIELD_TYPES.has(def.type)));
    const unsupported = Object.fromEntries(Object.entries(writableCustom).filter(([, def]) => !exports.SUPPORTED_CUSTOM_FIELD_TYPES.has(def.type)));
    const unsupportedRequired = Object.fromEntries(Object.entries(unsupported).filter(([, def]) => def.required));
    return {
        custom_fields: supported,
        schema_available: Object.keys(schema).length > 0,
        unsupported_fields: unsupported,
        unsupported_required_fields: unsupportedRequired,
        schema_cached_at,
    };
}
/**
 * Returns the labels of required custom fields that are missing/empty in the
 * supplied values. Use before create to fail fast with a clear message instead
 * of letting Odoo reject the write with a less controlled error.
 */
function validateRequiredCustomFields(customFields, values) {
    const missing = [];
    for (const [name, def] of Object.entries(customFields)) {
        if (!def.required)
            continue;
        const v = values?.[name];
        if (v === undefined || v === null || v === false || v === '') {
            missing.push(def.string);
        }
    }
    return missing;
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
