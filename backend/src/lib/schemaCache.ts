import { redisGet, redisSet } from './redis';
import type { OdooClientInstance } from '../odoo/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OdooFieldDef {
    string: string;                      // human-readable label
    type: string;                        // 'char' | 'float' | 'date' | 'many2one' | 'selection' | ...
    required: boolean;
    selection?: [string, string][];      // for selection fields: [[value, label], ...]
    relation?: string;                   // for relational fields: target model name
}

export interface ValidationResult {
    valid: boolean;
    missing: string[];   // labels of required fields sent as null/false
    invalid: string[];   // labels of selection fields with disallowed values
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SCHEMA_TTL_S = 86_400; // 24 hours

/** Fields that Odoo manages automatically — never sent by callers, never validated. */
const SYSTEM_FIELDS = new Set([
    'id', 'create_date', 'write_date', 'create_uid', 'write_uid',
    '__last_update', 'display_name', 'active',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function schemaKey(tenantId: string, model: string): string {
    // e.g. shadow:t:isec-v17:schema:hr_expense
    return `shadow:t:${tenantId}:schema:${model.replace(/\./g, '_')}`;
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
        return schema;
    } catch {
        // Model may not exist on this Odoo version — return empty gracefully
        return {};
    }
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
        Object.entries(schema).filter(([key]) => key.startsWith('x_')),
    );
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
