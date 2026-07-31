"""Constants of the House Plan integration."""

DOMAIN = "houseplan"
STORAGE_KEY = f"{DOMAIN}.layout"
STORAGE_CONFIG_KEY = f"{DOMAIN}.config"
STORAGE_VERSION = 1
STORAGE_MINOR_VERSION = 1
FRONTEND_URL = "/houseplan_files/houseplan-card.js"
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
VERSION = "1.54.1"

DEFAULT_CONFIG: dict = {
    "spaces": [],
    "markers": [],
    "settings": {},
}
