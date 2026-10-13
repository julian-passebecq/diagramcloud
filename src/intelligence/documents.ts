import type {DocumentInput, DocumentMap, DocumentDiagnostic, DocumentLink} from './types';
import {secretInText} from '../core/secrets';
import {mapStructuredDocuments,wantedStructuredDocument} from './structuredDocuments';

/** Application boundary for already-authorized inventory text. Filtering remains
 * mandatory even when metadata was accepted; document instructions stay inert. */
export function mapAuthorizedDocuments(input: readonly DocumentInput[]): DocumentMap {
  return mapDocuments(input, text => secretInText(text) === null);
}

export const DOCUMENT_LIMITS = {files: 200, fileBytes: 128 * 1024, totalBytes: 8 * 1024 * 1024, rows: 2000, columns: 40, links: 4000, diagnostics: 1000} as const;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
/** Metadata gate to call BEFORE reading bytes. Symlinks/nested repo policy belongs to the reader. */
export function wantedDocument(path: string): boolean {
  if (!path || path.startsWith('/') || /^[a-z]:/i.test(path) || /[\u0000-\u001f]/.test(path)) return false;
  const p = path.replace(/\\/g, '/');
  if (p.split('/').some(s => !s || s === '.' || s === '..')) return false;
  if (/(^|\/)(\.git|node_modules|vendor|dist|build|out|target|coverage|\.venv|venv|\.cache|\.worktrees|\.claude|\.terraform|test-results|playwright-report)(\/|$)/i.test(p)) return false;
  if (/(^|\/)[^/]*(secret|credential|private[-_]?key)[^/]*\.(md|csv)$/i.test(p)) return false;
  return /\.(md|csv)$/i.test(p)||wantedStructuredDocument(p);
}

type Row = {cells: string[]; startLine: number; endLine: number};
/** Bounded CSV reader, including quoted commas/newlines and doubled quotes. */
export function readCsv(text: string): Row[] {
  const rows: Row[] = []; let cells: string[] = [], field = '', quote = false, closed = false, line = 1, start = 1;
  const pushCell = () => {cells.push(field); field = ''; closed = false; if (cells.length > DOCUMENT_LIMITS.columns) throw new Error('Too many CSV columns');};
  const pushRow = () => {pushCell(); if (cells.some(c => c.length)) rows.push({cells, startLine: start, endLine: line}); cells = []; if (rows.length > DOCUMENT_LIMITS.rows + 1) throw new Error('Too many CSV rows');};
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '"') {if (text[i + 1] === '"') {field += '"'; i++;} else {quote = false; closed = true;}}
      else {field += c; if (c === '\n' || (c === '\r' && text[i + 1] !== '\n')) line++;}
    } else if (c === '"') {if (field || closed) throw new Error('Invalid CSV quote'); quote = true;}
    else if (c === ',') pushCell();
    else if (c === '\n' || c === '\r') {pushRow(); if (c === '\r' && text[i + 1] === '\n') i++; line++; start = line;}
    else {if (closed) throw new Error('Unexpected text after CSV quote'); field += c;}
    if (field.length > 8000) throw new Error('CSV cell exceeds the analysis limit');
  }
  if (quote) throw new Error('Unclosed CSV quote');
  if (field || cells.length || closed) pushRow();
  return rows;
}

function targetPath(from: string, target: string): string | null {
  // No external URL, file: URL, query-string credentials, active content or filesystem escape.
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) return null;
  let raw: string; try {raw = decodeURIComponent(target.split('#')[0]);} catch {return null;}
  if (!raw || /[?\u0000-\u001f]/.test(raw) || raw.startsWith('/') || raw.includes('\\')) return null;
  const segments = from.split('/').slice(0, -1);
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {if (!segments.length) return null; segments.pop();}
    else {if (part.includes(':')) return null; segments.push(part);}
  }
  return segments.join('/');
}

/** Exact links only. Markdown prose and arbitrary CSV cells never become asserted architecture.
 * Input must be selected/authorized by the caller. No URL or local target is fetched here.
 * isSafeText lets the application reuse its existing secret detector without importing it here.
 */
export function mapDocuments(input: readonly DocumentInput[], isSafeText: (text: string) => boolean): DocumentMap {
  const documents: DocumentMap['documents'] = [], links: DocumentLink[] = [], diagnostics: DocumentDiagnostic[] = [];
  const omitted = {documents: 0, links: 0, diagnostics: 0};
  const diagnostic = (item: DocumentDiagnostic) => {if (diagnostics.length < DOCUMENT_LIMITS.diagnostics) diagnostics.push(item); else omitted.diagnostics++;};
  const files = new Map<string, string>(); let bytes = 0;
  for (const source of [...input].sort((a, b) => compare(a.path, b.path))) {
    const path = source.path.replace(/\\/g, '/');
    if (!wantedDocument(path)) {omitted.documents++; diagnostic({path: '(excluded)', code: 'unsafe', message: 'A path was excluded before document mapping.'}); continue;}
    if (files.has(path)) throw new Error(`Duplicate document path: ${path}`);
    const size = new TextEncoder().encode(source.text).byteLength;
    if (files.size >= DOCUMENT_LIMITS.files || size > DOCUMENT_LIMITS.fileBytes || bytes + size > DOCUMENT_LIMITS.totalBytes) {
      omitted.documents++; diagnostic({path, code: 'limited', message: 'Document exceeds the selected analysis budget; not mapped.'}); continue;
    }
    if (!isSafeText(source.text)) {omitted.documents++; diagnostic({path, code: 'unsafe', message: 'Content rejected by the application safety filter; not mapped.'}); continue;}
    files.set(path, source.text); bytes += size;
  }
  const pending: {path: string; line: number; ids: string[]}[] = [];
  const sourceRecords = new Map<string, {path: string; line: number}[]>();
  const addLink = (link: DocumentLink) => {if (links.length < DOCUMENT_LIMITS.links) links.push(link); else {omitted.links++; diagnostic({path: link.fromPath, line: link.fromLine, code: 'limited', message: 'Link budget reached.'});}};
  const structured=mapStructuredDocuments([...files].filter(([path])=>wantedStructuredDocument(path)).map(([path,text])=>({path,text})),isSafeText,[...files.keys()]);
  documents.push(...structured.documents);structured.links.forEach(addLink);structured.diagnostics.forEach(diagnostic);
  omitted.documents+=structured.omitted.documents;omitted.links+=structured.omitted.links;omitted.diagnostics+=structured.omitted.diagnostics;
  const structuredPaths=new Set(structured.documents.map(d=>d.path));
  // A malformed selected structured file cannot resolve a Markdown provenance link.
  for(const path of files.keys())if(wantedStructuredDocument(path)&&!structuredPaths.has(path))files.delete(path);
  for (const [path, text] of files) {
    if(wantedStructuredDocument(path))continue;
    const entry: DocumentMap['documents'][number] = {path, kind: /\.md$/i.test(path) ? 'markdown' : 'csv', headings: [], records: []};
    documents.push(entry);
    if (entry.kind === 'markdown') {
      let fence: string | null = null;
      text.split(/\r?\n/).forEach((line, index) => {
        const mark = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
        if (mark) {if (!fence) fence = mark; else if (mark[0] === fence[0] && mark.length >= fence.length) fence = null; return;}
        if (fence) return; // An example in a code fence is not an asserted document relationship.
        const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
        if (heading && entry.headings.length < 500) entry.headings.push({level: heading[1].length, title: heading[2].slice(0, 200), line: index + 1});
        const plain = line.replace(/`[^`]*`/g, '');
        for (const match of plain.matchAll(/(?<!!)\[[^\]\n]+\]\(<?([^\s)>]+)>?(?:\s+"[^"\n]*")?\)/g)) {
          const target = match[1];
          if (target.startsWith('#') || /^(https?|mailto):/i.test(target)) continue;
          const toPath = targetPath(path, target);
          if (toPath && files.has(toPath)) {
            addLink({fromPath: path, fromLine: index + 1, toPath, kind: 'document-link'});
            if (target.includes('#')) diagnostic({path, line: index + 1, code: 'unsupported', message: 'File resolved; heading-fragment resolution is not implemented.'});
          } else diagnostic({path, line: index + 1, code: 'unresolved', message: 'Relative link has no authorized target in the selected document set.'});
        }
      });
    } else {
      try {
        const rows = readCsv(text); if (!rows.length) continue;
        const header = rows[0].cells;
        if (new Set(header).size !== header.length) throw new Error('Duplicate CSV column');
        const idAt = header.indexOf('id'), refsAt = header.indexOf('source_ids');
        for (const row of rows.slice(1)) {
          if (row.cells.length !== header.length) throw new Error('CSV row width differs from header');
          const id = idAt >= 0 ? row.cells[idAt].trim() : '';
          if (id) {
            if (id.length > 200) throw new Error('CSV record ID exceeds 200 characters');
            entry.records.push({id, startLine: row.startLine, endLine: row.endLine});
            if (/(^|\/)sources\.csv$/i.test(path)) {
              const found = sourceRecords.get(id) || []; found.push({path, line: row.startLine}); sourceRecords.set(id, found);
            }
          }
          if (refsAt >= 0) pending.push({path, line: row.startLine, ids: row.cells[refsAt].split(';').map(x => x.trim()).filter(Boolean)});
        }
      } catch (error) {
        entry.records = [];
        // Do not retain half-parsed relationships from a malformed CSV.
        for (const [key, values] of sourceRecords) {const kept = values.filter(v => v.path !== path); if (kept.length) sourceRecords.set(key, kept); else sourceRecords.delete(key);}
        for (let i = pending.length - 1; i >= 0; i--) if (pending[i].path === path) pending.splice(i, 1);
        diagnostic({path, code: 'invalid', message: error instanceof Error ? error.message : 'Invalid CSV'});
      }
    }
  }
  for (const row of pending) for (const id of new Set(row.ids)) {
    const matches = sourceRecords.get(id) || [];
    if (matches.length === 1) addLink({fromPath: row.path, fromLine: row.line, toPath: matches[0].path, toLine: matches[0].line, kind: 'source-record'});
    else diagnostic({path: row.path, line: row.line, code: matches.length ? 'ambiguous' : 'unresolved', message: matches.length ? 'Source ID has multiple records; no relationship created.' : 'Source ID has no authorized source record.'});
  }
  const unique = new Map(links.map(link => [JSON.stringify(link), link]));
  return {format: 'diagramcloud.document-map', version: 1, documents, links: [...unique.values()], diagnostics, omitted,
    limitations: ['Only selected Markdown/CSV/JSON/YAML documents are mapped; source files are not fetched.',
      'Markdown support is limited to ATX headings and inline relative file links outside fenced code; fragments/images/reference links are not resolved.',
      'CSV source_ids uses semicolons and resolves only unique id rows in selected sources.csv files. This is a provenance link, not data lineage.',
      'Filename current/history, prose, dates and status text do not prove implementation or supersession.',
      'The map is private authoring context until separately projected and reviewed for publication.',...structured.limitations]};
}
