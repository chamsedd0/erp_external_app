// Client-side estimate of a leave request's duration. Odoo computes the
// authoritative number_of_days from the employee's working calendar and
// public holidays; this only excludes weekends, so present it as "≈".
export function countWeekdays(from: Date, to: Date): number | null {
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    if (end < start) return null;

    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) count++;
    }
    return count;
}
