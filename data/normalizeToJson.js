/**
 * normalizeToJson(INPUT)
 *
 * Chuyển đổi một chuỗi object phi chuẩn sang chuỗi JSON hợp lệ.
 *
 * Hỗ trợ các định dạng đầu vào:
 *  - Java/Kotlin toString():        ClassName{janCodes=[490...], sortBy=0}
 *  - Single-quoted values:          {name='John', age=30}
 *  - Unquoted keys/values:          {name: John, age: 30}
 *  - JAN code list format:          [4910024340432, 4910024340524]0true
 *  - janCodes=[...] với nội dung tùy ý (số, text, binary, tab-separated)
 *  - jan='...' đa dòng (JAN code phân tách bằng dấu phẩy và newline)
 *  - Giá trị có ký tự điều khiển, backslash, URL, template var
 *  - Chuỗi bị truncate (thiếu dấu đóng ngoặc)
 *  - Nhiều lỗi nhỏ: dấu phẩy thừa/thiếu, ngoặc không khớp, single-quote chưa đóng, v.v.
 *
 * Trả về null nếu chuỗi rỗng, có định dạng không thể phục hồi, hoặc JSON.parse thất bại.
 *
 * @param {string} INPUT - Chuỗi đầu vào cần chuẩn hóa
 * @returns {string|null} - Chuỗi JSON hợp lệ, hoặc null nếu không thể parse
 */

// ─── REGEX CONSTANTS ──────────────────────────────────────────────────────────
// -- Regex chỉ dùng trong .test() / .match() (không /g) --
const RE_JAN_LIST           = /^\[([^\]]+)](\d+)(true|false)$/;
const RE_JUNK_BRACKET       = /^\[[^\]]*]\w+/;
const RE_JUNK_BRACKET_Q     = /^'\[[^\]]*]\w+'$/;
const RE_CLASS_PREFIX_BRACE = /^[A-Za-z][\w.$]*{/;
const RE_CLASS_PREFIX_SQ    = /^[A-Za-z][\w.$]*\s+\[/;
const RE_OUTER_PAREN        = /^[A-Za-z][\w.$]*\((.+)\)$/s;
const RE_CLOSE_PAREN_END    = /\)$/;
const RE_UNCLOSED_SQ_END    = /='([^']*)}$/;
const RE_IS_INTEGER         = /^\d+$/;
const RE_IS_ONLY_DIGITS     = /^-?\d+$/;
const RE_IS_VALID_NUMBER    = /^-?[1-9]\d*(\.\d+)?$/;
const RE_IS_FULL_NUMBER     = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
const RE_STRIP_COLON_PREFIX = /^:\s*/;

// -- Regex /g — dùng với .replaceAll() --
const RE_NESTED_BRACE       = /[A-Za-z][\w.$]*{/g;
const RE_NESTED_PAREN       = /[A-Za-z][\w.$]*\(/g;
const RE_CLOSE_PAREN_MID    = /\)(?=\s*[,}\]])/g;
const RE_DOUBLE_QUOTE_CSV   = /""([^"]+)""/g;
const RE_NEWLINE_COMMA      = /([}\]"0-9truefalsn])\s*\n\s*(")/g;
const RE_DOUBLE_SQ          = /([^=])''([,}])/g;
const RE_ARRAY_IN_SQ        = /(\w+)='\[(.+)]'(?=\s*[,}])/gs;
const RE_UNCLOSED_SQ_ARRAY  = /=\['([^'[\]]*)\](?=\s*[,}])/g;
const RE_UNCLOSED_SQ_1      = /='([^']*)(?=,\s*\w+=')/g;
const RE_UNCLOSED_SQ_2      = /='([^'=,}]*)(?=,\s*\w+=)/g;
const RE_LEADING_COMMA      = /{\s*,\s*/g;
const RE_MISSING_COMMA_SQ   = /'([^']*)'(\s*)(\w+=)/g;
const RE_SINGLE_QUOTED      = /'(.*?)'(?=\s*[,}\]])/g;
const RE_KEY_EQUALS         = /(?<!["\w])[A-Za-z_]\w*=/g;
const RE_KEY_COLON          = /(?<!["\w])[A-Za-z_]\w*\s*:/g;
const RE_SCALAR_MULTI       = /"([^"]+)":\s*((?:[^"[{,\]}\n]+,\s*)+[^"[{,\]}\n]+)(?=\s*,\s*")/g;
const RE_DATETIME_VAL       = /:\s*([A-Za-z][\w :]+)(?=\s*[,}])/g;
const RE_LEADING_ZERO_VAL   = /:\s*0\w[\w\s]*?(?=\s*[,}])/g;
const RE_SPACED_VAL         = /:\s*\w[\w-]*(?:\s+\w[\w-]*)*(?=\s*[,}])/g;
const RE_EMPTY_VAL          = /:\s*(?=[,}\]])/g;
const RE_CATCHALL_VAL       = /:\s*([^",[{\]}\s][^",[{\]}\n]*)(?=\s*[,}])/g;
const RE_UNQUOTED_STR       = /:\s*([A-Za-z\u3000-\u9FFF][\w\u3000-\u9FFF-]*)(?=\s*[,}])/g;
const RE_INNER_ARRAY        = /\[([^[\]]*)\]/g;
const RE_TEXT_BRACKET_ARRAY = /\[([A-Za-z　-鿿][^[\]]*\[\d+\][^[\]]*)\]/g;
const RE_TRAILING_COMMA     = /,\s*([}\]])/g;
const RE_WHITESPACE         = /[\t\r\n]+/g;
const RE_COMMA_SPACES       = /\s*,\s*/g;
const RE_TEMPLATE_VAR       = /\{\$[^}]*\}}?/g;
const RE_URL_VALUE          = /https?:\/\/[^\s'"`,\]]+/g;
const RE_TAB_IN_ARRAY       = /\[([^\][\n]*\t[^\][\n]*)\]/g;
const RE_DOUBLE_COMMA       = /,(\s*),/g;
const RE_JANCODES_ARRAY     = /\bjanCodes=\[([\s\S]*?)](?=\s*,\s*[a-zA-Z])/g;
const RE_JAN_SQ_FIELD       = /\bjan='([\d ,\t\r\n]+)'(?=\s*[,}])/g;
const RE_CTRL_CHARS         = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Chuẩn hóa nội dung mảng janCodes thành chuỗi JSON hợp lệ.
 * Nếu là danh sách số → giữ nguyên; nếu là text → bọc thành ["text"].
 */
function normalizeArrayContent(content) {
  const t = content.trim();
  if (!t) return '[]';
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(t)) return '[]';   // binary/junk
  // Strip trailing extra ] before checking (handles [val]])
  const stripped = t.replace(/]+$/, '');
  const checkStr = stripped || t;
  const parts = checkStr.split(/[,\n\t]+/).map(v => v.trim()).filter(Boolean);
  if (parts.length > 0 && parts.every(p => /^\d+$/.test(p))) {
    return '[' + parts.join(', ') + ']';
  }
  // Arbitrary text: escape and quote as a single string element.
  // Use ' JSON escape for ' so RE_SINGLE_QUOTED won't mistake it as a delimiter.
  const safe = t
    .replaceAll('\\', '\\\\')
    .replaceAll('"', String.raw`\"`)
    .replaceAll("'", String.raw`\u0027`)
    .replaceAll('\t', String.raw`\t`)
    .replaceAll('\n', String.raw`\n`)
    .replaceAll('\r', String.raw`\r`)
    .replaceAll(RE_CTRL_CHARS, c => String.raw`\u` + c.codePointAt(0).toString(16).padStart(4, '0'));
  return '["' + safe + '"]';
}

/** key= hoặc key: -> "key": */
function extractKey(match) {
  return '"' + match.replace(/[=:\s]+$/, '') + '":';
}

/** Quote phần tử chưa có quote trong array — tách ra ngoài tránh S2004 */
function quoteArrayElements(match, content) {
  if (content.includes('{') || content.includes('[')) return match;
  if (!content.trim()) return '[]';
  const fixed = content.split(/,\s*/).map(function(p) {
    const t = p.trim();
    if (!t) return 'null';
    if (t.startsWith('"') || t === 'null' || t === 'true' || t === 'false') return t;
    if (RE_IS_VALID_NUMBER.test(t) || t === '0') return t;
    return '"' + t + '"';
  });
  return '[' + fixed.join(', ') + ']';
}

/** Wrap scalar value: số/literal giữ nguyên, string bọc double-quote */
function wrapScalarValue(raw) {
  const v = raw.trim();
  if (v === 'null' || v === 'true' || v === 'false') return ':' + v;
  if (RE_IS_FULL_NUMBER.test(v)) return ':' + v;
  if (v.startsWith('"')) return ':' + v;
  return ':"' + v + '"';
}

/** Datetime/text value -> JSON string, giữ nguyên số và literal */
function wrapDatetimeVal(match, val) {
  const v = val.trim();
  if (v === 'null' || v === 'true' || v === 'false') return ':' + v;
  if (RE_IS_ONLY_DIGITS.test(v)) return ':' + v;
  return ':"' + v + '"';
}

/** Scalar multi-value -> JSON array */
function wrapScalarMulti(match, key, vals) {
  if (!vals.includes(',')) return match;
  const parts = vals.split(',').map(function(v) {
    const val = v.trim();
    if (!val) return null;
    if (RE_IS_VALID_NUMBER.test(val) || val === '0') return val;
    if (val === 'null' || val === 'true' || val === 'false') return val;
    if (val.startsWith('"')) return val;
    return '"' + val + '"';
  }).filter(function(val) { return val !== null; });
  return '"' + key + '":[' + parts.join(', ') + ']';
}

/**
 * Xử lý JAN code list: [c1,c2,...]<sortBy><descending>
 * @returns {string|null} JSON string nếu khớp, null nếu không
 */
function tryParseJanList(s) {
  const m = s.match(RE_JAN_LIST);
  if (!m) return null;
  const codes = m[1].split(',').map(function(v) {
    const t = v.trim();
    return RE_IS_INTEGER.test(t) ? Number.parseInt(t, 10) : JSON.stringify(t);
  });
  return (
    '{"janCodes":[' + codes.join(',') +
    '],"sortBy":' + Number.parseInt(m[2], 10) +
    ',"descending":' + m[3] + '}'
  );
}

/**
 * Loại bỏ tiền tố tên class Java/Kotlin và chuẩn hóa class lồng nhau.
 * Person{...} -> {...}  |  Address{city=Hanoi} -> {city=Hanoi}
 */
function normalizeClassPrefixes(s) {
  let result = s.replace(RE_CLASS_PREFIX_BRACE, () => '{');

  if (RE_CLASS_PREFIX_SQ.test(result)) {
    result = result.replace(RE_CLASS_PREFIX_SQ, () => '{');
    if (result.endsWith(']')) result = result.slice(0, -1) + '}';
  }

  const outerParen = result.match(RE_OUTER_PAREN);
  if (outerParen) result = '{' + outerParen[1] + '}';

  let prev;
  do {
    prev = result;
    result = result.replaceAll(RE_NESTED_BRACE,    () => '{');
    result = result.replaceAll(RE_NESTED_PAREN,    () => '{');
    result = result.replaceAll(RE_CLOSE_PAREN_MID, () => '}');
    result = result.replace(   RE_CLOSE_PAREN_END, () => '}');
  } while (result !== prev);

  return result;
}

/**
 * Sửa single-quote chưa đóng: ='val, next= -> ='val', next=
 */
function fixUnclosedSingleQuotes(s) {
  let prev1;
  do {
    prev1 = s;
    s = s.replaceAll(RE_UNCLOSED_SQ_1, (_, v) => "='" + v + "'");
  } while (s !== prev1);

  let prev2;
  do {
    prev2 = s;
    s = s.replaceAll(RE_UNCLOSED_SQ_2, (_, v) => "='" + v + "'");
  } while (s !== prev2);

  return s.replace(RE_UNCLOSED_SQ_END, (_, v) => "='" + v + "'}");
}

/**
 * Bổ sung dấu } bị thiếu ở cuối chuỗi bị truncate.
 * S4138: dùng for...of
 */
function fixTruncatedBraces(s) {
  const t = s.trim();
  if (!t.startsWith('{') || t.endsWith('}')) return s;
  let depth = 0;
  for (const ch of t) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  return depth > 0 ? t + '}'.repeat(depth) : s;
}

/**
 * Bước 6 & 7: xử lý giá trị leading-zero và giá trị có khoảng trắng bên trong.
 */
function wrapLeadingZeroOrSpacedVal(match) {
  const v = match.replace(RE_STRIP_COLON_PREFIX, '').trim();
  if (v === 'null' || v === 'true' || v === 'false') return ':' + v;
  if (RE_IS_VALID_NUMBER.test(v) || v === '0') return ':' + v;
  return ':"' + v + '"';
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function normalizeToJson(INPUT) {
  if (!INPUT || INPUT.trim() === '') return null;          // +1 (if) +1 (||)
  let s = INPUT.trim();

  const janResult = tryParseJanList(s);                   // complexity moved to helper
  if (janResult) return janResult;                        // +1

  if (RE_JUNK_BRACKET.test(s)) return null;               // +1
  if (RE_JUNK_BRACKET_Q.test(s)) return null;             // +1

  s = s.replaceAll(RE_TEMPLATE_VAR, '');
  s = s.replaceAll(RE_DOUBLE_COMMA, ',$1');

  // Bảo vệ URL khỏi bị key-extraction regex xử lý nhầm
  const urlStore = [];
  s = s.replaceAll(RE_URL_VALUE, (url) => {
    urlStore.push(url);
    return '__URL' + (urlStore.length - 1) + '__';
  });

  s = normalizeClassPrefixes(s);                          // complexity moved to helper

  // ─── BƯỚC 1b & 1c: Sửa CSV và newline ────────────────────────────────────
  s = s.replaceAll(RE_DOUBLE_QUOTE_CSV, (_, inner) => '"' + inner + '"');
  s = s.replaceAll(RE_NEWLINE_COMMA,    (_, a, b)  => a + ',\n' + b);

  // ─── Sửa lỗi đặc biệt ────────────────────────────────────────────────────
  // Chuẩn hóa janCodes=[text] trước RE_TAB_IN_ARRAY và RE_SINGLE_QUOTED,
  // tránh dấu ' hoặc \t trong nội dung mảng bị xử lý nhầm.
  s = s.replaceAll(RE_JANCODES_ARRAY, (_, c) => 'janCodes=' + normalizeArrayContent(c));

  // jan='digit1,\ndigit2,...' — single-quoted multiline JAN list (RE_SINGLE_QUOTED can't cross \n)
  s = s.replaceAll(RE_JAN_SQ_FIELD, (_, content) => {
    const codes = content.split(/[\s,]+/).map(v => v.trim()).filter(v => /^\d+$/.test(v));
    return 'jan=[' + codes.join(', ') + ']';
  });

  s = s.replaceAll(RE_TAB_IN_ARRAY, (_, content) =>
    '["' + content.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`).replaceAll('\t', String.raw`\t`) + '"]'
  );
  s = s.replaceAll("=null'", '=null');
  s = s.replaceAll(RE_DOUBLE_SQ,         (_, a, b) => a + "'" + b);
  s = s.replaceAll(RE_UNCLOSED_SQ_ARRAY, (_, v)    => '=[' + v + ']');
  s = s.replaceAll(RE_ARRAY_IN_SQ,       (_, k, v) => '"' + k + '":[' + v + ']');
  s = s.replaceAll("]'", ']');

  s = fixUnclosedSingleQuotes(s);                         // complexity moved to helper
  s = fixTruncatedBraces(s);                              // complexity moved to helper

  s = s.replaceAll(RE_LEADING_COMMA,    () => '{');
  s = s.replaceAll(RE_MISSING_COMMA_SQ, (_, v, sp, k) => "'" + v + "'," + sp + k);

  // ─── BƯỚC 2 & 3: Single-quote -> double-quote ────────────────────────────
  s = s.replaceAll(RE_SINGLE_QUOTED, (_, inner) =>
    "'" + inner.replaceAll(RE_WHITESPACE, () => '').replaceAll(RE_COMMA_SPACES, () => ',').trim() + "'"
  );
  s = s.replaceAll(RE_SINGLE_QUOTED, (_, v) => '"' + v
    .replaceAll('\\', '\\\\')
    .replaceAll('"', String.raw`\"`)
    .replaceAll(RE_CTRL_CHARS, c => String.raw`\u` + c.codePointAt(0).toString(16).padStart(4, '0'))
    + '"');

  // Bảo vệ các chuỗi đã được double-quote khỏi bị value-norm xử lý nhầm bên trong
  const qvStore = [];
  s = s.replaceAll(/"(?:[^"\\]|\\.)*"/g, (str) => {
    qvStore.push(str);
    return '"__QV' + (qvStore.length - 1) + '__"';
  });

  // ─── BƯỚC 4: Quote key ───────────────────────────────────────────────────
  s = s.replaceAll(RE_KEY_EQUALS, extractKey);
  s = s.replaceAll(RE_KEY_COLON,  extractKey);

  // ─── BƯỚC 5 - 9: Chuẩn hóa giá trị ──────────────────────────────────────
  s = s.replaceAll(RE_SCALAR_MULTI,     wrapScalarMulti);
  s = s.replaceAll(RE_DATETIME_VAL,     wrapDatetimeVal);
  s = s.replaceAll(RE_LEADING_ZERO_VAL, wrapLeadingZeroOrSpacedVal);
  s = s.replaceAll(RE_SPACED_VAL,       wrapLeadingZeroOrSpacedVal);
  s = s.replaceAll(RE_EMPTY_VAL,        () => ':null');
  s = s.replaceAll(RE_CATCHALL_VAL,     (_, val) => wrapScalarValue(val));
  s = s.replaceAll(RE_UNQUOTED_STR,     (_, val) => {
    if (val === 'null' || val === 'true' || val === 'false') return ':' + val;  // +1
    return ':"' + val + '"';
  });

  // ─── BƯỚC 10: Quote array elements ───────────────────────────────────────
  let prevArray;
  do {                                                    // +1 (do-while)
    prevArray = s;
    s = s.replaceAll(RE_INNER_ARRAY, quoteArrayElements);
    s = s.replaceAll(RE_TEXT_BRACKET_ARRAY, (_, v) => '["' + v + '"]');
  } while (s !== prevArray);

  s = s.replaceAll(RE_TRAILING_COMMA, (_, bracket) => bracket);

  // Restore chuỗi đã được bảo vệ
  qvStore.forEach((str, i) => {
    s = s.replaceAll('"__QV' + i + '__"', () => str);
  });

  // Restore URLs (đã được quote vào chuỗi JSON bởi các bước trên)
  urlStore.forEach((url, i) => {
    s = s.replaceAll('__URL' + i + '__', url.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`));
  });

  // ─── BƯỚC 11: Validate ───────────────────────────────────────────────────
  try {                                                   // +1 (catch)
    JSON.parse(s);
    return s;
  } catch {
    return null;
  }
}
