import hashlib
import io
import json
from pathlib import Path
from tempfile import NamedTemporaryFile


SOURCE_FORMATS = (".ttf", ".otf", ".woff2", ".woff")
WEB_FORMATS = (".woff2", ".woff")


def write_atomic(path, data):
    with NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        temporary_path.write_bytes(data)
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def convert_font(data, extension):
    try:
        from fontTools.ttLib import TTFont

        output = io.BytesIO()
        with TTFont(io.BytesIO(data), recalcTimestamp=False) as font:
            font.flavor = extension[1:]
            font.save(output)
    except ImportError as error:
        raise SystemExit(
            "FontTools with Brotli is required. Install it with "
            "python -m pip install -r requirements-fonts.txt."
        ) from error
    return output.getvalue()


def prepare_fonts(directory):
    families = {}
    for path in sorted(directory.iterdir()):
        extension = path.suffix.lower()
        if extension in SOURCE_FORMATS and path.is_file():
            families.setdefault(path.stem, {})[extension] = path

    output = directory / "generated"
    manifest = output / ".sources.json"
    try:
        previous = json.loads(manifest.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        previous = {}

    current = {}
    for name, files in families.items():
        preferred = next(files[extension] for extension in SOURCE_FORMATS if extension in files)
        output.mkdir(exist_ok=True)
        for extension in WEB_FORMATS:
            source = files.get(extension, preferred)
            target = output / f"{name}{extension}"
            data = source.read_bytes()
            checksum = hashlib.sha256(data).hexdigest()
            current[target.name] = checksum
            if previous.get(target.name) == checksum and target.is_file():
                continue

            if source.suffix.lower() != extension:
                data = convert_font(data, extension)
            write_atomic(target, data)
            print(f"Fonts: {source.name} -> generated/{target.name}")

    for stale in previous.keys() - current.keys():
        if Path(stale).name == stale and Path(stale).suffix in WEB_FORMATS:
            (output / stale).unlink(missing_ok=True)

    if not current:
        manifest.unlink(missing_ok=True)
    elif current != previous:
        write_atomic(manifest, json.dumps(current, indent=2).encode("utf-8"))


if __name__ == "__main__":
    prepare_fonts(Path(__file__).resolve().parents[1] / "src" / "fonts")
