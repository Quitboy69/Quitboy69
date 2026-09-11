#!/usr/bin/env python3
"""Erzeugt die Programm-Wrapper (Root + world-1 + world1) fuer RealisLite.
Die eigentliche Logik liegt in shaders/program/*, die Wrapper setzen nur
#version, PROGRAM_*-Defines und DIM_*-Defines."""
import os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'RealisLite', 'shaders')
VERSION = '#version 330 compatibility'

# name -> (body, defines)
PROGRAMS = {
    'shadow':                ('shadow',                []),
    'gbuffers_terrain':      ('gbuffers_lit',          ['PROGRAM_TERRAIN']),
    'gbuffers_textured_lit': ('gbuffers_lit',          []),
    'gbuffers_block':        ('gbuffers_lit',          ['PROGRAM_BLOCK']),
    'gbuffers_entities':     ('gbuffers_lit',          ['PROGRAM_ENTITIES']),
    'gbuffers_hand':         ('gbuffers_lit',          ['PROGRAM_HAND']),
    'gbuffers_textured':     ('gbuffers_lit',          ['PROGRAM_TEXTURED']),
    'gbuffers_weather':      ('gbuffers_lit',          ['PROGRAM_WEATHER']),
    'gbuffers_spidereyes':   ('gbuffers_lit',          ['PROGRAM_TEXTURED', 'PROGRAM_EMISSIVE']),
    'gbuffers_beaconbeam':   ('gbuffers_lit',          ['PROGRAM_TEXTURED', 'PROGRAM_EMISSIVE']),
    'gbuffers_water':        ('gbuffers_water',        []),
    'gbuffers_skybasic':     ('gbuffers_skybasic',     []),
    'gbuffers_skytextured':  ('gbuffers_skytextured',  []),
    'gbuffers_clouds':       ('gbuffers_clouds',       []),
    'composite':             ('composite',             []),
    'final':                 ('final',                 []),
}
WORLDS = {'': [], 'world-1': ['DIM_NETHER'], 'world1': ['DIM_END']}

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', newline='\n') as f:
        f.write(text)

count = 0
for folder, dim_defs in WORLDS.items():
    for name, (body, defs) in PROGRAMS.items():
        for ext in ('vsh', 'fsh'):
            lines = [VERSION, f'// RealisLite - {name}.{ext} (automatisch erzeugt von tools/gen_wrappers.py)']
            for d in dim_defs + defs:
                lines.append(f'#define {d}')
            lines.append(f'#include "/program/{body}.{ext}"')
            write(os.path.join(ROOT, folder, f'{name}.{ext}'), '\n'.join(lines) + '\n')
            count += 1
print(f'{count} Wrapper geschrieben')
