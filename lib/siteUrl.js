/**
 * Helper function to determine the base URL of the site dynamically.
 * Reads headers from the request (x-forwarded-host / host and x-forwarded-proto),
 * falling back to AUTH_URL, NEXTAUTH_URL, or http://localhost:3000.
 */
export function getSiteUrl(req) {
  let host = req?.headers?.get?.('x-forwarded-host') || req?.headers?.get?.('host');
  let proto = req?.headers?.get?.('x-forwarded-proto');

  if (host) {
    if (!proto) {
      proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    }
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  const envUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return envUrl.replace(/\/$/, '');
}
