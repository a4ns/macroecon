#!/usr/bin/env python3
"""Subset + instance the web fonts used by the modern site.

Source files come from a sparse clone of github.com/google/fonts (OFL) and the
Latin Modern Math font shipped with TeX (GUST Font License).
WOFF2 needs brotli; a node-backed shim lives in tools/shim (PYTHONPATH).

usage: PYTHONPATH=tools/shim python3 tools/fonts.py
"""
import os, sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

GF = os.environ.get('GF', '/home/claude/gf/gfonts/ofl')
OUT = os.path.join(os.path.dirname(__file__), '..', 'app', 'fonts')
os.makedirs(OUT, exist_ok=True)

# Latin, Latin-1, Latin Ext-A/B(part), Cyrillic (+ext: Kazakh), Greek, punctuation,
# super/subscripts, currency (₸), letterlike, arrows, math operators, geometric shapes
UNI = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + [0x192, 0x2C6, 0x2C7, 0x2D8, 0x2D9, 0x2DA, 0x2DB, 0x2DC, 0x2DD] +
    list(range(0x370, 0x400)) + list(range(0x400, 0x530)) + [0x1E9E] +
    list(range(0x2000, 0x2070)) + list(range(0x2070, 0x20A0)) + list(range(0x20A0, 0x20D0)) +
    list(range(0x2100, 0x2150)) + list(range(0x2150, 0x2190)) + list(range(0x2190, 0x2200)) +
    list(range(0x2200, 0x2300)) + [0x2310, 0x2318] + list(range(0x2500, 0x2580)) + list(range(0x25A0, 0x2600)) +
    [0x2713, 0x2714, 0x2715, 0x2717, 0x2726, 0x2605, 0x2606, 0xFEFF, 0xFB01, 0xFB02]
)

JOBS = [
    # (source, out name, axis limits or None)
    ('literata/Literata[opsz,wght].ttf',                  'literata.woff2',        {'wght': (300, 800), 'opsz': (7, 72)}),
    ('literata/Literata-Italic[opsz,wght].ttf',           'literata-italic.woff2', {'wght': (300, 700), 'opsz': (7, 72)}),
    ('sofiasans/SofiaSans[wght].ttf',                     'sofia.woff2',           {'wght': (300, 800)}),
    ('sofiasansextracondensed/SofiaSansExtraCondensed[wght].ttf', 'sofia-xc.woff2', {'wght': (300, 900)}),
    ('jetbrainsmono/JetBrainsMono[wght].ttf',             'mono.woff2',            {'wght': (300, 700)}),
]


def build(src, out, limits, unicodes=UNI, features='*'):
    path = src if os.path.isabs(src) else os.path.join(GF, src)
    f = TTFont(path)
    opts = subset.Options()
    opts.layout_features = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk', 'tnum', 'lnum', 'onum', 'pnum',
                            'case', 'frac', 'sups', 'subs', 'sinf', 'ss01', 'ss02', 'ss03', 'zero', 'cv01', 'cv02',
                            'cv03', 'cv04', 'cv05', 'cv06', 'cv07', 'cv08', 'cv09', 'cv10', 'cv11', 'cv12'] if features == '*' else features
    opts.name_IDs = [1, 2, 3, 4, 6]
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.hinting = False
    opts.desubroutinize = True
    opts.flavor = 'woff2'
    opts.with_zopfli = False
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=unicodes)
    sub.subset(f)
    if limits and 'fvar' in f:
        f = instancer.instantiateVariableFont(f, limits, inplace=False)
    f.flavor = 'woff2'
    dst = os.path.join(OUT, out)
    f.save(dst)
    print('%-22s %7.1f KB' % (out, os.path.getsize(dst) / 1024))


if __name__ == '__main__':
    for s, o, l in JOBS:
        build(s, o, l)
    # math font for MathML (keeps the MATH table): Latin Modern Math
    math_uni = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + list(range(0x370, 0x400)) + list(range(0x2000, 0x2070)) + \
        list(range(0x2070, 0x20A0)) + list(range(0x2100, 0x2150)) + list(range(0x2190, 0x2200)) + list(range(0x2200, 0x2300)) + \
        list(range(0x1D400, 0x1D800)) + [0x2016, 0x2044, 0x20D7, 0x2212, 0x221A, 0x23DE, 0x23DF, 0x2322, 0x2323, 0x25A0, 0x25A1, 0x27E8, 0x27E9]
    build('/usr/share/texmf/fonts/opentype/public/lm-math/latinmodern-math.otf', 'math.woff2', None, unicodes=math_uni)
