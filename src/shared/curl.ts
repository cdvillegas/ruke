import type { ApiRequest, HttpMethod, KeyValue, RequestBody, AuthConfig } from './types';

export interface ParsedCurl {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  body: RequestBody;
  auth: AuthConfig;
}

export function parseCurl(input: string): ParsedCurl {
  const trimmed = input.trim().replace(/\\\n\s*/g, ' ');
  let rest = trimmed.startsWith('curl') ? trimmed.slice(4).trim() : trimmed;

  let method: HttpMethod = 'GET';
  const headers: KeyValue[] = [];
  let rawBody: string | undefined;
  let bodyType: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'none' = 'none';
  let auth: AuthConfig = { type: 'none' };
  let url = '';
  const formData: KeyValue[] = [];

  const tokens = tokenize(rest);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t === '-X' || t === '--request') {
      const val = tokens[++i]?.toUpperCase();
      if (val && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(val)) {
        method = val as HttpMethod;
      }
    } else if (t === '-H' || t === '--header') {
      const header = tokens[++i];
      if (header) {
        const colonIdx = header.indexOf(':');
        if (colonIdx > 0) {
          headers.push({
            key: header.slice(0, colonIdx).trim(),
            value: header.slice(colonIdx + 1).trim(),
            enabled: true,
          });
        }
      }
    } else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary') {
      rawBody = tokens[++i];
      if (method === 'GET') method = 'POST';
    } else if (t === '--data-urlencode') {
      const val = tokens[++i];
      if (val) {
        const eqIdx = val.indexOf('=');
        if (eqIdx > 0) {
          formData.push({ key: val.slice(0, eqIdx), value: val.slice(eqIdx + 1), enabled: true });
        }
      }
      bodyType = 'x-www-form-urlencoded';
      if (method === 'GET') method = 'POST';
    } else if (t === '-F' || t === '--form') {
      const val = tokens[++i];
      if (val) {
        const eqIdx = val.indexOf('=');
        if (eqIdx > 0) {
          formData.push({ key: val.slice(0, eqIdx), value: val.slice(eqIdx + 1), enabled: true });
        }
      }
      bodyType = 'form-data';
      if (method === 'GET') method = 'POST';
    } else if (t === '-u' || t === '--user') {
      const creds = tokens[++i];
      if (creds) {
        const colonIdx = creds.indexOf(':');
        if (colonIdx > 0) {
          auth = {
            type: 'basic',
            basic: { username: creds.slice(0, colonIdx), password: creds.slice(colonIdx + 1) },
          };
        }
      }
    } else if (t === '--compressed' || t === '-s' || t === '--silent' || t === '-k' || t === '--insecure'
      || t === '-L' || t === '--location' || t === '-v' || t === '--verbose' || t === '-i') {
      // skip flags that don't need values
    } else if (t.startsWith('-')) {
      // skip unknown flags with their values
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) i++;
    } else {
      if (!url) url = t.replace(/^['"]|['"]$/g, '');
    }
  }

  if (rawBody !== undefined && bodyType === 'none') {
    const contentType = headers.find(h => h.key.toLowerCase() === 'content-type')?.value || '';
    if (contentType.includes('x-www-form-urlencoded')) {
      bodyType = 'x-www-form-urlencoded';
      const pairs = rawBody.split('&');
      for (const pair of pairs) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
          formData.push({
            key: decodeURIComponent(pair.slice(0, eqIdx)),
            value: decodeURIComponent(pair.slice(eqIdx + 1)),
            enabled: true,
          });
        }
      }
    } else {
      try {
        JSON.parse(rawBody);
        bodyType = 'json';
      } catch {
        bodyType = 'raw';
      }
    }
  }

  let body: RequestBody;
  if (bodyType === 'form-data') {
    body = { type: 'form-data', formData };
  } else if (bodyType === 'x-www-form-urlencoded') {
    body = { type: 'x-www-form-urlencoded', urlEncoded: formData };
  } else if (rawBody !== undefined) {
    body = { type: bodyType as 'json' | 'raw', raw: rawBody };
  } else {
    body = { type: 'none' };
  }

  return { method, url, headers, body, auth };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i])) i++;
    if (i >= input.length) break;

    if (input[i] === "'" || input[i] === '"') {
      const quote = input[i];
      i++;
      let token = '';
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) {
          i++;
          token += input[i];
        } else {
          token += input[i];
        }
        i++;
      }
      if (i < input.length) i++;
      tokens.push(token);
    } else {
      let token = '';
      while (i < input.length && !/\s/.test(input[i])) {
        token += input[i];
        i++;
      }
      tokens.push(token);
    }
  }
  return tokens;
}

export function toCurl(request: ApiRequest, resolvedUrl?: string): string {
  const parts: string[] = ['curl'];
  const url = resolvedUrl || request.url;

  if (request.method !== 'GET') {
    parts.push(`-X ${request.method}`);
  }

  parts.push(`'${url}'`);

  for (const h of request.headers) {
    if (h.enabled && h.key) {
      parts.push(`-H '${h.key}: ${h.value}'`);
    }
  }

  if (request.auth.type === 'bearer' && request.auth.bearer?.token) {
    parts.push(`-H 'Authorization: Bearer ${request.auth.bearer.token}'`);
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    parts.push(`-u '${request.auth.basic.username}:${request.auth.basic.password}'`);
  } else if (request.auth.type === 'api-key' && request.auth.apiKey) {
    if (request.auth.apiKey.addTo === 'header') {
      parts.push(`-H '${request.auth.apiKey.key}: ${request.auth.apiKey.value}'`);
    }
  }

  if (request.body.type === 'json' || request.body.type === 'raw') {
    if (request.body.raw) {
      if (request.body.type === 'json') {
        const hasContentType = request.headers.some(h => h.enabled && h.key.toLowerCase() === 'content-type');
        if (!hasContentType) parts.push("-H 'Content-Type: application/json'");
      }
      parts.push(`-d '${request.body.raw.replace(/'/g, "'\\''")}'`);
    }
  } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlEncoded) {
    for (const p of request.body.urlEncoded) {
      if (p.enabled) parts.push(`--data-urlencode '${p.key}=${p.value}'`);
    }
  } else if (request.body.type === 'form-data' && request.body.formData) {
    for (const p of request.body.formData) {
      if (p.enabled) parts.push(`-F '${p.key}=${p.value}'`);
    }
  } else if (request.body.type === 'graphql' && request.body.graphql?.query) {
    const payload: Record<string, any> = { query: request.body.graphql.query };
    if (request.body.graphql.variables) {
      try { payload.variables = JSON.parse(request.body.graphql.variables); } catch {}
    }
    if (request.body.graphql.operationName) payload.operationName = request.body.graphql.operationName;
    const hasContentType = request.headers.some(h => h.enabled && h.key.toLowerCase() === 'content-type');
    if (!hasContentType) parts.push("-H 'Content-Type: application/json'");
    parts.push(`-d '${JSON.stringify(payload).replace(/'/g, "'\\''")}'`);
  }

  const query = request.params.filter(p => p.enabled && p.key && p.value);
  if (query.length > 0 && !url.includes('?')) {
    const qs = query.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
    parts[parts.indexOf(`'${url}'`)] = `'${url}?${qs}'`;
  }

  return parts.join(' \\\n  ');
}
