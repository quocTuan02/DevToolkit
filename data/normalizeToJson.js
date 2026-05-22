/**
 * normalizeToJson(INPUT)
 *
 * Chuyển đổi một chuỗi "object lỏng lẻo" (non-standard) sang chuỗi JSON hợp lệ.
 *
 * Hỗ trợ các định dạng đầu vào:
 *  - Java/Kotlin toString():   Person{name=John, age=30}
 *  - Single-quoted values:     {name='John', age=30}
 *  - Unquoted keys/values:     {name: John, age: 30}
 *  - JAN code list format:     [4910024340432, 4910024340524]0true
 *  - Chuỗi bị truncate (thiếu dấu đóng ngoặc)
 *  - Nhiều lỗi nhỏ khác: dấu phẩy thừa, ngoặc không khớp, v.v.
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
const RE_UNCLOSED_SQ_1      = /='([^']*)(?=,\s*\w+=')/g;
const RE_UNCLOSED_SQ_2      = /='([^'=,}]*)(?=,\s*\w+=)/g;
const RE_LEADING_COMMA      = /{\s*,\s*/g;
const RE_MISSING_COMMA_SQ   = /'([^']*)'(\s*)(\w+=)/g;
const RE_SINGLE_QUOTED      = /'([^']*)'/g;
const RE_KEY_EQUALS         = /(?<!["\w])[A-Za-z_]\w*=/g;
const RE_KEY_COLON          = /(?<!["\w])[A-Za-z_]\w*\s*:/g;
const RE_SCALAR_MULTI       = /"([^"]+)":\s*((?:[^"[{,\]}\n]+,\s*)+[^"[{,\]}\n]+)(?=\s*,\s*")/g;
const RE_DATETIME_VAL       = /:\s*([A-Za-z][\w :]+)(?=\s*[,}])/g;
const RE_LEADING_ZERO_VAL   = /:\s*0\w[\w\s]*?(?=\s*[,}])/g;
const RE_SPACED_VAL         = /:\s*\w[\w-]*(?:\s+\w[\w-]*)*(?=\s*[,}])/g;
const RE_EMPTY_VAL          = /:\s*(?=[,}\]])/g;
const RE_CATCHALL_VAL       = /:\s*([^",[{\]}\s][^",[{\]}\n]*)(?=\s*[,}])/g;
const RE_UNQUOTED_STR       = /:\s*([A-Za-z\u3000-\u9FFF][\w\u3000-\u9FFF-]*)/g;
const RE_INNER_ARRAY        = /\[([^[\]]*)\]/g;
const RE_TRAILING_COMMA     = /,\s*([}\]])/g;
const RE_WHITESPACE         = /[\t\r\n]+/g;
const RE_COMMA_SPACES       = /\s*,\s*/g;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** key= hoặc key: -> "key": */
function extractKey(match) {
  return '"' + match.replace(/[=:\s]+$/, '') + '":';
}

/** Quote phần tử chưa có quote trong array — tách ra ngoài tránh S2004 */
function quoteArrayElements(match, content) {
  if (content.includes('{') || content.includes('[')) return match;
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

  s = normalizeClassPrefixes(s);                          // complexity moved to helper

  // ─── BƯỚC 1b & 1c: Sửa CSV và newline ────────────────────────────────────
  s = s.replaceAll(RE_DOUBLE_QUOTE_CSV, (_, inner) => '"' + inner + '"');
  s = s.replaceAll(RE_NEWLINE_COMMA,    (_, a, b)  => a + ',\n' + b);

  // ─── Sửa lỗi đặc biệt ────────────────────────────────────────────────────
  s = s.replaceAll("=null'", '=null');
  s = s.replaceAll(RE_DOUBLE_SQ,    (_, a, b)    => a + "'" + b);
  s = s.replaceAll(RE_ARRAY_IN_SQ,  (_, k, v)   => '"' + k + '":[' + v + ']');
  s = s.replaceAll("]'", ']');

  s = fixUnclosedSingleQuotes(s);                         // complexity moved to helper
  s = fixTruncatedBraces(s);                              // complexity moved to helper

  s = s.replaceAll(RE_LEADING_COMMA,    () => '{');
  s = s.replaceAll(RE_MISSING_COMMA_SQ, (_, v, sp, k) => "'" + v + "'," + sp + k);

  // ─── BƯỚC 2 & 3: Single-quote -> double-quote ────────────────────────────
  s = s.replaceAll(RE_SINGLE_QUOTED, (_, inner) =>
    "'" + inner.replaceAll(RE_WHITESPACE, () => '').replaceAll(RE_COMMA_SPACES, () => ',').trim() + "'"
  );
  s = s.replaceAll(RE_SINGLE_QUOTED, (_, v) => '"' + v + '"');

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
  } while (s !== prevArray);

  s = s.replaceAll(RE_TRAILING_COMMA, (_, bracket) => bracket);

  // ─── BƯỚC 11: Validate ───────────────────────────────────────────────────
  try {                                                   // +1 (catch)
    JSON.parse(s);
    return s;
  } catch {
    return null;
  }
}
