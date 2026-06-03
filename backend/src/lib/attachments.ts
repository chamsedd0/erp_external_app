import { z } from 'zod';

const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
]);

export const attachmentSchema = z.object({
    name: z.string().min(1).max(180),
    data: z.string().min(1),
    mimetype: z.string().min(1),
}).superRefine((att, ctx) => {
    const mimetype = att.mimetype.toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimetype)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unsupported attachment type: ${att.mimetype}`,
            path: ['mimetype'],
        });
    }

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(att.data) || att.data.length % 4 !== 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Attachment data must be valid base64',
            path: ['data'],
        });
        return;
    }

    const bytes = Buffer.byteLength(att.data, 'base64');
    if (bytes <= 0 || bytes > MAX_FILE_BYTES) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Attachment must be between 1 byte and ${MAX_FILE_BYTES} bytes`,
            path: ['data'],
        });
    }
});

export const attachmentsSchema = z.array(attachmentSchema)
    .max(MAX_FILES)
    .optional()
    .superRefine((attachments, ctx) => {
        if (!attachments) return;
        const total = attachments.reduce((sum, att) => sum + Buffer.byteLength(att.data, 'base64'), 0);
        if (total > MAX_TOTAL_BYTES) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Attachments exceed total limit of ${MAX_TOTAL_BYTES} bytes`,
            });
        }
    });

export type AttachmentInput = z.infer<typeof attachmentSchema>;
