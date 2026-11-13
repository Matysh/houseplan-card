"""Compatibility exports for the canonical plan core; no copied algorithms."""
import sys

from .core import decor_assets as _core
from .core.decor_assets import (
    _LENGTH as _LENGTH,
)
from .core.decor_assets import (
    _LOCAL_REF as _LOCAL_REF,
)
from .core.decor_assets import (
    _SVG_ATTRS as _SVG_ATTRS,
)
from .core.decor_assets import (
    _SVG_NAMESPACE as _SVG_NAMESPACE,
)
from .core.decor_assets import (
    _SVG_TAGS as _SVG_TAGS,
)
from .core.decor_assets import (
    _SVG_UNIT_INTERVAL_ATTRS as _SVG_UNIT_INTERVAL_ATTRS,
)
from .core.decor_assets import (
    ASSET_EXTENSIONS as ASSET_EXTENSIONS,
)
from .core.decor_assets import (
    ASSET_ID_RE as ASSET_ID_RE,
)
from .core.decor_assets import (
    CONTENT_URL as CONTENT_URL,
)
from .core.decor_assets import (
    ET as ET,
)
from .core.decor_assets import (
    EXT_BY_MIME as EXT_BY_MIME,
)
from .core.decor_assets import (
    MAX_DECOR_ASSET_BYTES as MAX_DECOR_ASSET_BYTES,
)
from .core.decor_assets import (
    MAX_RASTER_DIMENSION as MAX_RASTER_DIMENSION,
)
from .core.decor_assets import (
    MAX_RASTER_PIXELS as MAX_RASTER_PIXELS,
)
from .core.decor_assets import (
    MAX_SVG_ATTR_CHARS as MAX_SVG_ATTR_CHARS,
)
from .core.decor_assets import (
    MAX_SVG_ATTR_VALUE_CHARS as MAX_SVG_ATTR_VALUE_CHARS,
)
from .core.decor_assets import (
    MAX_SVG_DEPTH as MAX_SVG_DEPTH,
)
from .core.decor_assets import (
    MAX_SVG_ELEMENTS as MAX_SVG_ELEMENTS,
)
from .core.decor_assets import (
    MAX_SVG_REF_DEPTH as MAX_SVG_REF_DEPTH,
)
from .core.decor_assets import (
    MIME_BY_EXT as MIME_BY_EXT,
)
from .core.decor_assets import (
    Any as Any,
)
from .core.decor_assets import (
    DecorAssetError as DecorAssetError,
)
from .core.decor_assets import (
    Iterator as Iterator,
)
from .core.decor_assets import (
    Path as Path,
)
from .core.decor_assets import (
    ValidatedAsset as ValidatedAsset,
)
from .core.decor_assets import (
    _check_size as _check_size,
)
from .core.decor_assets import (
    _physical_asset_inventory as _physical_asset_inventory,
)
from .core.decor_assets import (
    _raster_dimensions as _raster_dimensions,
)
from .core.decor_assets import (
    _read_catalog_row as _read_catalog_row,
)
from .core.decor_assets import (
    _reject_svg_declarations as _reject_svg_declarations,
)
from .core.decor_assets import (
    _svg_number as _svg_number,
)
from .core.decor_assets import (
    _validate_dimensions as _validate_dimensions,
)
from .core.decor_assets import (
    _validate_svg as _validate_svg,
)
from .core.decor_assets import (
    _validate_svg_unit_interval as _validate_svg_unit_interval,
)
from .core.decor_assets import (
    _walk_reference_graph as _walk_reference_graph,
)
from .core.decor_assets import (
    asset_meta_path as asset_meta_path,
)
from .core.decor_assets import (
    asset_refs as asset_refs,
)
from .core.decor_assets import (
    dataclass as dataclass,
)
from .core.decor_assets import (
    expat as expat,
)
from .core.decor_assets import (
    hashlib as hashlib,
)
from .core.decor_assets import (
    json as json,
)
from .core.decor_assets import (
    math as math,
)
from .core.decor_assets import (
    physical_asset_blobs as physical_asset_blobs,
)
from .core.decor_assets import (
    physical_asset_usage as physical_asset_usage,
)
from .core.decor_assets import (
    public_asset as public_asset,
)
from .core.decor_assets import (
    re as re,
)
from .core.decor_assets import (
    read_asset as read_asset,
)
from .core.decor_assets import (
    read_catalog as read_catalog,
)
from .core.decor_assets import (
    stat as stat,
)
from .core.decor_assets import (
    struct as struct,
)
from .core.decor_assets import (
    validate_asset as validate_asset,
)

sys.modules[__name__] = _core
