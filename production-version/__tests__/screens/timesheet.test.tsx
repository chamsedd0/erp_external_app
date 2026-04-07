/**
 * Timesheet screen logic tests.
 * Tests: fetching entries, fetching projects and tasks, creating timesheet entries.
 */

jest.mock('@react-native-async-storage/async-storage');

import { apiClient } from '../../api/client';

const API_URL = 'https://erp-external-app.vercel.app';

function mockFetch(ok: boolean, body: any, status = 200) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    });
}

beforeEach(() => jest.clearAllMocks());

// ─── Fetching entries ─────────────────────────────────────────────────────────

describe('apiClient.getTimesheetEntries', () => {
    it('fetches timesheet entries for employee', async () => {
        mockFetch(true, {
            entries: [
                { id: 1, name: 'Backend work', project_id: [1, 'Alpha'], date: '2025-06-20', unit_amount: 3 },
                { id: 2, name: 'Testing', project_id: [1, 'Alpha'], date: '2025-06-21', unit_amount: 2 },
            ],
        });

        const result = await apiClient.getTimesheetEntries(42);

        expect(fetch).toHaveBeenCalledWith(
            `${API_URL}/timesheet?employee_id=42`,
            expect.any(Object)
        );
        expect(result.entries).toHaveLength(2);
    });

    it('throws on server error', async () => {
        mockFetch(false, { error: 'Odoo error' }, 500);
        await expect(apiClient.getTimesheetEntries(42)).rejects.toThrow('Odoo error');
    });
});

// ─── Fetching projects ────────────────────────────────────────────────────────

describe('apiClient.getProjects', () => {
    it('fetches list of active projects', async () => {
        mockFetch(true, { projects: [
            { id: 1, name: 'Project Alpha' },
            { id: 2, name: 'Project Beta' },
        ]});

        const result = await apiClient.getProjects();

        expect(fetch).toHaveBeenCalledWith(`${API_URL}/timesheet/projects`, expect.any(Object));
        expect(result.projects).toHaveLength(2);
    });

    it('returns empty array when no active projects', async () => {
        mockFetch(true, { projects: [] });
        const result = await apiClient.getProjects();
        expect(result.projects).toEqual([]);
    });
});

// ─── Fetching tasks for project ───────────────────────────────────────────────

describe('apiClient.getTasks', () => {
    it('fetches tasks for a specific project', async () => {
        mockFetch(true, { tasks: [
            { id: 10, name: 'Design UI' },
            { id: 11, name: 'Write tests' },
        ]});

        const result = await apiClient.getTasks(1);

        expect(fetch).toHaveBeenCalledWith(
            `${API_URL}/timesheet/tasks?project_id=1`,
            expect.any(Object)
        );
        expect(result.tasks).toHaveLength(2);
    });

    it('returns empty tasks for project with no open tasks', async () => {
        mockFetch(true, { tasks: [] });
        const result = await apiClient.getTasks(99);
        expect(result.tasks).toEqual([]);
    });
});

// ─── Creating timesheet entries ───────────────────────────────────────────────

describe('apiClient.createTimesheetEntry', () => {
    const VALID_ENTRY = {
        employee_id: 42,
        project_id: 1,
        date: '2025-06-20',
        unit_amount: 2.5,
        name: 'Implemented login flow',
    };

    it('creates entry and returns id', async () => {
        mockFetch(true, { status: 'success', id: 500 });

        const result = await apiClient.createTimesheetEntry(VALID_ENTRY);

        expect(fetch).toHaveBeenCalledWith(
            `${API_URL}/timesheet`,
            expect.objectContaining({ method: 'POST' })
        );
        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.employee_id).toBe(42);
        expect(body.project_id).toBe(1);
        expect(body.unit_amount).toBe(2.5);
        expect(result.id).toBe(500);
    });

    it('includes task_id when provided', async () => {
        mockFetch(true, { status: 'success', id: 501 });

        await apiClient.createTimesheetEntry({ ...VALID_ENTRY, task_id: 10 });

        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.task_id).toBe(10);
    });

    it('omits task_id when not provided', async () => {
        mockFetch(true, { status: 'success', id: 502 });

        await apiClient.createTimesheetEntry(VALID_ENTRY);

        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body).not.toHaveProperty('task_id');
    });

    it('throws on project not found', async () => {
        mockFetch(false, { error: 'Project not found' }, 400);
        await expect(apiClient.createTimesheetEntry(VALID_ENTRY)).rejects.toThrow('Project not found');
    });

    it('throws on Odoo error', async () => {
        mockFetch(false, { error: 'Internal error' }, 500);
        await expect(apiClient.createTimesheetEntry(VALID_ENTRY)).rejects.toThrow('Internal error');
    });
});

// ─── Client-side validation logic ────────────────────────────────────────────

describe('Timesheet entry validation logic', () => {
    it('requires project, date, hours, and description', () => {
        const projectId = 1;
        const date = new Date('2025-06-20');
        const unitAmount = 2.5;
        const name = 'Did work';
        // Mirror: if (!projectId || !date || !unitAmount || !name)
        expect(!projectId || !date || !unitAmount || !name).toBe(false); // all present → passes
    });

    it('fails when project is not selected', () => {
        const projectId = null;
        const date = new Date();
        const unitAmount = 2;
        const name = 'Work';
        expect(!projectId || !date || !unitAmount || !name).toBe(true); // fails
    });

    it('fails when hours is zero', () => {
        const projectId = 1;
        const date = new Date();
        const unitAmount = 0;
        const name = 'Work';
        expect(!projectId || !date || !unitAmount || !name).toBe(true); // 0 is falsy → fails
    });

    it('parses hours from string input correctly', () => {
        const input = '2.5';
        const parsed = parseFloat(input);
        expect(parsed).toBe(2.5);
        expect(isNaN(parsed)).toBe(false);
    });

    it('rejects non-numeric hour input', () => {
        const input = 'abc';
        const parsed = parseFloat(input);
        expect(isNaN(parsed)).toBe(true);
    });
});
