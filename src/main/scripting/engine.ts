import vm from 'vm';
import type { ScriptContext, TestResult } from '../../shared/types';

export interface ScriptResult {
  variables: Record<string, string>;
  testResults: TestResult[];
  logs: string[];
  error?: string;
}

export function runScript(
  script: string,
  context: ScriptContext,
  phase: 'pre-request' | 'post-response'
): ScriptResult {
  const variables = { ...context.variables };
  const testResults: TestResult[] = [];
  const logs: string[] = [];

  const rk = {
    variables: {
      get: (key: string) => variables[key] ?? null,
      set: (key: string, value: string) => { variables[key] = String(value); },
      unset: (key: string) => { delete variables[key]; },
      toObject: () => ({ ...variables }),
    },
    request: context.request,
    response: phase === 'post-response' ? context.response : undefined,
    test: (name: string, fn: () => void) => {
      const start = performance.now();
      try {
        fn();
        testResults.push({ name, passed: true, duration: Math.round(performance.now() - start) });
      } catch (e: any) {
        testResults.push({ name, passed: false, error: e.message, duration: Math.round(performance.now() - start) });
      }
    },
    expect: (value: any) => createExpect(value),
    log: (...args: any[]) => {
      logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    },
  };

  const consoleMock = {
    log: (...args: any[]) => rk.log(...args),
    warn: (...args: any[]) => rk.log('[WARN]', ...args),
    error: (...args: any[]) => rk.log('[ERROR]', ...args),
    info: (...args: any[]) => rk.log('[INFO]', ...args),
  };

  const responseHelpers = phase === 'post-response' && context.response ? {
    json: () => {
      try { return JSON.parse(context.response!.body); } catch { return null; }
    },
    text: () => context.response!.body,
    status: context.response!.status,
    statusText: context.response!.statusText,
    headers: context.response!.headers,
    duration: context.response!.duration,
  } : {};

  try {
    const sandbox = {
      rk,
      console: consoleMock,
      response: responseHelpers,
      JSON,
      Math,
      Date,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      encodeURI,
      decodeURI,
      atob: (s: string) => Buffer.from(s, 'base64').toString(),
      btoa: (s: string) => Buffer.from(s).toString('base64'),
    };

    const vmContext = vm.createContext(sandbox);
    vm.runInContext(script, vmContext, { timeout: 5000, filename: `${phase}-script.js` });
  } catch (e: any) {
    return { variables, testResults, logs, error: e.message };
  }

  return { variables, testResults, logs };
}

function createExpect(actual: any) {
  return {
    toBe: (expected: any) => {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
    },
    toEqual: (expected: any) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
      }
    },
    toBeTruthy: () => {
      if (!actual) throw new Error(`Expected ${JSON.stringify(actual)} to be truthy`);
    },
    toBeFalsy: () => {
      if (actual) throw new Error(`Expected ${JSON.stringify(actual)} to be falsy`);
    },
    toBeGreaterThan: (n: number) => {
      if (actual <= n) throw new Error(`Expected ${actual} to be greater than ${n}`);
    },
    toBeLessThan: (n: number) => {
      if (actual >= n) throw new Error(`Expected ${actual} to be less than ${n}`);
    },
    toContain: (item: any) => {
      if (typeof actual === 'string') {
        if (!actual.includes(item)) throw new Error(`Expected "${actual}" to contain "${item}"`);
      } else if (Array.isArray(actual)) {
        if (!actual.includes(item)) throw new Error(`Expected array to contain ${JSON.stringify(item)}`);
      } else {
        throw new Error(`toContain requires a string or array, got ${typeof actual}`);
      }
    },
    toHaveProperty: (prop: string) => {
      if (actual == null || !(prop in actual)) {
        throw new Error(`Expected object to have property "${prop}"`);
      }
    },
    toHaveLength: (len: number) => {
      if (actual?.length !== len) {
        throw new Error(`Expected length ${actual?.length} to be ${len}`);
      }
    },
    toMatch: (pattern: RegExp | string) => {
      const re = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      if (!re.test(String(actual))) {
        throw new Error(`Expected "${actual}" to match ${pattern}`);
      }
    },
    toBeDefined: () => {
      if (actual === undefined) throw new Error('Expected value to be defined');
    },
    toBeUndefined: () => {
      if (actual !== undefined) throw new Error(`Expected undefined but got ${JSON.stringify(actual)}`);
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(`Expected null but got ${JSON.stringify(actual)}`);
    },
    not: {
      toBe: (expected: any) => {
        if (actual === expected) throw new Error(`Expected ${JSON.stringify(actual)} not to be ${JSON.stringify(expected)}`);
      },
      toEqual: (expected: any) => {
        if (JSON.stringify(actual) === JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(actual)} not to equal ${JSON.stringify(expected)}`);
        }
      },
      toContain: (item: any) => {
        if (typeof actual === 'string' && actual.includes(item)) {
          throw new Error(`Expected "${actual}" not to contain "${item}"`);
        }
        if (Array.isArray(actual) && actual.includes(item)) {
          throw new Error(`Expected array not to contain ${JSON.stringify(item)}`);
        }
      },
      toBeNull: () => {
        if (actual === null) throw new Error('Expected value not to be null');
      },
    },
  };
}
