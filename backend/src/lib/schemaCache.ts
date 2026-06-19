import { redisDel, redisGet, redisSet } from './redis';
import type { OdooClientInstance } from '../odoo/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OdooFieldDef {
    string: string;                      // human-readable label
    type: string;                        // 'char' | 'float' | 'date' | 'many2one' | 'selection' | ...
    required: boolean;
    selection?: [string, string][];      // for selection fields: [[value, label], ...]
    relation?: string;                   // for relational fields: target model name
    readonly?: boolean;                  // computed / non-writable fields
    store?: boolean;                     // non-stored (computed) fields have store === false
}

export interface ValidationResult {
    valid: boolean;
    missing: string[];   // labels of required fields sent as null/false
    invalid: string[];   // labels of selection fields with disallowed values
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SCHEMA_TTL_S = 86_400; // 24 hours
export const SUPPORTED_CUSTOM_FIELD_TYPES = new Set([
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
const NATIVE_RELATION_MODELS: Record<string, Set<string>> = {
    'account.analytic.line': new Set(['project.project', 'project.task']),
    'hr.expense': new Set(['product.product', 'product.template', 'account.analytic.account']),
    'maintenance.request': new Set(['maintenance.equipment', 'maintenance.equipment.category', 'maintenance.team']),
    'hr.leave': new Set(['hr.leave.type']),
    'helpdesk.ticket': new Set(['helpdesk.team', 'helpdesk.ticket.type', 'helpdesk.tag', 'res.users']),
};

const NATIVE_FIELD_NAME_PATTERNS: Record<string, RegExp[]> = {
    'account.analytic.line': [
        /(^|_)project(_id)?$/i,
        /(^|_)task(_id)?$/i,
        /project.*task/i,
    ],
};

/**
 * True when a custom field on `model` should be hidden from the dynamic renderer
 * because the create form already covers it with a native control:
 *  - many2one fields whose relation is already a native selector for this model;
 *  - the well-known scalar fields the form sets itself (dates, duration, etc.).
 */
function isNativelyHandled(model: string, fieldName: string, def: OdooFieldDef): boolean {
    if (def.type === 'many2one' && def.relation) {
        const natives = NATIVE_RELATION_MODELS[model];
        if (natives?.has(def.relation)) return true;
    }
    if (def.type === 'many2one' && NATIVE_FIELD_NAME_PATTERNS[model]?.some(re => re.test(fieldName))) {
        return true;
    }
    return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function schemaKey(tenantId: string, model: string): string {
    // e.g. shadow:t:isec-v17:schema:hr_expense
    return `shadow:t:${tenantId}:schema:${model.replace(/\./g, '_')}`;
}

function schemaMetaKey(tenantId: string, model: string): string {
    return `${schemaKey(tenantId, model)}:meta`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the full fields_get() schema for a model.
 * Checks Redis first (24h TTL), falls back to live Odoo call.
 * Returns {} on any failure so callers always get a safe value.
 */
export async function getModelSchema(
    tenantId: string,
    client: OdooClientInstance,
    uid: number,
    model: string,
): Promise<Record<string, OdooFieldDef>> {
    const key = schemaKey(tenantId, model);

    // 1. Try cache
    try {
        const cached = await redisGet(key);
        if (cached) return JSON.parse(cached) as Record<string, OdooFieldDef>;
    } catch {
        // cache miss or parse error — fall through to live fetch
    }

    // 2. Live fetch from Odoo
    try {
        const schema = await (client.getSchema(uid, model) as Promise<Record<string, OdooFieldDef>>);
        // 3. Write to cache (best-effort)
        redisSet(key, JSON.stringify(schema), SCHEMA_TTL_S).catch(() => {/* ignore */});
        redisSet(schemaMetaKey(tenantId, model), JSON.stringify({ cached_at: new Date().toISOString() }), SCHEMA_TTL_S).catch(() => {/* ignore */});
        return schema;
    } catch {
        // Model may not exist on this Odoo version — return empty gracefully
        return {};
    }
}

export async function clearModelSchemaCache(tenantId: string, model: string): Promise<void> {
    await Promise.all([
        redisDel(schemaKey(tenantId, model)).catch(() => undefined),
        redisDel(schemaMetaKey(tenantId, model)).catch(() => undefined),
    ]);
}

/**
 * Returns only custom fields (prefixed `x_`) with their definitions.
 * Empty object if none exist or on any failure.
 */
export async function getCustomFields(
    tenantId: string,
    client: OdooClientInstance,
    uid: number,
    model: string,
): Promise<Record<string, OdooFieldDef>> {
    const schema = await getModelSchema(tenantId, client, uid, model);
    return Object.fromEntries(
        Object.entries(schema).filter(([key, def]) =>
            key.startsWith('x_') &&
            // Only surface fields an employee can actually fill in: skip
            // computed/readonly and non-stored (related/computed) Studio fields.
            !def.readonly &&
            def.store !== false &&
            SUPPORTED_CUSTOM_FIELD_TYPES.has(def.type) &&
            // Skip fields the create form already renders natively (avoids a
            // duplicate picker, e.g. a custom x_project_id on a timesheet line).
            !isNativelyHandled(model, key, def),
        ),
    );
}

export async function getCustomFieldReport(
    tenantId: string,
    client: OdooClientInstance,
    uid: number,
    model: string,
): Promise<{
    custom_fields: Record<string, OdooFieldDef>;
    schema_available: boolean;
    unsupported_fields: Record<string, OdooFieldDef>;
    unsupported_required_fields: Record<string, OdooFieldDef>;
    schema_cached_at: string | null;
}> {
    const schema = await getModelSchema(tenantId, client, uid, model);
    const metaRaw = await redisGet(schemaMetaKey(tenantId, model)).catch(() => null);
    let schema_cached_at: string | null = null;
    if (metaRaw) {
        try {
            schema_cached_at = JSON.parse(metaRaw).cached_at ?? null;
        } catch {
            schema_cached_at = null;
        }
    }
    const writableCustom = Object.fromEntries(
        Object.entries(schema).filter(([key, def]) =>
            key.startsWith('x_') &&
            !def.readonly &&
            def.store !== false &&
            !isNativelyHandled(model, key, def),
        )
    );
    const supported = Object.fromEntries(
        Object.entries(writableCustom).filter(([, def]) => SUPPORTED_CUSTOM_FIELD_TYPES.has(def.type))
    );
    const unsupported = Object.fromEntries(
        Object.entries(writableCustom).filter(([, def]) => !SUPPORTED_CUSTOM_FIELD_TYPES.has(def.type))
    );
    const unsupportedRequired = Object.fromEntries(
        Object.entries(unsupported).filter(([, def]) => def.required)
    );

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
export function validateRequiredCustomFields(
    customFields: Record<string, OdooFieldDef>,
    values: Record<string, any> | undefined,
): string[] {
    const missing: string[] = [];
    for (const [name, def] of Object.entries(customFields)) {
        if (!def.required) continue;
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
export async function validatePayload(
    tenantId: string,
    client: OdooClientInstance,
    uid: number,
    model: string,
    payload: Record<string, any>,
): Promise<ValidationResult> {
    let schema: Record<string, OdooFieldDef>;
    try {
        schema = await getModelSchema(tenantId, client, uid, model);
    } catch {
        return { valid: true, missing: [], invalid: [] };
    }

    if (!schema || Object.keys(schema).length === 0) {
        return { valid: true, missing: [], invalid: [] };
    }

    const missing: string[] = [];
    const invalid: string[] = [];

    for (const [fieldName, fieldDef] of Object.entries(schema)) {
        if (SYSTEM_FIELDS.has(fieldName)) continue;
        if (!(fieldName in payload)) continue; // only validate what we're actually sending

        const value = payload[fieldName];

        // Check selection fields
        if (
            fieldDef.type === 'selection' &&
            Array.isArray(fieldDef.selection) &&
            value !== null && value !== undefined && value !== false
        ) {
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
