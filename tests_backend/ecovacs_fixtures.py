"""Synthetic renderer-shaped SVGs; no user's home or robot data."""
import base64
import struct
import zlib

PNG_HEADER = b"\x89PNG\r\n\x1a\n"


def png(width=2, height=2, metadata=False):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    return (PNG_HEADER + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + (chunk(b"tEXt", b"private\x00must not be returned") if metadata else b"")
            + chunk(b"IDAT", zlib.compress(b"\0" + b"\x44\x88\xcc\xff" * 2
                                          + b"\0" + b"\x44\x88\xcc\xff" * 2))
            + chunk(b"IEND", b""))


def svg(trace="M10 20l5-5h5v10m10 10l-5-5", *, position="3 -4", image=None, extra=""):
    data = base64.b64encode(png(metadata=True) if image is None else image).decode()
    pos = "" if position is None else f'<use href="#d" x="{position.split()[0]}" y="{position.split()[1]}"/>'
    path = "" if trace is None else f'<path d="{trace}" fill="none" stroke="#fff" transform="scale(0.2-0.2)"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -20 100 80">'
            f'<defs><g id="d"><circle r="3.5"/></g><g id="c"><path d="M0 0z"/></g></defs>'
            f'<image x="-10" y="-20" width="100" height="80" href="data:image/png;base64,{data}"/>'
            f'{path}{pos}<use href="#c" x="-2" y="5"/>{extra}</svg>').encode()
