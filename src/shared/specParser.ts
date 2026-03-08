import { nanoid } from 'nanoid';
import yaml from 'js-yaml';
import type { ApiEndpoint, HttpMethod } from '@shared/types';

export function parseSpec(text: string): any {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  return yaml.load(trimmed);
}

function resolveRef(ref: string, spec: any): any {
  if (!ref.startsWith('#/')) return null;
  const parts = ref.slice(2).split('/');
  let current = spec;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return null;
    current = current[part];
  }
  return current || null;
}

export function resolveSchema(schema: any, spec: any, depth = 0): any {
  if (!schema || depth > 8) return schema;
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, spec);
    return resolved ? resolveSchema(resolved, spec, depth + 1) : schema;
  }
  if (schema.allOf) {
    let merged: any = {};
    for (const sub of schema.allOf) {
      const resolved = resolveSchema(sub, spec, depth + 1);
      if (resolved?.properties) {
        merged.properties = { ...merged.properties, ...resolved.properties };
        if (resolved.required) {
          merged.required = [...(merged.required || []), ...resolved.required];
        }
      } else {
        merged = { ...merged, ...resolved };
      }
    }
    return merged;
  }
  if (schema.anyOf || schema.oneOf) {
    const variants = schema.anyOf || schema.oneOf;
    const resolved = resolveSchema(variants[0], spec, depth + 1);
    const parentMeta: any = {};
    if (schema.description) parentMeta.description = schema.description;
    if (schema.example !== undefined) parentMeta.example = schema.example;
    if (schema.default !== undefined) parentMeta.default = schema.default;
    if (schema.nullable) parentMeta.nullable = schema.nullable;
    return { ...resolved, ...parentMeta };
  }
  return schema;
}

export function extractBodyParams(schema: any, spec: any): ApiEndpoint['parameters'] {
  const resolved = resolveSchema(schema, spec);
  if (!resolved?.properties) return undefined;
  const requiredSet = new Set<string>(resolved.required || []);
  const params: ApiEndpoint['parameters'] = [];

  for (const [name, prop] of Object.entries(resolved.properties) as [string, any][]) {
    const resolvedProp = resolveSchema(prop, spec);
    let type = resolvedProp?.type || 'string';
    if (type === 'array' && resolvedProp?.items) {
      const resolvedItems = resolveSchema(resolvedProp.items, spec);
      const itemType = resolvedItems?.type || 'object';
      type = `${itemType}[]`;
    }

    params.push({
      name,
      in: 'body' as any,
      required: requiredSet.has(name),
      type,
      description: resolvedProp?.description,
      enumValues: resolvedProp?.enum,
    });
  }
  return params.length > 0 ? params : undefined;
}

export function generateBodyTemplate(schema: any, spec: any, depth = 0): any {
  if (!schema || depth > 6) return null;
  const resolved = resolveSchema(schema, spec);
  if (!resolved) return null;

  if (resolved.default !== undefined) return resolved.default;
  if (resolved.example !== undefined) return resolved.example;

  if (resolved.type === 'object' || resolved.properties) {
    const obj: Record<string, any> = {};
    if (resolved.properties) {
      const requiredSet = new Set<string>(resolved.required || []);
      for (const [key, prop] of Object.entries(resolved.properties) as [string, any][]) {
        const resolvedProp = resolveSchema(prop, spec);
        if (resolvedProp?.default !== undefined) {
          obj[key] = resolvedProp.default;
        } else if (resolvedProp?.example !== undefined) {
          obj[key] = resolvedProp.example;
        } else if (requiredSet.has(key)) {
          const val = generateBodyTemplate(prop, spec, depth + 1);
          if (val !== null) obj[key] = val;
        }
      }
    }
    return obj;
  }

  if (resolved.type === 'array') {
    return [];
  }

  if (resolved.enum?.[0]) return resolved.enum[0];

  switch (resolved.type) {
    case 'string': return '';
    case 'number': case 'integer': return 0;
    case 'boolean': return false;
    default: return null;
  }
}

export function parseOpenApiEndpoints(spec: any): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const paths = spec.paths || {};

  for (const [path, methods] of Object.entries(paths) as [string, any][]) {
    for (const [method, details] of Object.entries(methods) as [string, any][]) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) continue;

      const params: ApiEndpoint['parameters'] = (details.parameters || []).map((p: any) => ({
        name: p.name,
        in: p.in,
        required: p.required || false,
        type: p.schema?.type || p.type || 'string',
        description: p.description,
      }));

      let requestBody: ApiEndpoint['requestBody'] | undefined;
      let bodyParams: ApiEndpoint['parameters'] | undefined;
      if (details.requestBody?.content?.['application/json']) {
        const schema = details.requestBody.content['application/json'].schema;
        const explicitExample = details.requestBody.content['application/json'].example;

        bodyParams = extractBodyParams(schema, spec);

        const template = explicitExample || generateBodyTemplate(schema, spec);
        const resolvedSchema = resolveSchema(schema, spec);
        requestBody = {
          type: 'json',
          schema: resolvedSchema ? JSON.stringify(resolvedSchema, null, 2) : undefined,
          example: template ? JSON.stringify(template, null, 2) : undefined,
        };
      }

      const allParams = [
        ...(params && params.length > 0 ? params : []),
        ...(bodyParams || []),
      ];

      endpoints.push({
        id: nanoid(),
        connectionId: '',
        method: method.toUpperCase() as HttpMethod,
        path,
        summary: details.summary || `${method.toUpperCase()} ${path}`,
        description: details.description,
        parameters: allParams.length > 0 ? allParams : undefined,
        requestBody,
        tags: details.tags,
      });
    }
  }

  return endpoints;
}

export function getSpecBaseUrl(spec: any): string {
  if (spec.servers?.[0]?.url) return spec.servers[0].url;
  if (spec.host) {
    const scheme = spec.schemes?.[0] || 'https';
    return `${scheme}://${spec.host}${spec.basePath || ''}`;
  }
  return '';
}
