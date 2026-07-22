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
FILES_DIR = "houseplan/files"
CONF_ADMIN_ONLY = "admin_only"
VERSION = "1.30.3"

DEFAULT_CONFIG: dict = {
    "spaces": [],
    "markers": [],
    "settings": {},
}
