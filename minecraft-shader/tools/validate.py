#!/usr/bin/env python3
"""Kompiliert jedes Shader-Programm mit glslangValidator.
Loest #include auf (wie Iris/OptiFine: "/pfad" = relativ zum shaders-Ordner)
und prueft optional zusaetzliche Define-Kombinationen (Optionen)."""
import os, re, subprocess, sys, tempfile, itertools

HERE = os.path.dirname(os.path.abspath(__file__))
SHADERS = os.path.normpath(os.path.join(HERE, '..', 'RealisLite', 'shaders'))
INC = re.compile(r'^\s*#include\s+"([^"]+)"', re.M)

def resolve(path, stack=()):
    if path in stack:
        raise RuntimeError('Zirkulaerer include: ' + ' -> '.join(stack + (path,)))
    src = open(path, encoding='utf-8').read()
    def sub(m):
        inc = m.group(1)
        target = os.path.join(SHADERS, inc.lstrip('/')) if inc.startswith('/') \
                 else os.path.join(os.path.dirname(path), inc)
        if not os.path.exists(target):
            raise RuntimeError(f'{path}: include nicht gefunden: {inc}')
        return '\n' + resolve(target, stack + (path,)) + '\n'
    return INC.sub(sub, src)

def apply_defines(src, defines):
    """Fuegt/ersetzt #define-Zeilen direkt nach #version ein (fuer Options-Tests)."""
    if not defines:
        return src
    lines = src.split('\n')
    out = [lines[0]]
    for name, val in defines.items():
        if val is None:
            out.append(f'#define {name}__DISABLED 1')  # Markierung nur
        else:
            out.append(f'#define {name} {val}')
    out += lines[1:]
    text = '\n'.join(out)
    for name, val in defines.items():
        # Original-Definition entfernen, damit keine Redefinition-Warnung kommt
        text = re.sub(rf'^\s*#define\s+{re.escape(name)}\b.*$', '', text, flags=re.M)
        if val is None:
            text = text.replace(f'#define {name}__DISABLED 1', '')
    return text

def compile_one(path, defines=None, verbose=False):
    stage = 'vert' if path.endswith('.vsh') else 'frag'
    src = apply_defines(resolve(path), defines or {})
    with tempfile.NamedTemporaryFile('w', suffix='.' + stage, delete=False, encoding='utf-8') as f:
        f.write(src); tmp = f.name
    try:
        r = subprocess.run(['glslangValidator', '-S', stage, tmp], capture_output=True, text=True)
        ok = r.returncode == 0
        if not ok or verbose:
            print(f'--- {os.path.relpath(path, SHADERS)} defines={defines}')
            print(r.stdout.strip()); print(r.stderr.strip())
        return ok, src
    finally:
        os.unlink(tmp)

def programs():
    for folder in ('', 'world-1', 'world1'):
        d = os.path.join(SHADERS, folder)
        for fn in sorted(os.listdir(d)):
            if fn.endswith(('.vsh', '.fsh')):
                yield os.path.join(d, fn)

# Options-Varianten, die zusaetzlich zum Standard geprueft werden
VARIANTS = [
    {},
    {'SHADOWS': None},
    {'COLORED_SHADOWS': ''},
    {'BLOOM': '', 'GRAIN': ''},
    {'FOG': None, 'FOG_HEIGHT': None, 'WATER_WAVES': None, 'WATER_REFLECTION': None, 'SPECULAR': None, 'STARS': None},
    {'WAVING_PLANTS': None, 'WAVING_LEAVES': None, 'RAIN_WETNESS': None},
    {'TONEMAP': '0', 'TORCH_TEMPERATURE': '2', 'WATER_COLOR_MODE': '1', 'VIGNETTE': '0.0'},
    {'TONEMAP': '2', 'TORCH_TEMPERATURE': '0', 'SHADOW_SAMPLES': '4'},
]

def main():
    verbose = '-v' in sys.argv
    failed = 0; total = 0
    for defs in VARIANTS:
        for p in programs():
            total += 1
            ok, _ = compile_one(p, defs, verbose)
            if not ok:
                failed += 1
    print(f'{total - failed}/{total} Kompilierungen erfolgreich')
    sys.exit(1 if failed else 0)

if __name__ == '__main__':
    main()
