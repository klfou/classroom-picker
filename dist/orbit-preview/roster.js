export const ROSTER_LIMITS = Object.freeze({ rows: 16, columns: 8, seats: 128 });
const ALIASES = { 行: 'row', row: 'row', 列: 'col', col: 'col', column: 'col', 姓名: 'name', name: 'name', 性别: 'gender', gender: 'gender', sex: 'gender' };
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const blank = value => value == null || (typeof value === 'string' && value.trim() === '');
const cleanKey = value => String(value ?? '').replace(/^\uFEFF/, '').trim().toLowerCase();
const error = message => { throw new Error(message); };

function coordinate(value, label, maximum, sourceRow) {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d+(?:\.0+)?$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isInteger(number) || number < 1 || number > maximum) error(`第 ${sourceRow} 条记录的“${label}”必须是 1–${maximum} 的整数。`);
  return number;
}

// Missing gender remains unknown; legacy artwork is a display fallback only.
export function normalizeGender(value, sourceRow='') {
  if (blank(value)) return '';
  const key=typeof value==='string'?value.trim().toLowerCase():'';
  if (['男','male','boy','m'].includes(key)) return 'male';
  if (['女','female','girl','f'].includes(key)) return 'female';
  error(`第 ${sourceRow} 条记录的“性别”请填写“男”或“女”，暂不设置可留空。`);
}
export function studentModelKind(seat,index) {
  return seat.gender==='female'?'girl':seat.gender==='male'?'boy':index%3===1||index%4===2?'girl':'boy';
}

/**
 * Validate saved or edited seat records ({row,col,name,gender}).
 * Coordinates are 1-based: row 1 is nearest the board; column 1 is the teacher's
 * left when standing at the board and facing the class. Omitted seats stay empty.
 * Does not mutate input. Names must be rendered with textContent / canvas text.
 */
export function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.length) error('名单为空，请填写至少一个座位。');
  const warnings = [];
  const records = rows.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) error(`第 ${index + 1} 条记录格式不正确。`);
      const record = { sourceRow: index + 1, ...(typeof item.id==='string'?{id:item.id}:{}) };
      for (const [key, value] of Object.entries(item)) {
        const field = own(ALIASES, cleanKey(key)) ? ALIASES[cleanKey(key)] : null;
        if (!field) continue;
        if (own(record, field)) error(`第 ${index + 1} 条记录的“${key}”重复。`);
        record[field] = value;
      }
      return record;
    });
  const seats = [];
  const positions = new Set();
  const names = new Set();
  let repeatedNames = false;
  let cleanedWhitespace = false;
  for (const item of records) {
    if ([item.row, item.col, item.name].every(blank)) continue;
    const row = coordinate(item.row, '行', ROSTER_LIMITS.rows, item.sourceRow);
    const col = coordinate(item.col, '列', ROSTER_LIMITS.columns, item.sourceRow);
    if (blank(item.name)) error(`第 ${item.sourceRow} 条记录（第 ${row} 行第 ${col} 列）缺少姓名，请检查座位名单。`);
    if (typeof item.name !== 'string') error(`第 ${item.sourceRow} 条记录的姓名必须是文本。`);
    const name = item.name.trim().replace(/\s+/gu, ' ').normalize('NFC');
    if (name.length > 80) error(`第 ${item.sourceRow} 条记录的姓名超过 80 个字符。`);
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(name)) error(`第 ${item.sourceRow} 条记录的姓名含有无效控制字符。`);
    const position = `${row}:${col}`;
    if (positions.has(position)) error(`座位重复：第 ${row} 行第 ${col} 列有多条记录，请修改后重试。`);
    positions.add(position);
    if (names.has(name)) repeatedNames = true;
    names.add(name);
    if (name !== item.name) cleanedWhitespace = true;
    const gender = normalizeGender(item.gender, item.sourceRow);
    seats.push({ row, col, name, ...(gender ? {gender} : {}), ...(item.id?{id:item.id}:{}) });
    if (seats.length > ROSTER_LIMITS.seats) error('最多支持 128 个学生座位。');
  }
  if (!seats.length) error('没有找到学生记录，请填写至少一个座位。');
  if (repeatedNames) warnings.push('发现同名学生，已按不同座位分别保留，请核对。');
  if (cleanedWhitespace) warnings.push('已清理姓名前后的空格与换行。');
  seats.sort((a, b) => a.row - b.row || a.col - b.col);
  return { seats, warnings };
}

