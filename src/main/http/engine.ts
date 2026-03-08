import type { ApiRequest, ApiResponse, KeyValue } from '../../shared/types';
import { VARIABLE_REGEX } from '../../shared/constants';

export interface RequestOptions {
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  proxy?: { host: string; port: number; auth?: { username: string; password: string } };
}

interface RedirectEntry {
  status: number;
  url: string;
}

const DEFAULT_TIMEOUT = 30000;

export class HttpEngine {
  async send(request: ApiRequest & { resolvedVariables?: Record<string, string>; options?: RequestOptions }): Promise<ApiResponse> {
    const vars = request.resolvedVariables || {};
    const opts = request.options || {};
    const rawUrl = this.resolveVariables(request.url, vars);
    const pathParamKeys = new Set<string>();

    let url = rawUrl;
    for (const p of request.params) {
      if (p.enabled && p.key && p.value && rawUrl.includes(`{${p.key}}`)) {
        url = url.replace(`{${p.key}}`, encodeURIComponent(this.resolveVariables(p.value, vars)));
        pathParamKeys.add(p.key);
      }
    }
    const startTime = performance.now();

    try {
      const headers: Record<string, string> = {};
      for (const h of request.headers) {
        if (h.enabled) {
          headers[this.resolveVariables(h.key, vars)] = this.resolveVariables(h.value, vars);
        }
      }

      const queryParams = this.applyAuth(request, headers, vars);

      let queryString = '';
      const enabledParams = [
        ...request.params.filter(p => p.enabled && p.key && p.value !== '' && !pathParamKeys.has(p.key)),
        ...queryParams,
      ];
      if (enabledParams.length > 0) {
        const searchParams = new URLSearchParams();
        for (const p of enabledParams) {
          searchParams.append(
            this.resolveVariables(p.key, vars),
            this.resolveVariables(p.value, vars)
          );
        }
        queryString = '?' + searchParams.toString();
      }

      const fullUrl = url + queryString;
      const timeout = opts.timeout || DEFAULT_TIMEOUT;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const followRedirects = opts.followRedirects !== false;

      const fetchOptions: RequestInit = {
        method: request.method,
        headers,
        signal: controller.signal,
        redirect: followRedirects ? 'follow' : 'manual',
      };

      const builtBody = this.buildBody(request, headers, vars);
      if (!['GET', 'HEAD'].includes(request.method) && request.body.type !== 'none') {
        fetchOptions.body = builtBody;
        if ((request.body.type === 'json' || request.body.type === 'graphql') && !headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
        if (request.body.type === 'x-www-form-urlencoded' && !headers['Content-Type']) {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }

      const response = await fetch(fullUrl, fetchOptions);
      clearTimeout(timeoutId);
      const duration = performance.now() - startTime;

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const contentType = (responseHeaders['content-type'] || '').toLowerCase();
      const isBinary = /^(audio|image|video|application\/octet-stream|application\/pdf|application\/zip)/.test(contentType);

      if (isBinary) {
        const buf = await response.arrayBuffer();
        const base64 = Buffer.from(buf).toString('base64');
        return {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: base64,
          bodyEncoding: 'base64' as const,
          size: buf.byteLength,
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
          redirected: response.redirected || undefined,
          finalUrl: response.url !== fullUrl ? response.url : undefined,
        };
      }

      const bodyText = await response.text();
      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: bodyText,
        size: new TextEncoder().encode(bodyText).length,
        duration: Math.round(duration),
        timestamp: new Date().toISOString(),
        redirected: response.redirected || undefined,
        finalUrl: response.url !== fullUrl ? response.url : undefined,
      };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      const isTimeout = error.name === 'AbortError';
      return {
        status: 0,
        statusText: isTimeout ? 'Request Timeout' : (error.message || 'Network Error'),
        headers: {},
        body: JSON.stringify({
          error: isTimeout ? `Request timed out after ${opts.timeout || DEFAULT_TIMEOUT}ms` : error.message,
        }, null, 2),
        size: 0,
        duration: Math.round(duration),
        timestamp: new Date().toISOString(),
      };
    }
  }

  private resolveVariables(str: string, vars: Record<string, string>): string {
    return str.replace(VARIABLE_REGEX, (_, key) => vars[key.trim()] ?? `{{${key}}}`);
  }

  private applyAuth(request: ApiRequest, headers: Record<string, string>, vars: Record<string, string>): KeyValue[] {
    const queryParams: KeyValue[] = [];
    switch (request.auth.type) {
      case 'bearer':
        if (request.auth.bearer?.token) {
          headers['Authorization'] = `Bearer ${this.resolveVariables(request.auth.bearer.token, vars)}`;
        }
        break;
      case 'basic':
        if (request.auth.basic) {
          const user = this.resolveVariables(request.auth.basic.username, vars);
          const pass = this.resolveVariables(request.auth.basic.password, vars);
          headers['Authorization'] = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
        }
        break;
      case 'api-key':
        if (request.auth.apiKey) {
          const key = this.resolveVariables(request.auth.apiKey.key, vars);
          const value = this.resolveVariables(request.auth.apiKey.value, vars);
          if (request.auth.apiKey.addTo === 'header') {
            headers[key] = value;
          } else if (request.auth.apiKey.addTo === 'query') {
            queryParams.push({ key, value, enabled: true });
          }
        }
        break;
      case 'oauth2':
        if (request.auth.oauth2?.accessToken) {
          headers['Authorization'] = `Bearer ${this.resolveVariables(request.auth.oauth2.accessToken, vars)}`;
        }
        break;
    }
    return queryParams;
  }

  private buildBody(request: ApiRequest, headers: Record<string, string>, vars: Record<string, string>): string | FormData | undefined {
    switch (request.body.type) {
      case 'graphql': {
        const gql = request.body.graphql;
        if (!gql?.query) return undefined;
        const payload: Record<string, any> = { query: this.resolveVariables(gql.query, vars) };
        if (gql.variables) {
          try { payload.variables = JSON.parse(this.resolveVariables(gql.variables, vars)); } catch {
            payload.variables = {};
          }
        }
        if (gql.operationName) payload.operationName = gql.operationName;
        return JSON.stringify(payload);
      }
      case 'json':
      case 'raw':
        return request.body.raw ? this.resolveVariables(request.body.raw, vars) : undefined;
      case 'x-www-form-urlencoded': {
        if (!request.body.urlEncoded) return undefined;
        const params = new URLSearchParams();
        for (const p of request.body.urlEncoded) {
          if (p.enabled) {
            params.append(this.resolveVariables(p.key, vars), this.resolveVariables(p.value, vars));
          }
        }
        return params.toString();
      }
      case 'form-data': {
        if (!request.body.formData) return undefined;
        const formData = new FormData();
        for (const p of request.body.formData) {
          if (p.enabled) {
            formData.append(this.resolveVariables(p.key, vars), this.resolveVariables(p.value, vars));
          }
        }
        delete headers['Content-Type'];
        return formData as any;
      }
      case 'binary': {
        if (!request.body.binary) return undefined;
        return request.body.binary;
      }
      default:
        return undefined;
    }
  }
}
