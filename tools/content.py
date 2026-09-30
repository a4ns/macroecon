#!/usr/bin/env python3
"""Build app/data/* (JSON + cleaned HTML fragments) from the classic textbook sources in classic/.

usage: python3 tools/content.py
"""
import json, os, re, shutil, html as htmlmod
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'classic'
DOCS = SRC / 'Docs'
OUT = ROOT / 'app' / 'data'
IMG = ROOT / 'app' / 'img'

def rd(p):
    return Path(p).read_text(encoding='utf-8', errors='replace')

def wj(name, obj):
    p = OUT / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return p

def wt(name, text):
    p = OUT / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8')

# ── project metadata ────────────────────────────────────────────
_s = rd(SRC / 'project.js')
P = json.loads(_s[len('window.PROJECT='):].rstrip().rstrip(';'))
PAGES = P['pages']
FILES = P['files']

def norm_ws(s):
    return re.sub(r'\s+', ' ', (s or '').replace('\xa0', ' ')).strip()

# ── typography ──────────────────────────────────────────────────
CYR = 'А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі'
def typo(s):
    """Russian typography for running text (applied to text nodes only)."""
    s = s.replace('\xa0', ' ')
    s = re.sub(r'[ \t]+', ' ', s)
    # em dash between words / after closing punctuation
    s = re.sub(r'(?<=[%s\)\]»"”\.\,;:!\?%%])\s[-–—]\s(?=[%s\d\(«"“\[])' % (CYR, CYR), ' — ', s)
    # numeric ranges 2005 - 2017 → 2005–2017
    s = re.sub(r'(?<=\d)\s?[-–]\s?(?=\d{2,4}\b)(?=[^ ]*)', lambda m: '–', s) if re.search(r'\b(19|20)\d\d\s?[-–]\s?(19|20)?\d\d\b', s) else s
    # minus in formulas: Latin/digit/paren on both sides
    s = re.sub(r'(?<=[A-Za-z0-9\)\]′\'′])\s-\s(?=[A-Za-z0-9\(\[])', ' − ', s)
    # « » quotes: straight → guillemets when they wrap Cyrillic words
    s = re.sub(r'"([%s][^"]*?)"' % CYR, r'«\1»', s)
    s = s.replace(' ,', ',').replace(' .', '.') if False else s
    return s

# ── inline HTML cleaner ─────────────────────────────────────────
ALLOWED = {'b': 'b', 'strong': 'b', 'i': 'i', 'em': 'i', 'sub': 'sub', 'sup': 'sup', 'u': 'u'}

def inline(node, keep_img=False):
    out = []
    for ch in node.children:
        if isinstance(ch, NavigableString):
            if isinstance(ch, type(ch)) and ch.__class__.__name__ in ('Comment', 'Doctype', 'Declaration'):
                continue
            t = htmlmod.escape(typo(str(ch)), quote=False)
            out.append(t)
        elif isinstance(ch, Tag):
            n = ch.name.lower()
            if n in ALLOWED:
                inner = inline(ch, keep_img)
                if inner.strip():
                    out.append('<%s>%s</%s>' % (ALLOWED[n], inner, ALLOWED[n]))
                else:
                    out.append(inner)
            elif n == 'br':
                out.append('<br>')
            elif n == 'font':
                col = (ch.get('color') or '').lower().strip('#')
                inner = inline(ch, keep_img)
                if col in ('maroon', '800000', '8b0000') and inner.strip():
                    out.append('<span class="hl">%s</span>' % inner)
                else:
                    out.append(inner)
            elif n == 'img' and keep_img:
                out.append('<img src="%s">' % ch.get('src', ''))
            elif n in ('span', 'a', 'small', 'big', 'center', 'div', 'p', 'nobr'):
                out.append(inline(ch, keep_img))
            elif n in ('script', 'style', 'link', 'meta', 'title', 'head'):
                continue
            else:
                out.append(inline(ch, keep_img))
    s = ''.join(out)
    return s

def tidy(s):
    s = re.sub(r'(<br>\s*){3,}', '<br><br>', s)
    s = re.sub(r'^(\s|<br>)+|(\s|<br>)+$', '', s)
    s = re.sub(r'<br>\s+', '<br>', s)
    s = re.sub(r'\s+<br>', '<br>', s)
    s = re.sub(r'[ \t]{2,}', ' ', s)
    s = re.sub(r'\s+([,.;:!?])', r'\1', s)
    s = s.replace('  ', ' ').replace('  ', ' ')
    return s.strip()

def text_of(node):
    return norm_ws(node.get_text(' ', strip=True))

# ── MathML for formulas that were pictures in the original ──────
def MI(x): return '<mi>%s</mi>' % x
def MN(x): return '<mn>%s</mn>' % x
def MO(x): return '<mo>%s</mo>' % x
def BAR(x): return '<mover><mi>%s</mi><mo accent="true">¯</mo></mover>' % x
def SUB(b, s): return '<msub>%s%s</msub>' % (b if b.startswith('<') else MI(b), s if s.startswith('<') else MI(s))
def ROW(*a): return '<mrow>%s</mrow>' % ''.join(a)
def FRAC(a, b): return '<mfrac>%s%s</mfrac>' % (a, b)
def MT(x): return '<mtext>%s</mtext>' % x
def math(body, label):
    return '<div class="eq" role="math" aria-label="%s"><math display="block" xmlns="http://www.w3.org/1998/Math/MathML">%s</math></div>' % (htmlmod.escape(label), body)

MPC = '<mi>mpc</mi>'
def paren(x): return MO('(') + x + MO(')')
FORMULAS = {
    'image3_1_1.jpg': math(ROW(MI('g'), MO('='), '<mroot>' + FRAC(SUB('Y', 't'), SUB('Y', '0')) + MI('T') + '</mroot>', MO('−'), MN('1'), MO(',')), 'g = корень T-й степени из Y_t / Y_0 минус 1'),
    'image6_3_1.jpg': math(ROW(MI('Y'), MO('='), BAR('C'), MO('+'), BAR('I'), MO('+'), BAR('G')), 'Y = C + I + G'),
    'image6_3_2.jpg': math(ROW(MI('C'), MO('='), BAR('C'), MO('+'), MPC, MO('⋅'), MI('Y'), MO(',')), 'C = C̄ + mpc·Y'),
    'image6_3_3.jpg': math(ROW(MI('Y'), MO('='), BAR('C'), MO('+'), MPC, MO('⋅'), MI('Y'), MO('+'), BAR('I'), MO('+'), BAR('G'), MO(',')), 'Y = C̄ + mpc·Y + Ī + Ḡ'),
    'image6_3_4.jpg': math('<mtable columnalign="left" rowspacing="1em"><mtr><mtd>' + ROW(MI('Y'), MO('='), FRAC(MN('1'), ROW(MN('1'), MO('−'), MPC)), paren(ROW(BAR('C'), MO('+'), BAR('I'), MO('+'), BAR('G'))), MO(',')) + '</mtd></mtr><mtr><mtd>' + ROW(MO('Δ'), MI('Y'), MO('='), FRAC(MN('1'), ROW(MN('1'), MO('−'), MPC)), MO('⋅'), paren(ROW(MO('Δ'), BAR('C'), MO('+'), MO('Δ'), BAR('I'), MO('+'), MO('Δ'), BAR('G'))), MO('.')) + '</mtd></mtr></mtable>', 'Y = (C + I + G) / (1 − mpc); ΔY = (ΔC + ΔI + ΔG) / (1 − mpc)'),
    'image6_3_5.jpg': math(ROW(MI('C'), MO('='), BAR('C'), MO('+'), MPC, paren(ROW(MI('Y'), MO('−'), BAR('T')))), 'C = C̄ + mpc (Y − T̄)'),
    'image6_3_6.jpg': math(ROW(MI('C'), MO('='), BAR('C'), MO('+'), MPC, paren(ROW(MI('Y'), MO('−'), MI('T')))), 'C = C̄ + mpc (Y − T)'),
    'image6_3_7.jpg': math(ROW(MI('Y'), MO('='), BAR('C'), MO('+'), MPC, paren(ROW(MI('Y'), MO('−'), MI('T'))), MO('+'), MI('I'), MO('+'), MI('G'), MO(',')), 'Y = C̄ + mpc (Y − T) + I + G'),
    'image6_3_8.jpg': math(ROW(MO('Δ'), MI('Y'), MO('='), FRAC(ROW(MO('−'), MPC), ROW(MN('1'), MO('−'), MPC)), MO('⋅'), MO('Δ'), MI('T'), MO('.')), 'ΔY = −mpc / (1 − mpc) · ΔT'),
    'image11_1_1.jpg': math(ROW(SUB('y', 't'), MO('='), SUB('C', 'a,t'), MO('+'), MPC, SUB('y', ROW(MI('t'), MO('−'), MN('1'))), MO('+'), SUB('I', 'a,t'), MO('+'), MI('η'), paren(ROW(SUB('y', ROW(MI('t'), MO('−'), MN('1'))), MO('−'), SUB('y', ROW(MI('t'), MO('−'), MN('2'))))), MO('='), paren(ROW(MPC, MO('+'), MI('η'))), SUB('y', ROW(MI('t'), MO('−'), MN('1'))), MO('−'), MI('η'), SUB('y', ROW(MI('t'), MO('−'), MN('2'))), MO('+'), SUB('A', 't'), MO(',')), 'y_t = C_a,t + mpc·y_(t−1) + I_a,t + η(y_(t−1) − y_(t−2)) = (mpc + η)·y_(t−1) − η·y_(t−2) + A_t'),
    'image11_1_2.jpg': math(ROW(SUB('y', 't'), MO('='), MI('min'), MO('{'), paren(ROW(SUB('C', 'a,t'), MO('+'), MPC, SUB('y', ROW(MI('t'), MO('−'), MN('1'))), MO('+'), SUB('I', 'a,t'), MO('+'), SUB('I', 'in,t'))), MO(','), SUB('y', 'F,t'), MO('}'), MO(',')), 'y_t = min{ C_a,t + mpc·y_(t−1) + I_a,t + I_in,t ; y_F,t }')
        + '<p class="where">где <i>I</i><sub>in,t</sub> = max{−<i>D</i>; η(<i>y</i><sub>t−1</sub> − <i>y</i><sub>t−2</sub>)}, если <i>y</i><sub>t</sub> &lt; <i>y</i><sub>F</sub>, и <i>I</i><sub>in,t</sub> = <i>y</i><sub>t</sub> − <i>C</i><sub>t</sub> − <i>I</i><sub>a,t</sub> при <i>y</i><sub>t</sub> ≥ <i>y</i><sub>F</sub>.</p>',
    'image13_1_1.jpg': math(ROW(MI('BP'), MO('='), SUB('N', 'x'), paren(ROW(MI('Y'), MO(','), SUB('Y', 'f'), MO(','), MI('ε'))), MO('+'), MI('CF'), paren('<msup>' + MI('r') + MO('*') + '</msup>')), 'BP = N_x(Y, Y_f, ε) + CF(r*)'),
}

# ── lectures ────────────────────────────────────────────────────
def lecture_blocks(soup, lec_id):
    body = soup.body or soup
    blocks, figs = [], []
    nodes = []
    for ch in body.children:
        if isinstance(ch, NavigableString):
            if norm_ws(str(ch)) and ch.__class__.__name__ not in ('Comment', 'Doctype'):
                nodes.append(('text', str(ch)))
        elif isinstance(ch, Tag):
            if ch.name == 'p':
                nodes.append(('p', ch))
            elif ch.name in ('img', 'table', 'div'):
                nodes.append((ch.name, ch))
            elif ch.name == 'br':
                continue
            else:
                nodes.append(('p', ch))
    imgs_seen = 0
    for kind, node in nodes:
        if kind == 'text':
            t = tidy(htmlmod.escape(typo(node)))
            if t:
                blocks.append('<p>%s</p>' % t)
            continue
        if kind == 'img':
            node = BeautifulSoup('<p></p>', 'html.parser').p.append(node) or node
        p = node
        imgs = p.find_all('img') if isinstance(p, Tag) else []
        if imgs:
            # figure / formula paragraph
            src = imgs[0].get('src', '')
            fn = Path(src.replace('\\', '/')).name
            if fn in FORMULAS and len(imgs) == 1:
                blocks.append(FORMULAS[fn])
                continue
            w = imgs[0].get('width'); h = imgs[0].get('height')
            for im in p.find_all('img'):
                im.extract()
            cap = tidy(inline(p))
            cap = re.sub(r'^(<br>)+', '', cap)
            capt = re.sub(r'<[^>]+>', '', cap).strip()
            try:
                from PIL import Image as _I
                with _I.open(SRC / 'Images' / 'lekcii' / fn) as _im:
                    w, h = _im.size
            except Exception:
                pass
            figs.append({'src': 'app/img/lec/' + fn, 'cap': capt, 'w': int(w or 0), 'h': int(h or 0)})
            fig = '<figure class="fig"><img src="app/img/lec/%s" width="%s" height="%s" alt="%s" loading="lazy" decoding="async">%s</figure>' % (
                fn, w or '', h or '', htmlmod.escape(capt or 'Рисунок', quote=True), ('<figcaption>%s</figcaption>' % cap) if cap else '')
            blocks.append(fig)
            continue
        # text paragraph
        raw = inline(p)
        s = tidy(raw)
        if not re.sub(r'<[^>]+>|\s|&nbsp;', '', s):
            continue
        plain = text_of(p)
        cls = []
        # legends: "где ..." lines under formulas
        if re.match(r'^где\b', plain):
            cls.append('where')
        # bold-only lead-in (short, ends with colon)
        bs = p.find_all(['b', 'strong'])
        btxt = ' '.join(norm_ws(b.get_text(' ', strip=True)) for b in bs)
        if bs and len(btxt) >= 0.9 * len(plain) and len(plain) < 200:
            cls.append('lead')
        # definition: starts with a bold term followed by dash
        elif re.match(r'^<b>[^<]{2,90}</b>\s*(\(|[  ]*[—–-]| —)', s):
            cls.append('def')
        # numbered item
        m = re.match(r'^(\d{1,2})\s*\)\s*(.*)$', s, flags=re.S)
        if m and 'lead' not in cls:
            blocks.append('<p class="li%s"><span class="n">%s</span><span class="t">%s</span></p>' % (' ' + ' '.join(cls) if cls else '', m.group(1), m.group(2)))
            continue
        m = re.match(r'^[–—-]\s+(.*)$', s, flags=re.S)
        if m:
            blocks.append('<p class="bl%s"><span class="t">%s</span></p>' % (' ' + ' '.join(cls) if cls else '', m.group(1)))
            continue
        # formula-like short paragraph: mostly latin, has "="
        textonly = re.sub(r'<[^>]+>', '', s)
        cyr = len(re.findall('[%s]' % CYR, textonly))
        if '=' in textonly and len(textonly) < 120 and cyr <= 8 and 'where' not in cls and '<br>' not in s:
            blocks.append('<div class="eq eq--text">%s</div>' % s)
            continue
        blocks.append('<p%s>%s</p>' % (' class="%s"' % ' '.join(cls) if cls else '', s))
    return blocks, figs

def build_lectures():
    lec_titles = {}   # id → (long title)
    topics = []
    # topic titles from the 'Lekcii' page
    page_l = PAGES['Lekcii']
    topic_titles = {}
    for o in page_l['objects']:
        t = norm_ws(o.get('text', ''))
        m = re.match(r'^Тема\s+(\d+):\s*(.+)$', t)
        if m:
            topic_titles[int(m.group(1))] = m.group(2).strip()
    for n in range(1, 15):
        pg = PAGES['4.%d' % n]
        lecs = []
        for o in pg['objects']:
            ev = (o.get('events') or {}).get('On Click', '')
            m = re.search(r'k\s*=\s*"tema_([\d\.]+)"', ev)
            if not m:
                continue
            lid = m.group(1)
            t = norm_ws(o.get('text', ''))
            t = re.sub(r'^\d+\.\d+\s*', '', t)
            lecs.append((lid, t))
        lecs.sort(key=lambda x: [int(z) for z in x[0].split('.')])
        topics.append({'n': n, 'title': topic_titles.get(n, ''), 'lectures': [{'id': a, 'title': b} for a, b in lecs]})
    IMG.joinpath('lec').mkdir(parents=True, exist_ok=True)
    for f in (SRC / 'Images' / 'lekcii').glob('*.jpg'):
        shutil.copy2(f, IMG / 'lec' / f.name)
    search = []
    allwords = 0
    for t in topics:
        for lec in t['lectures']:
            lid = lec['id']
            f = DOCS / 'Lekcii' / ('tema_%s.html' % lid)
            soup = BeautifulSoup(rd(f), 'html.parser')
            short = norm_ws(soup.title.get_text()) if soup.title else ''
            short = re.sub(r'^\d+\.\d+\s*', '', short)
            blocks, figs = lecture_blocks(soup, lid)
            plain = norm_ws(re.sub(r'<[^>]+>', ' ', ' '.join(blocks)))
            words = len(plain.split())
            defs = []
            for b in blocks:
                m = re.match(r'<p class="[^"]*\bdef\b[^"]*">\s*<b>([^<]+)</b>', b)
                if m:
                    defs.append(norm_ws(m.group(1)).rstrip(' .,:;'))
            lec.update({'short': short or lec['title'], 'words': words, 'min': max(1, round(words / 175)), 'figs': len(figs), 'terms': defs[:12]})
            wt('lec/%s.html' % lid, '\n'.join(blocks))
            allwords += words
            search.append({'t': 'lec', 'id': lid, 'title': lec['title'], 'topic': t['n'], 'text': plain})
    # intro
    soup = BeautifulSoup(rd(DOCS / 'Lekcii' / 'vvedenie.html'), 'html.parser')
    blocks, _ = lecture_blocks(soup, 'intro')
    wt('lec/intro.html', '\n'.join(blocks))
    print('lectures:', sum(len(t['lectures']) for t in topics), 'words', allwords)
    return topics, search

# ── glossary ────────────────────────────────────────────────────
def build_glossary():
    items = []
    for f in sorted((DOCS / 'Glossarii').glob('7.*.html'), key=lambda p: int(p.stem.split('.')[1])):
        soup = BeautifulSoup(rd(f), 'html.parser')
        head = soup.find('p', class_='header')
        letter = norm_ws(head.get_text()) if head else ''
        for p in soup.find_all('p', class_='gloss'):
            b = p.find('b')
            if not b:
                continue
            term = norm_ws(b.get_text(' ', strip=True))
            b.extract()
            d = tidy(inline(p))
            d = re.sub(r'^[\s ]*[—–-][\s ]*', '', d)
            if not term or not d:
                continue
            d = d[0].upper() + d[1:] if d[0].islower() else d
            items.append({'term': term, 'letter': letter or term[0].upper(), 'def': d})
    items.sort(key=lambda x: x['term'].lower().replace('ё', 'е'))
    for i, it in enumerate(items):
        it['id'] = 'g%03d' % (i + 1)
        m = re.search(r'\(([^)]{2,14})\)\s*$', it['term'])
        it['abbr'] = m.group(1) if m else ''
    print('glossary:', len(items), 'letters', sorted({i['letter'] for i in items}))
    wj('glossary.json', items)
    return [{'t': 'gl', 'id': i['id'], 'title': i['term'], 'text': re.sub(r'<[^>]+>', ' ', i['def'])} for i in items if i.get('term') and i.get('def')]

# ── tasks ───────────────────────────────────────────────────────
def build_tasks():
    (IMG / 'tasks').mkdir(parents=True, exist_ok=True)
    for f in (SRC / 'Images' / 'Zadachi').glob('*.*'):
        shutil.copy2(f, IMG / 'tasks' / f.name)
    tasks = []
    def key(p):
        return [int(z) for z in p.stem.split('.')]
    for f in sorted([p for p in (DOCS / 'Zadachi').glob('*.html') if re.match(r'^\d+\.\d+$', p.stem)], key=key):
        raw = rd(f)
        topic, num = [int(z) for z in f.stem.split('.')]
        title = re.search(r'<title>(.*?)</title>', raw, re.S).group(1).strip()
        nv = {}
        for m in re.finditer(r'^nv(\d+)\s*=\s*([^;\n]+);', raw, re.M):
            v = m.group(2).strip().strip("'\"")
            try:
                nv['v%s' % m.group(1)] = float(v)
            except ValueError:
                nv['v%s' % m.group(1)] = v
        stip = re.search(r"stip\s*=\s*'(.*?)'\s*\n", raw, re.S)
        sres = re.search(r"sres\s*=\s*'(.*?)'\s*\n", raw, re.S)
        def frag(h):
            if not h:
                return ''
            h = re.sub(r'<INPUT[^>]*>', '', h, flags=re.I)
            h = re.sub(r'<BR>', '<br>', h, flags=re.I)
            sp = BeautifulSoup(h, 'html.parser')
            for im in sp.find_all('img'):
                fn = Path(im.get('src', '').replace('\\', '/')).name
                im.attrs = {'src': 'app/img/tasks/' + fn, 'alt': 'Решение', 'loading': 'lazy'}
            for d in sp.find_all('div'):
                d.unwrap()
            # keep text + images
            out = []
            for c in sp.children:
                if isinstance(c, NavigableString):
                    t = tidy(htmlmod.escape(typo(str(c))))
                    if t: out.append('<p>%s</p>' % t)
                elif c.name == 'img':
                    out.append('<figure class="fig fig--solution">%s</figure>' % str(c))
                elif c.name == 'br':
                    continue
                else:
                    t = tidy(inline(c))
                    if t: out.append('<p>%s</p>' % t)
            return '\n'.join(out)
        hint = frag(stip.group(1) if stip else '')
        sol = frag(sres.group(1) if sres else '')
        soup = BeautifulSoup(raw, 'html.parser')
        cell = soup.body.find('td') if soup.body else None
        # the outer wrapper table has a single TD with everything
        wrapper = soup.body.find('table') if soup.body else None
        inner = wrapper.find('td') if wrapper else soup.body
        src_ref = ''
        hdr = inner.find('p', class_='header') if inner else None
        if hdr:
            fnt = hdr.find('font')
            if fnt:
                src_ref = norm_ws(fnt.get_text())
                fnt.extract()
            head = norm_ws(hdr.get_text())
            hdr.extract()
        else:
            head = title
        # drop answer widgets (check button, status, tip, result divs), decimal separator note
        for t in inner.find_all('input'):
            if (t.get('type') or '').lower() == 'text':
                t.replace_with(BeautifulSoup('<input class="ans" data-k="%s" inputmode="decimal" autocomplete="off" aria-label="Ответ">' % (t.get('name') or t.get('id')), 'html.parser').input)
            else:
                t.extract()
        for d in inner.find_all('div', id=True):
            d.extract()
        for p in list(inner.find_all('p')):
            tx = norm_ws(p.get_text())
            if tx.startswith('ПРИМЕЧАНИЕ') and 'десятичного разделителя' in tx:
                p.extract()
        # sanitize
        body = []
        def walk_block(el):
            if isinstance(el, NavigableString):
                t = tidy(htmlmod.escape(typo(str(el))))
                if t: body.append('<p>%s</p>' % t)
                return
            n = el.name
            if n == 'table':
                rows = []
                for tr in el.find_all('tr'):
                    cells = []
                    for td in tr.find_all(['td', 'th']):
                        inp = td.find('input')
                        if inp is not None and not norm_ws(td.get_text()):
                            cells.append('<td class="in"><input class="ans" data-k="%s" inputmode="decimal" autocomplete="off" aria-label="Ответ"></td>' % inp.get('data-k'))
                        else:
                            head_cell = (td.get('bgcolor') or '').lower() in ('#d8d8d8', '#c0c0c0', '#dddddd', 'silver', '#cccccc')
                            inner_html = ''
                            for c in td.children:
                                if isinstance(c, Tag) and c.name == 'input':
                                    inner_html += '<input class="ans" data-k="%s" inputmode="decimal" autocomplete="off" aria-label="Ответ">' % c.get('data-k')
                                elif isinstance(c, Tag) and c.name == 'img':
                                    fn = Path(c.get('src', '').replace('\\', '/')).name
                                    inner_html += '<img src="app/img/tasks/%s" alt="" loading="lazy">' % fn
                                elif isinstance(c, NavigableString):
                                    inner_html += htmlmod.escape(typo(str(c)), quote=False)
                                else:
                                    inner_html += inline(BeautifulSoup('<x>%s</x>' % str(c), 'html.parser').x)
                            cells.append('<%s>%s</%s>' % ('th' if head_cell else 'td', tidy(inner_html), 'th' if head_cell else 'td'))
                    if cells:
                        rows.append('<tr>%s</tr>' % ''.join(cells))
                if rows:
                    body.append('<div class="tbl"><table>%s</table></div>' % ''.join(rows))
            elif n == 'img':
                fn = Path(el.get('src', '').replace('\\', '/')).name
                body.append('<figure class="fig"><img src="app/img/tasks/%s" alt="" loading="lazy"></figure>' % fn)
            elif n in ('p', 'div', 'td', 'font', 'center', 'span', 'b', 'i'):
                has_blockish = el.find(['table', 'img']) is not None and n in ('div', 'td', 'font', 'center')
                if has_blockish:
                    for c in el.children: walk_block(c)
                else:
                    # paragraph (may contain inputs)
                    htmlp = ''
                    for c in el.children:
                        if isinstance(c, Tag) and c.name == 'input':
                            htmlp += '<input class="ans ans--inline" data-k="%s" inputmode="decimal" autocomplete="off" aria-label="Ответ">' % c.get('data-k')
                        elif isinstance(c, NavigableString):
                            htmlp += htmlmod.escape(typo(str(c)), quote=False)
                        else:
                            htmlp += inline(BeautifulSoup('<x>%s</x>' % str(c), 'html.parser').x)
                    htmlp = tidy(htmlp)
                    if re.sub(r'<[^>]+>|\s', '', htmlp):
                        cls = 'note' if (el.get('class') and any('red' in c for c in el.get('class'))) else ''
                        body.append('<p%s>%s</p>' % (' class="note"' if cls else '', htmlp))
            elif n == 'br':
                return
            else:
                for c in el.children: walk_block(c)
        for c in inner.children:
            walk_block(c)
        body_html = '\n'.join(body)
        tasks.append({'id': f.stem, 'topic': topic, 'n': num, 'title': head, 'src': src_ref, 'html': body_html, 'answers': nv, 'hint': hint, 'solution': sol})
    print('tasks:', len(tasks), 'no-answers:', [t['id'] for t in tasks if not t['answers']])
    wj('tasks.json', tasks)
    return [{'t': 'task', 'id': t['id'], 'title': '%s (тема %d)' % (t['title'], t['topic']), 'topic': t['topic'], 'text': re.sub(r'<[^>]+>', ' ', t['html'])} for t in tasks]

# ── tests ───────────────────────────────────────────────────────
def build_tests():
    from lxml import etree
    tests = {}
    types = set()
    for n in range(1, 15):
        key = 'Docs/testi/test%d_sample.quiz' % n
        xml = FILES[key].strip()
        root = etree.fromstring(xml.encode('utf-8'), etree.XMLParser(recover=True, encoding='utf-8'))
        total = int(root.findtext('details/totalquestions') or 0)
        ask = int(root.findtext('details/questionstoask') or 10)
        qs = []
        for it in root.findall('items/item'):
            q = it.find('question')
            types.add(q.get('type'))
            text = norm_ws(''.join(q.itertext()))
            ans = []
            for a in it.findall('answer'):
                ans.append({'t': typo(norm_ws(''.join(a.itertext()))), 'ok': a.get('correct') == 'y'})
            qs.append({'q': typo(text), 'type': q.get('type') or 'mc', 'a': ans})
        tests[n] = {'topic': n, 'total': total, 'ask': ask, 'q': qs}
    print('tests:', {n: len(t['q']) for n, t in tests.items()}, 'types', types)
    wj('tests.json', tests)
    return [{'t': 'test', 'id': str(n), 'title': 'Тест к теме %d' % n, 'topic': n, 'text': ' '.join(q['q'] for q in t['q'])} for n, t in tests.items()]

# ── documents: СРО, appendices, sources, authors, intro ─────────
def doc_html(path):
    soup = BeautifulSoup(rd(path), 'html.parser')
    title = norm_ws(soup.title.get_text()) if soup.title else ''
    blocks = []
    body = soup.body or soup
    for ch in body.children:
        if isinstance(ch, NavigableString):
            t = tidy(htmlmod.escape(typo(str(ch))))
            if t and ch.__class__.__name__ not in ('Comment', 'Doctype'):
                blocks.append('<p>%s</p>' % t)
        elif isinstance(ch, Tag):
            if ch.name == 'table':
                rows = []
                for tr in ch.find_all('tr'):
                    cells = ['<td>%s</td>' % tidy(inline(td)) for td in tr.find_all('td')]
                    if cells: rows.append('<tr>%s</tr>' % ''.join(cells))
                blocks.append('<div class="tbl"><table>%s</table></div>' % ''.join(rows))
            elif ch.name == 'br':
                continue
            else:
                s = tidy(inline(ch))
                if re.sub(r'<[^>]+>|\s', '', s):
                    blocks.append('<p>%s</p>' % s)
    return title, '\n'.join(blocks)

def build_docs():
    docs = {'sro': [], 'appendix': []}
    search = []
    # СРО
    sro_pages = {}
    for i in range(1, 16):
        pg = PAGES['sroweb%d' % i]
        topic = None
        for o in pg['objects']:
            m = re.match(r'^Тема\s+(\d+)', norm_ws(o.get('text', '')))
            if m: topic = int(m.group(1))
        title, html = doc_html(DOCS / 'SRO' / ('sro_%d.html' % i))
        docs['sro'].append({'n': i, 'topic': topic or min(i, 14), 'title': title, 'html': html})
        search.append({'t': 'sro', 'id': str(i), 'title': title, 'topic': topic or min(i, 14), 'text': re.sub(r'<[^>]+>', ' ', html)})
    # appendices 2–4 (html) and 1 (slideshow of accounts: handled by the lab exercise 2.1)
    titles = {2: 'Приложение к упражнению 4.1: Теория естественной безработицы', 3: 'Приложение к упражнению 10.3', 4: 'Приложение к упражнению 13.1'}
    for n in (2, 3, 4):
        pg = PAGES['Prilojenie%d' % n]
        ttl = ''; topic = None
        for o in pg['objects']:
            tx = norm_ws(o.get('text', ''))
            if o['name'] == 'Paragraph2': ttl = tx
            m = re.match(r'^Тема\s+(\d+)', tx)
            if m: topic = int(m.group(1))
        _, html = doc_html(DOCS / 'Prilojenie' / ('Prilojenie_%d.html' % n))
        docs['appendix'].append({'n': n, 'topic': topic, 'title': ttl or titles[n], 'html': html})
        search.append({'t': 'app', 'id': str(n), 'title': ttl or titles[n], 'topic': topic, 'text': re.sub(r'<[^>]+>', ' ', html)})
    # sources
    for o in PAGES['Istochniki']['objects']:
        if o['name'] == 'Paragraph10':
            items = [norm_ws(x) for x in re.split(r'\n\s*\n', o['text']) if norm_ws(x)]
        if o['name'] == 'Paragraph9':
            extra = norm_ws(o['text'])
    items = [re.sub(r'^(\d+)\s*[\.\)]\s*', '', x) for x in items]
    items = [x.replace('Мароэкономика', 'Макроэкономика').replace('СаксДж.', 'Сакс Дж.').replace('Ларрен Ф.Б.Макроэкономика', 'Ларрен Ф.Б. Макроэкономика') for x in items]
    docs['sources'] = items
    docs['sources_online'] = re.sub(r'^\d+\.\s*', '', extra)
    # authors / annotation
    t, ann = doc_html(DOCS / 'index.html')
    docs['annotation'] = ann
    docs['authors'] = [
        {'name': 'Валиева Майра Мухаметгалиевна', 'role': 'кандидат экономических наук, доцент кафедры «Экономика и учет»'},
        {'name': 'Шинкарев Иван Анатольевич', 'role': 'магистр менеджмента, старший преподаватель кафедры «Экономика и учет»'},
    ]
    _, intro = doc_html(DOCS / 'Lekcii' / 'vvedenie.html')
    docs['intro'] = intro
    # guide text
    for o in PAGES['instrukcia']['objects']:
        if o['name'] == 'Paragraph1':
            docs['guide'] = [norm_ws(x) for x in re.split(r'\n\s*\n', o['text']) if norm_ws(x)]
    wj('docs.json', docs)
    print('docs: sro', len(docs['sro']), 'appendix', len(docs['appendix']), 'sources', len(docs['sources']))
    return search

# ── exercises (metadata only; simulators live in app/js/sims) ───
EX = [
    # id, topic, classic page, title
    ('ex1-1', 1, '5.1', 'Модель кругооборота потоков в экономике'),
    ('ex2-1', 2, '5.2.1', 'Система национальных счетов'),
    ('ex2-2', 2, '5.2.2', 'Динамика макроэкономических показателей'),
    ('ex3-1', 3, '5.3', 'Модели экономического роста'),
    ('ex4-1', 4, '5.4', 'Теория естественной безработицы'),
    ('ex5-1', 5, '5.5', 'Рыночное равновесие в модели AD–AS'),
    ('ex6-1', 6, '5.6', 'Простая кейнсианская модель «доходы — расходы»'),
    ('ex7-1', 7, '5.7', 'Дискретная и автоматическая фискальная политика'),
    ('ex8-1', 8, '5.8', 'Денежный мультипликатор'),
    ('ex10-1', 10, '5.10.1', 'Построение кривой IS'),
    ('ex10-2', 10, '5.10.2', 'Построение кривой LM'),
    ('ex10-3', 10, '5.10.3', 'Равновесие на товарном и денежном рынках'),
    ('ex11-1', 11, '5.11', 'Модель Самуэльсона — Хикса'),
    ('ex12-1', 12, '5.12', 'Модель малой открытой экономики'),
    ('ex13-1', 13, '5.13', 'Эффективность политики в моделях IS–LM–BP и AD–AS'),
]

def build_exercises():
    out = []
    for id_, topic, page, title in EX:
        pg = PAGES[page]
        task = ''
        for o in pg['objects']:
            if o['name'] in ('Paragraph3', 'Paragraph4', 'Paragraph_uslovie') and len(o.get('text', '')) > 80 and not task:
                task = o['text']
        # assignment text: prefer the longest paragraph that looks like a task
        cands = [o['text'] for o in pg['objects'] if o['cls'] == 'Paragraph' and len(o.get('text') or '') > 120]
        if cands:
            task = max(cands, key=len)
        steps = [norm_ws(x) for x in re.split(r'\r?\n', task) if norm_ws(x)]
        out.append({'id': id_, 'topic': topic, 'page': page, 'title': title, 'task': steps})
    return out

# ── main ────────────────────────────────────────────────────────
def main():
    OUT.mkdir(parents=True, exist_ok=True)
    topics, s1 = build_lectures()
    s2 = build_glossary()
    s3 = build_tasks()
    s4 = build_tests()
    s5 = build_docs()
    exs = build_exercises()
    # structure: attach exercises, tasks, test, sro, appendices to topics
    links = {
        1: dict(sro=[1]), 2: dict(sro=[2], app=[1]), 3: dict(sro=[3]), 4: dict(sro=[4], app=[2]), 5: dict(sro=[5]), 6: dict(sro=[6]), 7: dict(sro=[7]),
        8: dict(sro=[8]), 9: dict(sro=[9]), 10: dict(sro=[10], app=[3]), 11: dict(sro=[11]), 12: dict(sro=[12]), 13: dict(sro=[13], app=[4]), 14: dict(sro=[14, 15]),
    }
    tasks = json.loads((OUT / 'tasks.json').read_text(encoding='utf-8'))
    for t in topics:
        n = t['n']
        t['lab'] = [e['id'] for e in exs if e['topic'] == n]
        t['tasks'] = [x['id'] for x in tasks if x['topic'] == n]
        t['test'] = n
        t.update(links[n])
    toc = {'topics': topics, 'labs': exs}
    wj('toc.json', toc)
    # search index (titles + text)
    index = []
    for e in s1 + s2 + s3 + s4 + s5:
        e['text'] = norm_ws(e['text'])
        index.append(e)
    for e in exs:
        index.append({'t': 'lab', 'id': e['id'], 'title': 'Упражнение: ' + e['title'], 'topic': e['topic'], 'text': ' '.join(e['task'])})
    wj('search.json', index)
    sz = sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file())
    print('total data bytes', sz)

if __name__ == '__main__':
    main()
