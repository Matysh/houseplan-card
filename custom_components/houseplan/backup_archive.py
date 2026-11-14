"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import backup_archive as _core
from .core.backup_archive import (
    _BLOB as _BLOB,
)
from .core.backup_archive import (
    _HASH as _HASH,
)
from .core.backup_archive import (
    _IMAGE_EXTS as _IMAGE_EXTS,
)
from .core.backup_archive import (
    _PLAN_SIGNATURES as _PLAN_SIGNATURES,
)
from .core.backup_archive import (
    _REASONS as _REASONS,
)
from .core.backup_archive import (
    _SVG_NAMESPACE as _SVG_NAMESPACE,
)
from .core.backup_archive import (
    ASSETS_DIR as ASSETS_DIR,
)
from .core.backup_archive import (
    CHUNK as CHUNK,
)
from .core.backup_archive import (
    FORMAT as FORMAT,
)
from .core.backup_archive import (
    MAX_ARCHIVE_BYTES as MAX_ARCHIVE_BYTES,
)
from .core.backup_archive import (
    MAX_CACHE_BYTES as MAX_CACHE_BYTES,
)
from .core.backup_archive import (
    MAX_DECOR_ASSET_BYTES as MAX_DECOR_ASSET_BYTES,
)
from .core.backup_archive import (
    MAX_ENTRIES as MAX_ENTRIES,
)
from .core.backup_archive import (
    MAX_EXPANDED_BYTES as MAX_EXPANDED_BYTES,
)
from .core.backup_archive import (
    MAX_EXPORT_BYTES as MAX_EXPORT_BYTES,
)
from .core.backup_archive import (
    MAX_FILE_BYTES as MAX_FILE_BYTES,
)
from .core.backup_archive import (
    MAX_MANIFEST_BYTES as MAX_MANIFEST_BYTES,
)
from .core.backup_archive import (
    MAX_PLAN_BYTES as MAX_PLAN_BYTES,
)
from .core.backup_archive import (
    PLAN_EXTENSIONS as PLAN_EXTENSIONS,
)
from .core.backup_archive import (
    VERSION as VERSION,
)
from .core.backup_archive import (
    Any as Any,
)
from .core.backup_archive import (
    ArchivePayload as ArchivePayload,
)
from .core.backup_archive import (
    Callable as Callable,
)
from .core.backup_archive import (
    DecorAssetError as DecorAssetError,
)
from .core.backup_archive import (
    ImageRef as ImageRef,
)
from .core.backup_archive import (
    ImportFailure as ImportFailure,
)
from .core.backup_archive import (
    Path as Path,
)
from .core.backup_archive import (
    _check_directory as _check_directory,
)
from .core.backup_archive import (
    _check_plan_svg as _check_plan_svg,
)
from .core.backup_archive import (
    _descriptor as _descriptor,
)
from .core.backup_archive import (
    _entry as _entry,
)
from .core.backup_archive import (
    _internal_path as _internal_path,
)
from .core.backup_archive import (
    _source_image as _source_image,
)
from .core.backup_archive import (
    _strict_object as _strict_object,
)
from .core.backup_archive import (
    _validate_info as _validate_info,
)
from .core.backup_archive import (
    build_archive as build_archive,
)
from .core.backup_archive import (
    dataclass as dataclass,
)
from .core.backup_archive import (
    digest as digest,
)
from .core.backup_archive import (
    expanded_size as expanded_size,
)
from .core.backup_archive import (
    expat as expat,
)
from .core.backup_archive import (
    fail as fail,
)
from .core.backup_archive import (
    hashlib as hashlib,
)
from .core.backup_archive import (
    image_refs as image_refs,
)
from .core.backup_archive import (
    json as json,
)
from .core.backup_archive import (
    json_bytes as json_bytes,
)
from .core.backup_archive import (
    os as os,
)
from .core.backup_archive import (
    parse_document as parse_document,
)
from .core.backup_archive import (
    parse_qsl as parse_qsl,
)
from .core.backup_archive import (
    plan_image_ext as plan_image_ext,
)
from .core.backup_archive import (
    re as re,
)
from .core.backup_archive import (
    read_archive as read_archive,
)
from .core.backup_archive import (
    ref_key as ref_key,
)
from .core.backup_archive import (
    safe_read as safe_read,
)
from .core.backup_archive import (
    stat as stat,
)
from .core.backup_archive import (
    strict_json as strict_json,
)
from .core.backup_archive import (
    strip_transport_credentials as strip_transport_credentials,
)
from .core.backup_archive import (
    struct as struct,
)
from .core.backup_archive import (
    urlencode as urlencode,
)
from .core.backup_archive import (
    urlsplit as urlsplit,
)
from .core.backup_archive import (
    urlunsplit as urlunsplit,
)
from .core.backup_archive import (
    validate_asset as validate_asset,
)
from .core.backup_archive import (
    validate_saved_topics as validate_saved_topics,
)
from .core.backup_archive import (
    zipfile as zipfile,
)
from .core.backup_archive import (
    zlib as zlib,
)

sys.modules[__name__] = _core
