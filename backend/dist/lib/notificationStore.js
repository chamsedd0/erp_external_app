"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Store notifications in a local JSON file for simplicity
const DATA_DIR = path_1.default.join(__dirname, '../../data');
const NOTIFICATIONS_FILE = path_1.default.join(DATA_DIR, 'notifications.json');
// Ensure data directory exists
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
exports.notificationStore = {
    getAll: (employeeId) => {
        if (!fs_1.default.existsSync(NOTIFICATIONS_FILE))
            return [];
        try {
            const data = fs_1.default.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
            const all = JSON.parse(data);
            return all.filter(n => n.employeeId == employeeId);
        }
        catch (e) {
            console.error("Error reading notifications:", e);
            return [];
        }
    },
    add: (notification) => {
        let all = [];
        if (fs_1.default.existsSync(NOTIFICATIONS_FILE)) {
            try {
                all = JSON.parse(fs_1.default.readFileSync(NOTIFICATIONS_FILE, 'utf-8'));
            }
            catch (e) {
                all = [];
            }
        }
        all.push(notification);
        // Keep last 1000 notifications to prevent infinite growth
        if (all.length > 1000) {
            all = all.slice(all.length - 1000);
        }
        fs_1.default.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(all, null, 2));
    },
    markRead: (id) => {
        if (!fs_1.default.existsSync(NOTIFICATIONS_FILE))
            return;
        try {
            const all = JSON.parse(fs_1.default.readFileSync(NOTIFICATIONS_FILE, 'utf-8'));
            const updated = all.map(n => n.id === id ? { ...n, read: true } : n);
            fs_1.default.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(updated, null, 2));
        }
        catch (e) {
            console.error("Error marking notification read:", e);
        }
    },
    // Check if a specific notification already exists to avoid duplicates
    exists: (targetId, type, status) => {
        if (!fs_1.default.existsSync(NOTIFICATIONS_FILE))
            return false;
        try {
            const all = JSON.parse(fs_1.default.readFileSync(NOTIFICATIONS_FILE, 'utf-8'));
            // We consider it a duplicate if we already notified about this specific state for this request
            // But actually, we construct the ID or checking logic in the monitor. 
            // Ideally we just check if we have a notification for this request ID with this message type recently?
            // For simplicity, let the monitor handle duplicate logic by diffing state.
            return false;
        }
        catch {
            return false;
        }
    }
};
