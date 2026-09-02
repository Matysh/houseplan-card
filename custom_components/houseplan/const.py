"""Constants of the House Plan integration."""

DOMAIN = "houseplan"
STORAGE_KEY = f"{DOMAIN}.layout"
STORAGE_CONFIG_KEY = f"{DOMAIN}.config"
STORAGE_VIRTUAL_LIGHTS_KEY = f"{DOMAIN}.virtual_lights"
STORAGE_VERSION = 1
STORAGE_MINOR_VERSION = 2
FRONTEND_URL = "/houseplan_files/houseplan-card.js"
FRONTEND_ASSETS_URL = "/houseplan_files/houseplan-assets"
PLANS_URL = "/houseplan_files/plans"
PLANS_DIR = "houseplan/plans"  # relative to the HA configuration directory
FILES_URL = "/houseplan_files/files"
# authenticated read path (audit B1): /api/houseplan/content/<plans|files>/<sub>/<name>
CONTENT_URL = "/api/houseplan/content"

# How many paths one houseplan/content/sign call may carry. The card batches to
# the same number; a client that sends more used to get a partial answer with no
# way to tell which paths were dropped (review R2-2).
MAX_SIGN_PATHS = 200

# Nothing is ever deleted for being old (docs/SCOPE.md), so growth has to be
# stopped at the door instead. These bound the whole store, not one request: by
# default any authenticated user may upload, and a per-request cap of 8/50 MB
# says nothing about how many requests there are (HP-1470-01).
MAX_PLANS_BYTES = 256 * 1024 * 1024
MAX_PLANS_FILES = 200
# How many the picker asks for at once — newest first.
MAX_PLANS_LISTED = 60
MAX_FILES_BYTES = 1024 * 1024 * 1024
MAX_FILES_COUNT = 1000
# Refuse to write when the disk is nearly full: filling the config partition
# breaks .storage, the recorder and backups, not just this card.
MIN_FREE_BYTES = 512 * 1024 * 1024

# An uploaded plan that no accepted configuration references is collected only
# once it is this old. Age is a race guard, not a policy: a plan uploaded
# seconds ago may belong to another client's transaction that has not written
# its configuration yet (review R3-1).
PLAN_ORPHAN_TTL_S = 3600

# Kept for compatibility with anything reading it; the collectors no longer use
# a long grace at all. Every attempt to age files out ended badly — first by
# deleting detached plans, then by racing the save that was about to reference a
# retried upload. What is left is deliberately simple: files go when the user's
# action says so, plus staging folders after PLAN_ORPHAN_TTL_S.
SCHEDULED_GRACE_S = 30 * 24 * 3600
FILES_DIR = "houseplan/files"
CONF_ADMIN_ONLY = "admin_only"
VERSION = "1.70.0-beta.5"

# #43: the support transport is deliberately not configurable.  A user supplied
# URL would turn the integration into an SSRF proxy and make the privacy notice
# false.  The relay is deployed and operated by the project; changing it is a
# reviewed release change, not a Home Assistant option.
SUPPORT_RELAY_URL = "https://support.houseplan.tech/v1/reports"
SUPPORT_PREVIEW_TTL_S = 10 * 60
MAX_SUPPORT_PREVIEWS_PER_USER = 3
MAX_SUPPORT_PREVIEWS_TOTAL = 3
MAX_SUPPORT_ATTACHMENT_BYTES = 8 * 1024 * 1024
MAX_SUPPORT_MESSAGE_CODEPOINTS = 10_000
MAX_SUPPORT_CONTACT_CODEPOINTS = 320

# Portable backup format.  This is deliberately independent from the Home
# Assistant Store version above: storage migrations and files exported by a
# user have different compatibility lifecycles.
PLAN_MODEL_VERSION = 9
EXPORT_VERSION = 1
MAX_EXPORT_BYTES = 8 * 1024 * 1024
IMPORT_PREVIEW_TTL_S = 10 * 60
MAX_IMPORT_PREVIEWS_PER_USER = 3
# Parsed documents are larger than their wire representation.  Keep the
# original three-preview memory ceiling global as well as per user so turning
# off the admin-only policy cannot multiply it by the number of household
# accounts.
MAX_IMPORT_PREVIEWS_TOTAL = 3

DEFAULT_CONFIG: dict[str, object] = {
    "spaces": [],
    "markers": [],
    "settings": {"bg_mode": "daynight"},
}

# #42: THE stable public error-code contract. Every code a user-facing
# failure can carry — send_error literals, exception-class codes and the
# literal MarkerControlError codes — lives here; the scanner in
# tests_backend/test_backend_quality.py fails when a source emits a code
# outside this set (fail-closed), and every fixed code has a localized
# `backup.error.<code>` message on the frontend.
ERROR_CODES: frozenset[str] = frozenset({
    "capacity_exceeded", "commit_failed", "conflict",
    "content_confirmation_required", "duplicate_marker_control",
    "future_model", "in_use", "invalid_config", "invalid_content",
    "invalid_data", "invalid_format", "invalid_json", "invalid_layout",
    "invalid_light_entity", "invalid_marker_control", "invalid_name",
    "invalid_partition_opening_host",
    "invalid_partition_opening_jamb_margin", "invalid_passage_fields",
    "invalid_space_id", "invalid_toggle_entity", "invalid_value_badge",
    "invalid_value_badge_attribute", "invalid_value_badge_position",
    "invalid_value_badge_source", "invalid_value_source",
    "invalid_value_source_attribute", "io_error", "marker_control_cycle",
    "marker_control_missing", "marker_control_not_light",
    "marker_control_self", "missing_content", "missing_plan", "no_backup",
    "not_ready", "not_toggleable", "nothing_to_repair", "preview_expired",
    "preview_owner_mismatch", "space_in_use", "space_not_found",
    "support_invalid_message", "support_package_too_large",
    "support_preview_expired", "support_rate_limited", "support_rejected",
    "support_unavailable",
    "too_large", "unauthorized", "unsupported_export_version",
    "value_badge_source_required", "wall_model_client_outdated",
    "wall_model_migration_blocked",
})

# Template-code families: f-string codes carry one of these prefixes and are
# served by the generic per-code fallback on the frontend.
ERROR_CODE_FAMILIES: tuple[str, ...] = (
    "junction_limit_",
    "value_badge_",
    "value_source_",
)
