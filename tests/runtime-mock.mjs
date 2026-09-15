export const env = {};
export const backgroundTasks = [];
export function waitUntil(promise) { backgroundTasks.push(promise); }
