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

# An uploaded plan that no accepted configuration references is collected only
# once it is this old. Age is a race guard, not a policy: a plan uploaded
# seconds ago may belong to another client's transaction that has not written
# its configuration yet (review R3-1).
PLAN_ORPHAN_TTL_S = 3600
FILES_DIR = "houseplan/files"
CONF_ADMIN_ONLY = "admin_only"
VERSION = "1.45.2"

DEFAULT_CONFIG: dict = {
    "spaces": [],
    "markers": [],
    "settings": {},
}
