const normalizeBaseUrl = (value) => String(value ?? '').trim().replace(/\/+$/, '');

const readSetCookieHeaders = (headers) => {
  if (!headers) return [];
  if (typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    return Array.isArray(values) ? values : [];
  }

  const raw = headers.get?.('set-cookie');
  return typeof raw === 'string' && raw.length > 0 ? [raw] : [];
};

const extractTokenFromSetCookie = (setCookieHeaders) => {
  for (const headerValue of setCookieHeaders) {
    const tokenMatch = /^token=([^;]+)/i.exec(String(headerValue ?? '').trim());
    if (tokenMatch?.[1]) {
      return decodeURIComponent(tokenMatch[1]);
    }
  }
  return '';
};

const readErrorMessage = async (response) => {
  try {
    const payload = await response.json();
    const nested = payload?.error?.message;
    if (typeof nested === 'string' && nested.length > 0) {
      return nested;
    }
  } catch {
    // ignore parse error
  }

  try {
    const text = await response.text();
    const normalized = String(text ?? '').trim();
    return normalized.length > 0 ? normalized : 'authentication failed';
  } catch {
    return 'authentication failed';
  }
};

export const resolveOpsAuthToken = async ({
  baseUrl,
  authToken = '',
  authEmail = '',
  authPassword = '',
  contextLabel = 'ops-auth',
}) => {
  const existingToken = String(authToken ?? '').trim();
  if (existingToken.length > 0) {
    return {
      token: existingToken,
      source: 'provided',
    };
  }

  const email = String(authEmail ?? '').trim();
  const password = String(authPassword ?? '').trim();
  if (!email || !password) {
    return {
      token: '',
      source: 'none',
    };
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const loginUrl = `${normalizedBaseUrl}/auth/login`;
  const loginResponse = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      remember: false,
    }),
  });

  if (!loginResponse.ok) {
    const reason = await readErrorMessage(loginResponse);
    throw new Error(`[${contextLabel}] login failed (${loginResponse.status}): ${reason}`);
  }

  const token = extractTokenFromSetCookie(readSetCookieHeaders(loginResponse.headers));
  if (!token) {
    throw new Error(
      `[${contextLabel}] login succeeded but session cookie token was not returned by API`
    );
  }

  return {
    token,
    source: 'login',
  };
};
