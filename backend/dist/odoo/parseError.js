"use strict";
/**
 * parseOdooError
 * ──────────────
 * Converts a raw Odoo XML-RPC fault into a clean, user-facing message.
 *
 * Odoo surfaces business-rule violations as XML-RPC faults whose
 * faultString looks like one of:
 *
 *   "None\n\nodoo.exceptions.ValidationError: ('Your dates overlap...',)"
 *   "None\n\nodoo.exceptions.UserError: ('Product not expensable.',)"
 *   "Odoo Server Error\n\nodoo.exceptions.AccessError: ('You are not...',)"
 *   "None\n\nodoo.exceptions.ValidationError: {'field': ['msg'],}"
 *
 * We strip the Python boilerplate and then match the readable part against
 * known patterns to produce tailored, actionable copy.  Unknown errors fall
 * back to a safe generic message.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOdooError = parseOdooError;
exports.sendOdooError = sendOdooError;
// ── Patterns → friendly messages ──────────────────────────────────────────────
// Ordered: more specific first.
const PATTERNS = [
    // Leave / time-off
    { re: /overlap|already.*leave|leave.*already|dates.*overlap|request.*same.*day/i,
        msg: 'You already have a leave request for some of these days. Check your existing requests and adjust the dates.' },
    { re: /remaining.*day|insufficient.*leave|not.*enough.*day|allocation.*not.*enough|balance/i,
        msg: 'Not enough leave balance for the selected type. Check your allocation or choose a different leave type.' },
    { re: /start.*date.*earlier|end.*date.*later|date.*from.*greater|date.*to.*less/i,
        msg: 'The start date must be before the end date.' },
    { re: /non.working|weekend|public.holiday|day off|not.*work.*day/i,
        msg: 'You cannot take leave on non-working days or public holidays. Adjust your dates.' },
    { re: /minimum.*day|not.*enough.*notice|advance.*notice/i,
        msg: 'This leave type requires more advance notice. Please submit earlier.' },
    { re: /maximum.*day|exceed.*limit|too.*many.*day/i,
        msg: 'You have exceeded the maximum allowed days for this leave type.' },
    { re: /leave.*not.*found|leave.*type.*not|holiday.*status/i,
        msg: 'The selected leave type is no longer available. Please choose another.' },
    // Expense
    { re: /incompatible.*compan|compan.*incompatible|different.*compan/i,
        msg: 'The selected product belongs to a different company than your employee profile. Choose a product from your own company.' },
    { re: /not.*expens|cannot.*expens|product.*expens/i,
        msg: 'This product cannot be used for expenses. Please select a valid expense category.' },
    { re: /duplicate.*expense|expense.*already.*exist/i,
        msg: 'A similar expense already exists for this date and amount.' },
    { re: /account.*not.*found|journal.*not|no.*account/i,
        msg: 'An accounting configuration is missing. Please contact your administrator.' },
    // Attendance / timesheet
    { re: /attendance.*already|check.in.*already|overlap.*attendance/i,
        msg: 'An attendance record already exists for this time period.' },
    { re: /check.out.*before.*check.in|check.in.*after.*check.out/i,
        msg: 'Check-out time must be after check-in time.' },
    { re: /project.*closed|project.*lock|period.*lock|timesheet.*lock/i,
        msg: 'This project or period is locked. Contact your manager to unlock it.' },
    { re: /task.*not.*found|task.*not.*belong|task.*project/i,
        msg: 'The selected task does not belong to this project. Please re-select.' },
    { re: /task.*linked.*time off|time off application/i,
        msg: 'This task is linked to a time off type. Please choose a different task or leave task blank.' },
    { re: /overtime.*already|overtime.*exist|attendance_overtime_unique/i,
        msg: 'An overtime record already exists for this date.' },
    // PostgreSQL-level duplicate key / unique constraint (Odoo surfaces DB errors verbatim)
    { re: /duplicate key value.*unique constraint|violates unique constraint/i,
        msg: 'A duplicate record already exists. Please check for existing entries before submitting again.' },
    // Maintenance / helpdesk
    { re: /equipment.*not.*found|equipment.*deleted/i,
        msg: 'The selected equipment no longer exists. Please re-select.' },
    { re: /team.*not.*found|team.*not.*available/i,
        msg: 'The selected team is no longer available.' },
    // Access / permissions
    { re: /access.*right|access.*error|not.*allowed|permission|forbidden/i,
        msg: 'You do not have permission to perform this action. Contact your administrator.' },
    // Generic Odoo user errors (intentional, readable messages from Odoo itself)
    // If Odoo's own message is short and clean, surface it directly.
];
// ── Extract the readable core from a raw faultString ─────────────────────────
function extractCore(raw) {
    // 1. Strip everything before the last exception class name
    //    e.g. "None\n\nodoo.exceptions.ValidationError: ('msg',)" → "('msg',)"
    const exceptionMatch = raw.match(/odoo\.exceptions\.\w+:\s*([\s\S]+)$/i);
    let core = exceptionMatch ? exceptionMatch[1].trim() : raw.trim();
    // 2. Extract string from tuple notation: ('msg',) or ('msg',)
    const tupleMatch = core.match(/^\(["'](.+?)["'],?\s*\)$/s);
    if (tupleMatch)
        return tupleMatch[1].trim();
    // 3. Extract first value from dict notation: {'field': ['msg'], ...}
    const dictMatch = core.match(/\{[^}]*?["']\s*:\s*\[["'](.+?)["']/s);
    if (dictMatch)
        return dictMatch[1].trim();
    // 4. Strip outer quotes if any
    const quotedMatch = core.match(/^["'](.+)["']$/s);
    if (quotedMatch)
        return quotedMatch[1].trim();
    // 5. Remove "Odoo Server Error\n\n" prefix
    core = core.replace(/^Odoo Server Error\n+/i, '').trim();
    return core;
}
function parseOdooError(err) {
    const rawFault = err?.faultString ||
        err?.faultMessage ||
        err?.message ||
        String(err);
    const core = extractCore(rawFault);
    // Try pattern matching on the full fault + extracted core
    const haystack = (rawFault + ' ' + core).toLowerCase();
    for (const { re, msg } of PATTERNS) {
        if (re.test(haystack)) {
            return { message: msg, isBusinessRule: true, raw: core };
        }
    }
    // If Odoo's own message is short and clean (< 200 chars, no Python noise),
    // surface it directly so we don't swallow useful context.
    if (false &&
        core.length > 0 &&
        core.length < 200 &&
        !/odoo\.|Traceback|File "|line \d|KeyError|ValueError|AttributeError/i.test(core)) {
        return { message: core, isBusinessRule: true, raw: core };
    }
    // Fall back — don't leak stack traces
    return {
        message: 'Odoo rejected the request. Please check the details and try again.',
        isBusinessRule: false,
        raw: core,
    };
}
/**
 * Convenience wrapper for Express route catch blocks.
 *
 * Usage:
 *   } catch (err: any) {
 *       return sendOdooError(res, err, 'Create Leave');
 *   }
 */
function sendOdooError(res, err, context) {
    if (err?.name === 'ZodError' || err instanceof Error && err.message.startsWith('ZodError'))
        return;
    const { message, isBusinessRule, raw } = parseOdooError(err);
    console.error(`[${context}] Odoo error: ${raw}`);
    const status = isBusinessRule ? 422 : 500;
    res.status(status).json({ error: message });
}
