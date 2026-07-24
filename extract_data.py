import sys, pdfplumber, re, json

sys.stdout.reconfigure(encoding='utf-8')

def parse_weeks(w_str):
    weeks = set()
    clean = re.sub(r'[周\s]', '', w_str)
    is_odd = '(单)' in clean
    is_even = '(双)' in clean
    clean = clean.replace('(单)', '').replace('(双)', '')
    
    parts = clean.split(',')
    for part in parts:
        part = part.strip()
        if not part: continue
        if '-' in part:
            try:
                start, end = map(int, part.split('-'))
                for w in range(start, end + 1):
                    if is_odd and w % 2 == 0: continue
                    if is_even and w % 2 != 0: continue
                    weeks.add(w)
            except:
                pass
        else:
            try:
                w = int(part)
                weeks.add(w)
            except:
                pass
    return sorted(list(weeks))

def parse_sections(sec_str):
    clean = re.sub(r'[节\s]', '', sec_str)
    if '-' in clean:
        parts = clean.split('-')
        try:
            return int(parts[0]), int(parts[1])
        except:
            return 1, 2
    else:
        try:
            s = int(clean)
            return s, s
        except:
            return 1, 2

def clean_text_field(t):
    if not t: return ''
    t = t.replace('\r', '').replace('\n', '')
    return re.sub(r'\s+', ' ', t).strip()

def preprocess_cell_text(t):
    if not t: return ''
    t = t.replace('\r\n', '\n')
    t = re.sub(r'校\n+区', '校区', t)
    t = re.sub(r'场\n+地', '场地', t)
    t = re.sub(r'教\n+师', '教师', t)
    t = re.sub(r'教学\n+班', '教学班', t)
    t = re.sub(r'总学\n+时', '总学时', t)
    t = re.sub(r'学\n+分', '学分', t)
    t = re.sub(r'(\d+)\-\n+(\d+)', r'\1-\2', t)
    lines = [l.strip() for l in t.split('\n') if l.strip()]
    return ' '.join(lines)

def parse_cell(cell_text, day_idx, default_sec):
    text = preprocess_cell_text(cell_text)
    if not text:
        return []
    
    sec_matches = list(re.finditer(r'\(([\d\-,\s]+节)\)', text))
    if not sec_matches:
        clean_name = clean_text_field(text)
        return [{
            'name': clean_name,
            'day': day_idx,
            'day_name': ['星期一','星期二','星期三','星期四','星期五','星期六','星期日'][day_idx-1],
            'start_section': default_sec,
            'end_section': default_sec + 1 if default_sec in [1,3,6,8,10] else default_sec,
            'sections_raw': f'{default_sec}节',
            'weeks_raw': '全学期',
            'weeks': list(range(1, 21)),
            'campus': '',
            'location': '',
            'teacher': '',
            'code': '',
            'hours': '',
            'credit': ''
        }]
    
    entries_str = []
    for idx, match in enumerate(sec_matches):
        start_idx = 0 if idx == 0 else sec_matches[idx-1].end()
        if idx < len(sec_matches) - 1:
            next_sec_start = sec_matches[idx+1].start()
            title_match = re.search(r'([^\/\s\(\)]+[\w\s\(\)（）\+\-\.]*?)$', text[start_idx:next_sec_start])
            if title_match:
                title_start = start_idx + title_match.start()
                entry_str = text[start_idx:title_start]
                entries_str.append(entry_str)
                start_idx = title_start
            else:
                entries_str.append(text[start_idx:next_sec_start])
        else:
            entries_str.append(text[start_idx:])
            
    courses = []
    for es in entries_str:
        if not es.strip(): continue
        sec_m = re.search(r'\(([\d\-,\s]+节)\)', es)
        if not sec_m:
            continue
        
        name = es[:sec_m.start()].strip()
        name = re.sub(r'^.*?学分:\s*[\d\.]+\s*', '', name)
        name = re.sub(r'^[\d\.]+\s*', '', name).strip()
        
        sec_raw = sec_m.group(1).strip()
        start_sec, end_sec = parse_sections(sec_raw)
        
        after_sec = es[sec_m.end():].strip()
        parts = after_sec.split('/')
        weeks_raw = parts[0].strip() if parts else ''
        weeks = parse_weeks(weeks_raw)
        
        kv = {'campus': '', 'location': '', 'teacher': '', 'code': '', 'hours': '', 'credit': ''}
        for p in parts[1:]:
            p = p.strip()
            if p.startswith('校区:'): kv['campus'] = clean_text_field(p[3:])
            elif p.startswith('场地:'): kv['location'] = clean_text_field(p[3:])
            elif p.startswith('教师:'): kv['teacher'] = clean_text_field(p[3:])
            elif p.startswith('教学班:'): kv['code'] = clean_text_field(p[4:])
            elif p.startswith('总学时:'): kv['hours'] = clean_text_field(p[4:])
            elif p.startswith('学分:'): kv['credit'] = clean_text_field(p[3:])
            
        courses.append({
            'name': name,
            'day': day_idx,
            'day_name': ['星期一','星期二','星期三','星期四','星期五','星期六','星期日'][day_idx-1],
            'start_section': start_sec,
            'end_section': end_sec,
            'sections_raw': sec_raw,
            'weeks_raw': weeks_raw,
            'weeks': weeks,
            **kv
        })
    return courses

all_classes = []

for fname in ['班级课表.pdf', '班级课表 (1)(2).pdf']:
    print(f'Processing {fname}...')
    with pdfplumber.open(fname) as pdf:
        i = 0
        while i < len(pdf.pages):
            page = pdf.pages[i]
            table = page.extract_table()
            text = page.extract_text() or ''
            
            title, major = '', ''
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            for l in lines[:4]:
                if '课表' in l and ('2025' in l or '25(' in l or '预科' in l or '城' in l or '法' in l or '文' in l or '美' in l or '商' in l or '数' in l or '物' in l or '生' in l or '信' in l or '药' in l or '音' in l or '体' in l or '马' in l or '教' in l or '湿' in l or '碳' in l or '历' in l):
                    title = l
                if '专业：' in l or '专业:' in l:
                    major = l.split('专业：')[-1].split('专业:')[-1].strip()
            
            if title and major:
                class_pages = [page]
                j = i + 1
                while j < len(pdf.pages):
                    p_text = pdf.pages[j].extract_text() or ''
                    p_lines = [l.strip() for l in p_text.split('\n') if l.strip()]
                    has_next_title = False
                    for l in p_lines[:4]:
                        if '课表' in l and ('专业：' in p_text or '专业:' in p_text):
                            has_next_title = True
                            break
                    if has_next_title:
                        break
                    class_pages.append(pdf.pages[j])
                    j += 1
                
                courses_list = []
                other_courses_list = []
                
                for cp in class_pages:
                    cp_table = cp.extract_table()
                    cp_text = cp.extract_text() or ''
                    
                    if cp_table and len(cp_table) >= 3:
                        for row in cp_table[2:]:
                            if not row or len(row) < 9: continue
                            sec_str = row[1]
                            try:
                                sec_num = int(sec_str) if sec_str and sec_str.isdigit() else 1
                            except:
                                sec_num = 1
                            
                            for day_idx in range(1, 8):
                                cell_val = row[day_idx + 1]
                                if cell_val and cell_val.strip():
                                    cell_c = parse_cell(cell_val, day_idx, sec_num)
                                    courses_list.extend(cell_c)
                    
                    for line in cp_text.split('\n'):
                        if '其他课程' in line or '未排地点' in line:
                            other_courses_list.append(clean_text_field(line))
                
                all_classes.append({
                    'title': title,
                    'major': major,
                    'file': fname,
                    'courses': courses_list,
                    'other_courses': other_courses_list
                })
                
                i = j
            else:
                i += 1

# Group by major
major_map = {}
for item in all_classes:
    m = item['major']
    if m not in major_map:
        major_map[m] = []
    major_map[m].append(item)

structured_data = []
class_id_counter = 1

for m_name, c_list in major_map.items():
    c_list.sort(key=lambda x: x['title'])
    classes_data = []
    for idx, c in enumerate(c_list, 1):
        class_name_short = f'{idx}班'
        match_num = re.search(r'\((\d+)\)', c['title'])
        if match_num:
            class_name_short = f"{match_num.group(1)}班"
            
        classes_data.append({
            'id': f'cls_{class_id_counter}',
            'class_name': c['title'].replace('课表', ''),
            'full_title': c['title'],
            'class_num': class_name_short,
            'courses': c['courses'],
            'other_courses': c['other_courses']
        })
        class_id_counter += 1
        
    structured_data.append({
        'major': m_name,
        'class_count': len(classes_data),
        'classes': classes_data
    })

with open('schedule_data.json', 'w', encoding='utf-8') as f:
    json.dump(structured_data, f, ensure_ascii=False, indent=2)

print('Saved schedule_data.json successfully with full fields!')
