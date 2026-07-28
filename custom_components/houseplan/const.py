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

# The scheduled sweep is a different judgement from a commit's. A commit knows
# it replaced a file; the timer only knows nobody points at one right now — and
# "nobody points at it" is a normal, reversible state. Detaching a plan (switch
# a space to "draw") leaves the image on disk on purpose, and re-attaching it
# later is a thing people do. On 2026-07-28 the hourly rule applied to that case
# and removed two plans the owner had detached weeks earlier; they were not
# recoverable. So the timer waits a month, and never touches a plan or an
# attachment that still belongs to something in the configuration.
SCHEDULED_GRACE_S = 30 * 24 * 3600
FILES_DIR = "houseplan/files"
CONF_ADMIN_ONLY = "admin_only"
VERSION = "1.46.5"

DEFAULT_CONFIG: dict = {
    "spaces": [],
    "markers": [],
    "settings": {},
}
