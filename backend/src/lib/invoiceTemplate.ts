export interface QuotationParams {
    tenantName: string;
    subscriptionNumber: string;   // 'SP-00001'
    planName: string;
    billingFrequency: string;     // 'monthly' | 'quarterly' | 'yearly'
    amount: number;               // in USD (total; for per-employee = activeEmployees * pricePerEmployee)
    billingPeriod: string;        // e.g. 'May 2026'
    validUntil: string;           // e.g. '2026-06-11' — 30 days from issue
    contactName: string;
    contactEmail: string;
    quotationNumber: string;      // 'QUO-SP-00001-2026-05'
    activeEmployees?: number;     // set for per_employee pricing model
    pricePerEmployee?: number;    // USD/employee/month; set for per_employee pricing model
}

export function generateQuotationHTML(p: QuotationParams): string {
    const formattedAmount = p.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const formattedValidUntil = new Date(p.validUntil).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const isPerEmployee = p.activeEmployees !== undefined && p.pricePerEmployee !== undefined;
    const frequencyLabel = isPerEmployee
        ? 'Per-employee subscription'
        : p.billingFrequency === 'monthly'
            ? 'Monthly subscription'
            : p.billingFrequency === 'quarterly'
                ? 'Quarterly subscription'
                : 'Annual subscription';
    const lineItemSubtext = isPerEmployee
        ? `${p.activeEmployees} employee${p.activeEmployees !== 1 ? 's' : ''} × $${p.pricePerEmployee?.toLocaleString('en-US')}/employee/month`
        : p.billingPeriod;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Service Quotation ${p.quotationNumber}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#0F172A;padding:28px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:linear-gradient(135deg,#3B82F6,#1D4ED8);border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                          <span style="color:#fff;font-weight:800;font-size:14px;letter-spacing:-0.5px;">SP</span>
                        </td>
                        <td style="padding-left:12px;vertical-align:middle;">
                          <div style="color:#fff;font-size:16px;font-weight:700;letter-spacing:-0.2px;">Shadow Portal</div>
                          <div style="color:#64748B;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.8px;margin-top:1px;">Admin Platform</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <div style="color:#94A3B8;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.8px;">Service Quotation</div>
                    <div style="color:#fff;font-size:18px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums;">${p.quotationNumber}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Quoted To -->
          <tr>
            <td style="padding:28px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="vertical-align:top;">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#94A3B8;margin-bottom:8px;">Quoted To</div>
                    <div style="font-size:15px;font-weight:600;color:#0F172A;">${p.tenantName}</div>
                    <div style="font-size:13px;color:#64748B;margin-top:2px;">${p.contactName}</div>
                    <div style="font-size:13px;color:#64748B;">${p.contactEmail}</div>
                    <div style="font-size:12px;color:#94A3B8;margin-top:6px;font-family:'JetBrains Mono',monospace;">${p.subscriptionNumber}</div>
                  </td>
                  <td width="50%" align="right" style="vertical-align:top;">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#94A3B8;margin-bottom:8px;">Details</div>
                    <div style="font-size:13px;color:#475569;margin-bottom:4px;">
                      <span style="color:#94A3B8;">Period:</span> ${p.billingPeriod}
                    </div>
                    <div style="font-size:13px;color:#475569;margin-bottom:4px;">
                      <span style="color:#94A3B8;">Valid Until:</span> ${formattedValidUntil}
                    </div>
                    <div style="font-size:13px;color:#475569;">
                      <span style="color:#94A3B8;">Plan:</span> ${p.planName}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Line items table -->
          <tr>
            <td style="padding:24px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
                <!-- Header row -->
                <tr style="background:#F8FAFC;">
                  <td style="padding:10px 16px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.7px;color:#94A3B8;border-bottom:1px solid #E2E8F0;">Description</td>
                  <td style="padding:10px 16px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.7px;color:#94A3B8;border-bottom:1px solid #E2E8F0;text-align:right;">Amount</td>
                </tr>
                <!-- Item -->
                <tr>
                  <td style="padding:16px;border-bottom:1px solid #F1F5F9;">
                    <div style="font-size:14px;font-weight:500;color:#0F172A;">${frequencyLabel} — ${p.planName} Plan</div>
                    <div style="font-size:12px;color:#94A3B8;margin-top:3px;">${lineItemSubtext}</div>
                  </td>
                  <td style="padding:16px;border-bottom:1px solid #F1F5F9;text-align:right;font-size:14px;font-weight:600;color:#0F172A;font-variant-numeric:tabular-nums;">${formattedAmount}</td>
                </tr>
                <!-- Total -->
                <tr style="background:#F8FAFC;">
                  <td style="padding:14px 16px;font-size:13px;font-weight:600;color:#475569;text-align:right;" colspan="1">Quoted Total</td>
                  <td style="padding:14px 16px;font-size:18px;font-weight:700;color:#0F172A;text-align:right;font-variant-numeric:tabular-nums;">${formattedAmount}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- How to Approve -->
          <tr>
            <td style="padding:20px 36px 0;">
              <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:14px 16px;">
                <div style="font-size:13px;color:#1E40AF;font-weight:500;">How to Approve</div>
                <div style="font-size:12px;color:#3B82F6;margin-top:4px;">
                  To accept this quotation, simply reply to this email confirming your approval.
                  Once approved, your subscription will be activated and billing will begin as agreed.
                  Please reference your subscription number <strong>${p.subscriptionNumber}</strong> in your reply.
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 36px;border-top:1px solid #F1F5F9;margin-top:20px;">
              <div style="font-size:11px;color:#94A3B8;text-align:center;line-height:1.6;">
                This quotation was generated by Shadow Portal and is valid until ${formattedValidUntil}.<br/>
                Questions? Contact us at <a href="mailto:billing@shadowportal.app" style="color:#3B82F6;text-decoration:none;">billing@shadowportal.app</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
