"""Compatibility import for canonical file lifecycle and filesystem primitives."""
import sys

from .core import plans as _core
from .core.plans import (
    QuotaError as QuotaError,
    atomic_write as atomic_write,
    attachment_refs as attachment_refs,
    check_quota as check_quota,
    collect_attachments as collect_attachments,
    collect_plans as collect_plans,
    is_plan_file as is_plan_file,
    plan_basename as plan_basename,
    plan_by_space as plan_by_space,
    plan_refs as plan_refs,
    read_bounded as read_bounded,
    reserve_filename as reserve_filename,
    store_plan_upload as store_plan_upload,
    sweep_upload_temps as sweep_upload_temps,
)

sys.modules[__name__] = _core
