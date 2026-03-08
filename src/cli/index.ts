#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import type { ApiRequest, ApiResponse, RukeExport, TestResult, ScriptContext } from '../shared/types';
import { runScript } from '../main/scripting/engine';

interface CliOptions {
  file: string;
  env?: string;
  envVars?: Record<string, string>;
  timeout?: number;
  bail?: boolean;
  output?: 'console' | 'json' | 'junit';
  outputFile?: string;
  verbose?: boolean;
}

interface RunResult {
  request: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  duration: number;
  testResults: TestResult[];
  passed: boolean;
  error?: string;
}

function parseArgs(args: string[]): CliOptions | null {
  if (args.length < 1) return null;

  const opts: CliOptions = { file: '' };
  let i = 0;

  while (i < args.length) {
    switch (args[i]) {
      case '--env':
      case '-e':
        opts.env = args[++i];
        break;
      case '--env-var':
        const pair = args[++i];
        if (pair) {
          const eqIdx = pair.indexOf('=');
          if (eqIdx > 0) {
            if (!opts.envVars) opts.envVars = {};
            opts.envVars[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
          }
        }
        break;
      case '--timeout':
      case '-t':
        opts.timeout = parseInt(args[++i], 10);
        break;
      case '--bail':
      case '-b':
        opts.bail = true;
        break;
      case '--output':
      case '-o':
        opts.output = args[++i] as any;
        break;
      case '--output-file':
        opts.outputFile = args[++i];
        break;
      case '--verbose':
      case '-v':
        opts.verbose = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (!opts.file && !args[i].startsWith('-')) {
          opts.file = args[i];
        }
        break;
    }
    i++;
  }

  return opts.file ? opts : null;
}

function printHelp() {
  console.log(`
  ruke run - Run API collections from the command line

  Usage:
    ruke run <file> [options]

  Arguments:
    <file>              Path to .ruke export file or collection JSON

  Options:
    -e, --env <name>    Environment name to use
    --env-var <K=V>     Override environment variable (repeatable)
    -t, --timeout <ms>  Request timeout in milliseconds (default: 30000)
    -b, --bail          Stop on first failure
    -o, --output <fmt>  Output format: console (default), json, junit
    --output-file <f>   Write output to file
    -v, --verbose       Show request/response details
    -h, --help          Show this help

  Examples:
    ruke run collection.ruke
    ruke run collection.ruke --env production
    ruke run collection.ruke --env-var API_KEY=sk-123 --bail
    ruke run collection.ruke -o json --output-file results.json
  `);
}

async function sendRequest(request: ApiRequest, variables: Record<string, string>, timeout: number): Promise<ApiResponse> {
  const resolve = (s: string) => s.replace(/\{\{([^}]+)\}\}/g, (_, k) => variables[k.trim()] ?? `{{${k}}}`);

  let url = resolve(request.url);
  for (const p of request.params) {
    if (p.enabled && p.key && p.value && url.includes(`{${p.key}}`)) {
      url = url.replace(`{${p.key}}`, encodeURIComponent(resolve(p.value)));
    }
  }

  const headers: Record<string, string> = {};
  for (const h of request.headers) {
    if (h.enabled && h.key) {
      headers[resolve(h.key)] = resolve(h.value);
    }
  }

  if (request.auth.type === 'bearer' && request.auth.bearer?.token) {
    headers['Authorization'] = `Bearer ${resolve(request.auth.bearer.token)}`;
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    headers['Authorization'] = `Basic ${Buffer.from(`${resolve(request.auth.basic.username)}:${resolve(request.auth.basic.password)}`).toString('base64')}`;
  } else if (request.auth.type === 'api-key' && request.auth.apiKey) {
    if (request.auth.apiKey.addTo === 'header') {
      headers[resolve(request.auth.apiKey.key)] = resolve(request.auth.apiKey.value);
    }
  }

  const enabledParams = request.params.filter(p => p.enabled && p.key && p.value !== '' && !url.includes(`{${p.key}}`));
  if (enabledParams.length > 0) {
    const sp = new URLSearchParams();
    for (const p of enabledParams) sp.append(resolve(p.key), resolve(p.value));
    url += (url.includes('?') ? '&' : '?') + sp.toString();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const fetchOpts: RequestInit = {
    method: request.method,
    headers,
    signal: controller.signal,
  };

  if (!['GET', 'HEAD'].includes(request.method) && request.body.type !== 'none') {
    if (request.body.type === 'json' || request.body.type === 'raw') {
      fetchOpts.body = request.body.raw ? resolve(request.body.raw) : undefined;
      if (request.body.type === 'json' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    } else if (request.body.type === 'graphql' && request.body.graphql?.query) {
      const payload: Record<string, any> = { query: resolve(request.body.graphql.query) };
      if (request.body.graphql.variables) {
        try { payload.variables = JSON.parse(resolve(request.body.graphql.variables)); } catch {}
      }
      fetchOpts.body = JSON.stringify(payload);
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlEncoded) {
      const sp = new URLSearchParams();
      for (const p of request.body.urlEncoded) { if (p.enabled) sp.append(resolve(p.key), resolve(p.value)); }
      fetchOpts.body = sp.toString();
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }

  const start = performance.now();
  try {
    const res = await fetch(url, fetchOpts);
    clearTimeout(timeoutId);
    const duration = Math.round(performance.now() - start);
    const bodyText = await res.text();
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { resHeaders[k] = v; });
    return {
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
      body: bodyText,
      size: new TextEncoder().encode(bodyText).length,
      duration,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    return {
      status: 0,
      statusText: isTimeout ? 'Timeout' : (err.message || 'Network Error'),
      headers: {},
      body: JSON.stringify({ error: err.message }),
      size: 0,
      duration: Math.round(performance.now() - start),
      timestamp: new Date().toISOString(),
    };
  }
}

function formatMethod(method: string): string {
  const colors: Record<string, string> = {
    GET: '\x1b[32m', POST: '\x1b[33m', PUT: '\x1b[34m',
    PATCH: '\x1b[35m', DELETE: '\x1b[31m',
  };
  return `${colors[method] || '\x1b[37m'}${method.padEnd(7)}\x1b[0m`;
}

function formatStatus(status: number): string {
  if (status >= 200 && status < 300) return `\x1b[32m${status}\x1b[0m`;
  if (status >= 400) return `\x1b[31m${status}\x1b[0m`;
  if (status >= 300) return `\x1b[33m${status}\x1b[0m`;
  return `\x1b[31m${status}\x1b[0m`;
}

function generateJunit(results: RunResult[], duration: number): string {
  const tests = results.flatMap(r => {
    if (r.testResults.length === 0) {
      return [{
        name: r.request,
        classname: `${r.method} ${r.url}`,
        time: (r.duration / 1000).toFixed(3),
        passed: r.passed,
        error: r.error,
      }];
    }
    return r.testResults.map(t => ({
      name: `${r.request}: ${t.name}`,
      classname: `${r.method} ${r.url}`,
      time: ((t.duration || 0) / 1000).toFixed(3),
      passed: t.passed,
      error: t.error,
    }));
  });

  const failures = tests.filter(t => !t.passed).length;
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<testsuites tests="${tests.length}" failures="${failures}" time="${(duration / 1000).toFixed(3)}">\n`;
  xml += `  <testsuite name="ruke" tests="${tests.length}" failures="${failures}">\n`;
  for (const t of tests) {
    xml += `    <testcase name="${escapeXml(t.name)}" classname="${escapeXml(t.classname)}" time="${t.time}"`;
    if (!t.passed) {
      xml += `>\n      <failure message="${escapeXml(t.error || 'Failed')}" />\n    </testcase>\n`;
    } else {
      xml += ` />\n`;
    }
  }
  xml += `  </testsuite>\n</testsuites>\n`;
  return xml;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] !== 'run') {
    if (args[0] === '--help' || args[0] === '-h' || !args[0]) {
      printHelp();
      process.exit(0);
    }
    console.error(`Unknown command: ${args[0]}. Use "ruke run <file>".`);
    process.exit(1);
  }

  const opts = parseArgs(args.slice(1));
  if (!opts) {
    printHelp();
    process.exit(1);
  }

  const filePath = path.resolve(opts.file);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  let data: RukeExport;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e: any) {
    console.error(`Failed to parse file: ${e.message}`);
    process.exit(1);
  }

  if (!data.requests?.length) {
    console.error('No requests found in file');
    process.exit(1);
  }

  let variables: Record<string, string> = {};
  if (opts.env && data.environments?.length) {
    const env = data.environments.find(e => e.name.toLowerCase() === opts.env!.toLowerCase());
    if (env) {
      const envVars = (data.variables || []).filter(v => v.environmentId === env.id);
      for (const v of envVars) variables[v.key] = v.value;
    } else {
      console.error(`Environment "${opts.env}" not found. Available: ${data.environments.map(e => e.name).join(', ')}`);
      process.exit(1);
    }
  }

  if (opts.envVars) {
    Object.assign(variables, opts.envVars);
  }

  const timeout = opts.timeout || 30000;
  const results: RunResult[] = [];
  const startTime = Date.now();

  console.log(`\n\x1b[1mRüke Collection Runner\x1b[0m`);
  console.log(`File: ${opts.file}`);
  console.log(`Requests: ${data.requests.length}`);
  if (opts.env) console.log(`Environment: ${opts.env}`);
  console.log('');

  for (const req of data.requests) {
    const name = req.name || `${req.method} ${req.url}`;

    if (req.scripts?.preRequest) {
      const preCtx: ScriptContext = {
        request: {
          method: req.method,
          url: req.url,
          headers: Object.fromEntries(req.headers.filter(h => h.enabled).map(h => [h.key, h.value])),
          body: req.body.raw,
        },
        variables,
        testResults: [],
      };
      const preResult = runScript(req.scripts.preRequest, preCtx, 'pre-request');
      Object.assign(variables, preResult.variables);
      if (preResult.error && opts.verbose) {
        console.log(`  \x1b[33m⚠ Pre-request script error: ${preResult.error}\x1b[0m`);
      }
    }

    const response = await sendRequest(req, variables, timeout);
    let testResults: TestResult[] = [];
    let scriptError: string | undefined;

    if (req.scripts?.postResponse) {
      const postCtx: ScriptContext = {
        request: {
          method: req.method,
          url: req.url,
          headers: Object.fromEntries(req.headers.filter(h => h.enabled).map(h => [h.key, h.value])),
          body: req.body.raw,
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          body: response.body,
          duration: response.duration,
        },
        variables,
        testResults: [],
      };
      const postResult = runScript(req.scripts.postResponse, postCtx, 'post-response');
      testResults = postResult.testResults;
      Object.assign(variables, postResult.variables);
      if (postResult.error) scriptError = postResult.error;
    }

    const passed = response.status > 0 && response.status < 400 && testResults.every(t => t.passed) && !scriptError;
    const result: RunResult = {
      request: name,
      method: req.method,
      url: req.url,
      status: response.status,
      statusText: response.statusText,
      duration: response.duration,
      testResults,
      passed,
      error: scriptError || (response.status === 0 ? response.statusText : undefined),
    };
    results.push(result);

    const icon = passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`  ${icon} ${formatMethod(req.method)} ${name}  ${formatStatus(response.status)} ${response.duration}ms`);

    if (testResults.length > 0) {
      for (const t of testResults) {
        const tIcon = t.passed ? '\x1b[32m  ✓\x1b[0m' : '\x1b[31m  ✗\x1b[0m';
        console.log(`    ${tIcon} ${t.name}${t.error ? ` - ${t.error}` : ''}`);
      }
    }

    if (opts.verbose) {
      console.log(`    URL: ${req.url}`);
      console.log(`    Response: ${response.body.slice(0, 200)}${response.body.length > 200 ? '...' : ''}`);
    }

    if (!passed && opts.bail) {
      console.log(`\n\x1b[31m✗ Stopped: --bail flag set\x1b[0m\n`);
      break;
    }
  }

  const totalDuration = Date.now() - startTime;
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log('');
  console.log(`  \x1b[1mResults:\x1b[0m ${results.length} requests, \x1b[32m${passedCount} passed\x1b[0m, \x1b[31m${failedCount} failed\x1b[0m`);
  console.log(`  \x1b[1mDuration:\x1b[0m ${totalDuration}ms`);
  console.log('');

  if (opts.output === 'json' || opts.outputFile?.endsWith('.json')) {
    const output = JSON.stringify({ results, duration: totalDuration, passed: passedCount, failed: failedCount }, null, 2);
    if (opts.outputFile) {
      fs.writeFileSync(opts.outputFile, output);
      console.log(`  Results written to ${opts.outputFile}`);
    } else {
      console.log(output);
    }
  } else if (opts.output === 'junit' || opts.outputFile?.endsWith('.xml')) {
    const xml = generateJunit(results, totalDuration);
    if (opts.outputFile) {
      fs.writeFileSync(opts.outputFile, xml);
      console.log(`  JUnit report written to ${opts.outputFile}`);
    } else {
      console.log(xml);
    }
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
