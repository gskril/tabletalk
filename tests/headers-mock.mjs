export const cookieJar = new Map();
export const cookies = async () => ({
  get: (name) =>
    cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined,
});
export const requestHeaders = new Map();
export const headers = async () => new Headers([...requestHeaders]);
