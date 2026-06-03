import type { Currency } from '../providers/auth-context';

/** Currency symbol for the active company, defaulting to `$` when unknown. */
export function currencySymbol(currency?: Currency | null): string {
    return currency?.symbol ?? '$';
}

/**
 * Format an amount with the active company's currency symbol, honoring the
 * Odoo `position` (symbol before/after the number).
 */
export function formatCurrency(amount: number, currency?: Currency | null): string {
    const symbol = currencySymbol(currency);
    const formatted = Number.isFinite(amount)
        ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00';
    return currency?.position === 'after' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}
