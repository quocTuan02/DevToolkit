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
function normalizeToJson(INPUT) {
  // Trả về null ngay nếu input rỗng hoặc chỉ có khoảng trắng
  if (!INPUT || INPUT.trim() === '') return null;
  var s = INPUT.trim();

  // ─── XỬ LÝ ĐẶC BIỆT: JAN Code List ───────────────────────────────────────
  // Format: [jan1, jan2, ...]<sortBy><descending>
  // Ví dụ:  [4910024340432, 4910024340524]0true
  //      -> {"janCodes":[4910024340432,...], "sortBy":0, "descending":true}
  var janListMatch = s.match(/^\[([^\]]+)\](\d+)(true|false)$/);
  if (janListMatch) {
    var codes = janListMatch[1].split(',').map(function(v) {
      v = v.trim();
      // Nếu là số nguyên thì giữ nguyên, ngược lại bọc trong JSON string
      return /^\d+$/.test(v) ? parseInt(v) : JSON.stringify(v);
    });
    return '{"janCodes":[' + codes.join(',') + '],"sortBy":' + parseInt(janListMatch[2]) + ',"descending":' + janListMatch[3] + '}';
  }

  // ─── LOẠI BỎ INPUT RÁC ────────────────────────────────────────────────────
  // Các pattern dạng [...]word không phải JAN list → không thể parse
  if (/^\[[^\]]*\]\w+/.test(s)) return null;
  if (/^'\[[^\]]*\]\w+'$/.test(s)) return null;

  // ─── BƯỚC 0: Loại bỏ tiền tố tên class ───────────────────────────────────
  // Java/Kotlin toString() thường có dạng: ClassName{...} hoặc ClassName(...)
  // Ví dụ: Person{name=John} -> {name=John}
  s = s.replace(/^[A-Za-z][A-Za-z0-9_.$]*\{/, '{');

  // Dạng: ClassName [...] -> {...}
  if (/^[A-Za-z][A-Za-z0-9_.$]*\s+\[/.test(s)) {
    s = s.replace(/^[A-Za-z][A-Za-z0-9_.$]*\s+\[/, '{');
    if (s.endsWith(']')) s = s.slice(0, -1) + '}';
  }

  // Dạng: ClassName(...) -> {...}
  var outerParen = s.match(/^[A-Za-z][A-Za-z0-9_.$]*\((.+)\)$/s);
  if (outerParen) s = '{' + outerParen[1] + '}';

  // ─── BƯỚC 1: Chuẩn hóa class lồng nhau ───────────────────────────────────
  // Xử lý đệ quy các class lồng nhau bên trong object
  // Ví dụ: {address=Address{city=Hanoi}} -> {address={city=Hanoi}}
  // Lặp cho đến khi không còn thay đổi (xử lý nhiều lớp lồng nhau)
  var prev;
  do {
    prev = s;
    s = s.replace(/[A-Za-z][A-Za-z0-9_.$]*\{/g, '{');  // ClassName{ -> {
    s = s.replace(/[A-Za-z][A-Za-z0-9_.$]*\(/g, '{');  // ClassName( -> {
    s = s.replace(/\)(?=\s*[,}\]])/g, '}');             // ) trước , } ] -> }
    s = s.replace(/\)$/, '}');                           // ) cuối chuỗi -> }
  } while (s !== prev);

  // ─── BƯỚC 1b: Sửa double-quote kép trong CSV ──────────────────────────────
  // Ví dụ: ""content"" -> "content"
  s = s.replace(/""([^"]+)""/g, '"$1"');

  // ─── BƯỚC 1c: Thêm dấu phẩy thiếu giữa các field phân tách bằng newline ──
  // Ví dụ: "value"\n"key" -> "value",\n"key"
  s = s.replace(/([}\]"0-9truefalsn])\s*\n\s*(")/g, '$1,\n$2');

  // ─── SỬA LỖI: Các trường hợp đặc biệt ────────────────────────────────────

  // Dấu nháy đơn thừa sau null: =null' -> =null
  s = s.replace(/=null'/g, '=null');

  // Double single-quote sau value: val'' -> val'  (chỉ trước , hoặc })
  s = s.replace(/([^=])''([,}])/g, '$1\'$2');

  // key='[content]' -> key:[content]  (array bị bọc trong single-quote)
  // Phải xử lý TRƯỚC bước loại bỏ ]'
  s = s.replace(/([A-Za-z_][A-Za-z0-9_]*)='\[(.+)\]'(?=\s*[,}])/gs, '"$1":[$2]');

  // Dấu nháy đơn thừa sau đóng array: ]' -> ]
  s = s.replace(/\]'/g, ']');

  // ─── SỬA LỖI: Single-quote chưa đóng ─────────────────────────────────────
  // Ví dụ: dateOfCompany='20230701, nextKey=' -> dateOfCompany='20230701', nextKey='
  // Lặp greedy để xử lý value có dấu phẩy bên trong
  var prevR;
  do {
    prevR = s;
    // Trường hợp 1: theo sau bởi key=' pattern
    s = s.replace(/='([^']*)(?=,\s*[A-Za-z_][A-Za-z0-9_]*=')/g, "='$1'");
  } while (s !== prevR);
  do {
    prevR = s;
    // Trường hợp 2: theo sau bởi key= pattern (không có nháy đơn)
    s = s.replace(/='([^'=,}]*)(?=,\s*[A-Za-z_][A-Za-z0-9_]*=)/g, "='$1'");
  } while (s !== prevR);

  // Single-quote chưa đóng ở cuối object: ='value} -> ='value'}
  s = s.replace(/='([^']*)}$/, "='$1'}");

  // ─── SỬA LỖI: Chuỗi bị truncate (thiếu dấu đóng ngoặc) ──────────────────
  // Đếm độ sâu ngoặc { } và bổ sung } còn thiếu ở cuối
  var t = s.trim();
  if (t.startsWith('{') && !t.endsWith('}')) {
    var depth = 0;
    for (var ci = 0; ci < t.length; ci++) {
      if (t[ci] === '{') depth++;
      else if (t[ci] === '}') depth--;
    }
    if (depth > 0) s = t + '}'.repeat(depth);
  }

  // Dấu phẩy thừa ở đầu object: {, key -> { key
  s = s.replace(/\{\s*,\s*/g, '{');

  // Thiếu dấu phẩy giữa các field: 'val'key= -> 'val', key=
  // Chỉ kích hoạt khi dấu nháy đóng đứng liền trước key= (không có dấu phẩy)
  s = s.replace(/'([^']*)'(\s*)([A-Za-z_][A-Za-z0-9_]*=)/g, "'$1',$2$3");

  // ─── BƯỚC 2: Chuẩn hóa whitespace trong single-quoted values ─────────────
  // Loại bỏ tab, newline; chuẩn hóa khoảng trắng quanh dấu phẩy
  s = s.replace(/'([^']*)'/g, function(_, inner) {
    return "'" + inner.replace(/[\t\r\n]+/g, '').replace(/\s*,\s*/g, ',').trim() + "'";
  });

  // ─── BƯỚC 3: Chuyển single-quote thành double-quote ──────────────────────
  // 'value' -> "value"
  s = s.replace(/'([^']*)'/g, '"$1"');

  // ─── BƯỚC 4: Thêm quote cho key dạng key= ────────────────────────────────
  // Ví dụ: name=John -> "name":John
  s = s.replace(/(?<!["\w])([A-Za-z_][A-Za-z0-9_]*)=/g, '"$1":');

  // Thêm quote cho key dạng key: (chưa có quote)
  // Ví dụ: {type: book} -> {"type": book}
  s = s.replace(/(?<!["\w])([A-Za-z_][A-Za-z0-9_]*)\s*:/g, function(match, key) {
    return '"' + key + '":';
  });

  // ─── BƯỚC 5: Xử lý giá trị scalar nhiều phần tử (trước bước leading-zero) ─
  // Ví dụ: "tags": foo, bar, baz, "next" -> "tags": ["foo", "bar", "baz"], "next"
  s = s.replace(
    /"([^"]+)":\s*((?:[^"\[{,\]}\n]+,\s*)+[^"\[{,\]}\n]+)(?=\s*,\s*")/g,
    function(match, key, vals) {
      if (!vals.includes(',')) return match;
      var parts = vals.split(',').map(function(v) {
        v = v.trim(); if (!v) return null;
        if (/^-?[1-9]\d*(\.\d+)?$/.test(v) || v === '0') return v;      // số
        if (v === 'null' || v === 'true' || v === 'false') return v;      // literal
        if (v.startsWith('"')) return v;                                   // đã có quote
        return '"' + v + '"';                                              // bọc string
      }).filter(function(v) { return v !== null; });
      return '"' + key + '":[' + parts.join(', ') + ']';
    }
  );

  // ─── BƯỚC 6b: Xử lý giá trị datetime (trước bước leading-zero) ───────────
  // Phải xử lý trước để tránh hỏng các thành phần giờ phút giây
  // Ví dụ: currentDate=Thu Apr 27 12:48:04 JST 2023
  //     -> "currentDate":"Thu Apr 27 12:48:04 JST 2023"
  s = s.replace(/:\s*([A-Za-z][A-Za-z0-9 :]+)(?=\s*[,}])/g, function(match, val) {
    val = val.trim();
    if (val === 'null' || val === 'true' || val === 'false') return ':' + val;
    if (/^-?\d+$/.test(val)) return ':' + val;
    return ':"' + val + '"';
  });

  // ─── BƯỚC 6: Xử lý giá trị bắt đầu bằng số 0 ────────────────────────────
  // Các mã có leading zero, hex-style ID phải giữ nguyên dạng string
  // Ví dụ: code=01234 -> "code":"01234"
  s = s.replace(/:\s*(0[A-Za-z0-9][\w\s]*?)(?=\s*[,}])/g, function(m, v) {
    return ':"' + v.trim() + '"';
  });

  // ─── BƯỚC 7: Xử lý giá trị có khoảng trắng bên trong ────────────────────
  // Ví dụ: code=XSC7     1 -> "code":"XSC7 1"
  s = s.replace(
    /:\s*([A-Za-z0-9][A-Za-z0-9_\-]*(?:\s+[A-Za-z0-9][A-Za-z0-9_\-]*)*)(?=\s*[,}])/g,
    function(match, val) {
      val = val.trim();
      if (val === 'null' || val === 'true' || val === 'false') return ':' + val;
      if (/^-?[1-9]\d*(\.\d+)?$/.test(val) || val === '0') return ':' + val; // số hợp lệ
      return ':"' + val + '"';
    }
  );

  // ─── BƯỚC 8: Giá trị rỗng -> null ────────────────────────────────────────
  // Ví dụ: {key:, ...} -> {"key":null, ...}
  s = s.replace(/:\s*(?=[,}\]])/g, ':null');

  // ─── BƯỚC 8b: Catch-all cho giá trị có ký tự đặc biệt (@, ., v.v.) ───────
  // Xử lý email, URL, mã có dấu chấm/gạch ngang mà các bước trước bỏ sót
  // Ví dụ: email=test@example.com -> "email":"test@example.com"
  //        score=99.5             -> "score":99.5  (số thập phân giữ nguyên)
  s = s.replace(/:\s*([^",\[{\]}\s][^",\[{\]}\n]*)(?=\s*[,}])/g, function(match, val) {
    val = val.trim();
    if (val === 'null' || val === 'true' || val === 'false') return ':' + val;
    if (/^-?\d+(\.\d+)?([eE][+\-]?\d+)?$/.test(val)) return ':' + val;
    if (val.startsWith('"')) return ':' + val;
    return ':"' + val + '"';
  });

  // ─── BƯỚC 9: Quote các giá trị string chưa được quote ────────────────────
  // Hỗ trợ cả ký tự Latin lẫn Kanji/Hiragana/Katakana (tiếng Nhật)
  // Ví dụ: type=book -> "type":"book"
  s = s.replace(
    /:\s*([A-Za-z\u3000-\u9FFF\u30A0-\u30FF\u3040-\u309F][A-Za-z0-9\u3000-\u9FFF\u30A0-\u30FF\u3040-\u309F_\-]*)/g,
    function(match, val) {
      if (val === 'null' || val === 'true' || val === 'false') return ':' + val;
      return ':"' + val + '"';
    }
  );

  // ─── BƯỚC 10: Quote các phần tử chưa có quote trong array ────────────────
  // Ví dụ: [foo, bar, 123] -> ["foo", "bar", 123]
  // Bỏ qua array chứa object {} hoặc array lồng nhau []
  function quoteArrayElements(match, content) {
    if (content.indexOf('{') !== -1 || content.indexOf('[') !== -1) return match;
    var parts = content.split(/,\s*/);
    var fixed = parts.map(function(p) {
      p = p.trim();
      if (!p) return 'null';                                               // phần tử rỗng
      if (p.startsWith('"') || p === 'null' || p === 'true' || p === 'false') return p;
      if (/^-?[1-9]\d*(\.\d+)?$/.test(p) || p === '0') return p;         // số
      return '"' + p + '"';                                                // bọc string
    });
    return '[' + fixed.join(', ') + ']';
  }

  // Lặp đệ quy để xử lý array lồng nhau từ trong ra ngoài
  var prev2;
  do {
    prev2 = s;
    s = s.replace(/\[([^\[\]]*)\]/g, quoteArrayElements);
  } while (s !== prev2);

  // ─── BƯỚC 10b: Loại bỏ dấu phẩy thừa trước } hoặc ] ────────────────────
  // Ví dụ: {name=Charlie, age=28,} -> {"name":"Charlie","age":28}
  s = s.replace(/,\s*([}\]])/g, '$1');

  // ─── BƯỚC 11: Validate kết quả cuối cùng ─────────────────────────────────
  // Thử parse JSON — nếu hợp lệ thì trả về, không thì trả về null
  try {
    JSON.parse(s);
    return s;
  } catch(e) {
    return null;
  }
}
