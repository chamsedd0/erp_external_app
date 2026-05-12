'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TenantFormData, SubscriptionPlan } from '@/lib/types';
import {
    DSCard,
    DSCardHeader,
    DSCardContent,
    DSField,
    DSTextInput,
    DSTextarea,
    DSSelectInput,
    Btn,
} from '@/components/ui/primitives';
import { createTenantAction } from '@/lib/actions';
import { Hash, AlertCircle } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

interface Props {
    plans: SubscriptionPlan[];
}

export function DraftClientForm({ plans }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Basic identity
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [slugEdited, setSlugEdited] = useState(false); // once user edits slug manually, stop auto-filling

    // Contact
    const [hrEmail, setHrEmail] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');

    // Plan
    const defaultPlanId = plans.find(p => p.is_active)?.id ?? 'starter';
    const [planId, setPlanId] = useState(defaultPlanId);
    const [billingFrequency, setBillingFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

    // Misc
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    function handleNameChange(value: string) {
        setName(value);
        if (!slugEdited) {
            setSlug(toSlug(value));
        }
    }

    function handleSlugChange(value: string) {
        setSlugEdited(true);
        setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (!slug.trim()) { setError('Slug is required'); return; }
        if (!name.trim()) { setError('Company name is required'); return; }
        if (!hrEmail.trim()) { setError('HR email is required'); return; }

        const today = new Date().toISOString().slice(0, 10);
        const payload: TenantFormData = {
            name,
            hr_email: hrEmail,
            odoo_url: '',
            odoo_db: '',
            odoo_username: '',
            odoo_password: '',
            contact_name: contactName,
            contact_email: contactEmail || hrEmail,
            contact_phone: contactPhone,
            subscription_plan: planId,
            subscription_status: 'draft',
            subscription_start: today,
            subscription_renewal: '',
            monthly_amount: 0,
            billing_frequency: billingFrequency,
            enabled: true,
            notes,
        };

        startTransition(async () => {
            const result = await createTenantAction(slug.trim(), payload);
            if (result?.success === false) {
                setError(result.error);
            }
            // on success, server redirects to /clients/:slug
        });
    }

    const planOptions = plans.length > 0
        ? plans.filter(p => p.is_active).map(p => ({
            value: p.id,
            label: p.pricing_model === 'per_employee'
                ? `${p.name} — $${p.price_per_employee}/emp/mo`
                : `${p.name} — $${p.prices.monthly}/mo`,
        }))
        : [
            { value: 'starter', label: 'Starter — $199/mo' },
            { value: 'professional', label: 'Professional — $599/mo' },
            { value: 'enterprise', label: 'Enterprise — $1,499/mo' },
        ];

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 880 }}>

            {/* Identity */}
            <DSCard>
                <DSCardHeader
                    title="Client Identity"
                    subtitle="Company name and URL-safe slug — slug cannot be changed after creation"
                />
                <DSCardContent>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <DSField label="Company Name" required>
                            <DSTextInput
                                value={name}
                                onChange={e => handleNameChange(e.target.value)}
                                placeholder="Acme Industries"
                                autoFocus
                            />
                        </DSField>
                        <DSField label="Slug" required hint="Lowercase, hyphens only — used in URLs and API">
                            <DSTextInput
                                value={slug}
                                onChange={e => handleSlugChange(e.target.value)}
                                placeholder="acme-industries"
                                leftIcon={<Hash size={14} />}
                            />
                        </DSField>
                    </div>
                </DSCardContent>
            </DSCard>

            {/* HR & Contact */}
            <DSCard>
                <DSCardHeader title="Contact Info" />
                <DSCardContent>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                        <DSField label="HR Email" required hint="Where notification summaries are delivered">
                            <DSTextInput
                                type="email"
                                value={hrEmail}
                                onChange={e => setHrEmail(e.target.value)}
                                placeholder="hr@acme.example"
                                required
                            />
                        </DSField>
                        <DSField label="Contact Name">
                            <DSTextInput
                                value={contactName}
                                onChange={e => setContactName(e.target.value)}
                                placeholder="Sara Mendez"
                            />
                        </DSField>
                        <DSField label="Contact Email">
                            <DSTextInput
                                type="email"
                                value={contactEmail}
                                onChange={e => setContactEmail(e.target.value)}
                                placeholder="sara@acme.example"
                            />
                        </DSField>
                        <DSField label="Contact Phone">
                            <DSTextInput
                                type="tel"
                                value={contactPhone}
                                onChange={e => setContactPhone(e.target.value)}
                                placeholder="+1 415 555 0102"
                            />
                        </DSField>
                    </div>
                </DSCardContent>
            </DSCard>

            {/* Plan */}
            <DSCard>
                <DSCardHeader
                    title="Plan & Billing"
                    subtitle="Odoo credentials and subscription start date are set during activation"
                />
                <DSCardContent>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <DSField label="Plan">
                            <DSSelectInput
                                value={planId}
                                onChange={e => setPlanId(e.target.value)}
                                options={planOptions}
                            />
                        </DSField>
                        <DSField label="Billing Frequency">
                            <DSSelectInput
                                value={billingFrequency}
                                onChange={e => setBillingFrequency(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
                                options={[
                                    { value: 'monthly', label: 'Monthly' },
                                    { value: 'quarterly', label: 'Quarterly' },
                                    { value: 'yearly', label: 'Yearly' },
                                ]}
                            />
                        </DSField>
                    </div>
                    <div style={{
                        marginTop: 14, padding: '10px 12px',
                        background: '#FFFBEB', border: '1px solid #FDE68A',
                        borderRadius: 8, fontSize: 12, color: '#78350F',
                    }}>
                        Status will be set to <strong>Draft</strong> — a quotation can be sent immediately.
                        Activate the client after they approve to generate their SP number and begin the subscription.
                    </div>
                </DSCardContent>
            </DSCard>

            {/* Notes */}
            <DSCard>
                <DSCardHeader title="Internal Notes" subtitle="Visible only to platform admins" />
                <DSCardContent>
                    <DSTextarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Anything worth remembering — payment quirks, escalation contacts, contract terms…"
                        style={{ minHeight: 100 }}
                    />
                </DSCardContent>
            </DSCard>

            {/* Error */}
            {error && (
                <div style={{
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    color: '#B91C1C', padding: '10px 14px',
                    borderRadius: 8, fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <AlertCircle size={14} />{error}
                </div>
            )}

            {/* Submit / Cancel */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingBottom: 32 }}>
                <Btn type="button" variant="secondary" onClick={() => router.back()} disabled={isPending}>
                    Cancel
                </Btn>
                <Btn type="submit" disabled={isPending}>
                    {isPending ? 'Creating draft…' : 'Create draft client'}
                </Btn>
            </div>
        </form>
    );
}
