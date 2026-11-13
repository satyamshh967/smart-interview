/** Raised when an internal microservice can't be reached or misbehaves. Maps to HTTP 503. */
export class UpstreamUnavailableError extends Error {
  constructor(service, cause) {
    super(`${service} is temporarily unavailable. Please try again shortly.`);
    this.name = 'UpstreamUnavailableError';
    this.status = 503;
    this.cause = cause;
  }
}

/** POSTs JSON to an internal service, throwing UpstreamUnavailableError on network/HTTP failure. */
export async function postJson(serviceName, url, body, timeoutMs, extraHeaders = {}) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (err) {
    console.error(`${serviceName} unreachable:`, err.message);
    throw new UpstreamUnavailableError(serviceName, err);
  }
  if (!response.ok) {
    console.error(`${serviceName} responded with status ${response.status}`);
    throw new UpstreamUnavailableError(serviceName, new Error(`status ${response.status}`));
  }
  try {
    return await response.json();
  } catch (err) {
    throw new UpstreamUnavailableError(serviceName, err);
  }
}

/** GETs a service's /health endpoint with a short timeout; never throws. */
export async function probeHealth(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (response.ok) return await response.json();
    return { status: 'DOWN', error: `status ${response.status}` };
  } catch (e) {
    return { status: 'DOWN', error: e.message };
  }
}
