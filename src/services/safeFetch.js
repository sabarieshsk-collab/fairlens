function headersToObject(headers) {
  const result = {};
  try {
    headers.forEach((value, key) => {
      result[key] = value;
    });
  } catch (e) {
    // Ignore header serialization errors in logging path.
  }
  return result;
}

export class SafeFetchError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SafeFetchError';
    this.details = details;
  }
}

export async function safeFetch(url, options = {}) {
  const requestMethod = options.method || 'GET';
  const requestUrl = typeof url === 'string' ? url : String(url);
  console.debug('[safeFetch] Request start', { url: requestUrl, method: requestMethod });
  let response;

  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new SafeFetchError('Unable to reach API. Please check your connection or backend service.', {
      url: requestUrl,
      method: requestMethod,
      originalError: error?.message || String(error)
    });
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const rawBody = await response.text();
  const responseDetails = {
    url: requestUrl,
    method: requestMethod,
    status: response.status,
    ok: response.ok,
    contentType,
    headers: headersToObject(response.headers),
    bodyPreview: rawBody.slice(0, 1000)
  };

  // Debugging logs required for API response triage.
  console.debug('[safeFetch] API response details', responseDetails);

  const bodyStartsWithHtml = /^\s*</.test(rawBody);
  if (!contentType.includes('application/json')) {
    console.error('[safeFetch] Non-JSON response body', rawBody);
    throw new SafeFetchError(
      bodyStartsWithHtml ? 'API returned HTML instead of JSON' : 'API returned non-JSON response',
      responseDetails
    );
  }

  let parsed;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    console.error('[safeFetch] Failed to parse JSON body', rawBody);
    throw new SafeFetchError('API returned invalid JSON', {
      ...responseDetails,
      parseError: error?.message || String(error)
    });
  }

  if (!response.ok) {
    throw new SafeFetchError(`API request failed with status ${response.status}`, {
      ...responseDetails,
      parsedBody: parsed
    });
  }

  return {
    status: response.status,
    headers: response.headers,
    data: parsed
  };
}

