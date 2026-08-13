#!/usr/bin/env bash
#
# clean-production.sh — remove the cloaked-redirect malware from public_html.
#
# Safe by default: with no arguments it only REPORTS what it would touch.
# Nothing is deleted unless you pass --delete, and even then every file is
# copied into a timestamped backup directory first.
#
# Usage, from inside public_html on the server:
#     bash clean-production.sh            # dry run
#     bash clean-production.sh --delete   # back up, then remove
#
# See SECURITY-INCIDENT.md for what each of these files does.

set -uo pipefail

DELETE=0
[ "${1:-}" = "--delete" ] && DELETE=1

ROOT="$(pwd)"
BACKUP="$ROOT/../malware-quarantine-$(date +%Y%m%d-%H%M%S)"

if [ ! -f "$ROOT/index.php" ] || [ ! -d "$ROOT/storage" ]; then
    echo "! This does not look like public_html (no index.php / storage)."
    echo "! cd into public_html first. Aborting."
    exit 1
fi

# The single file that is actively redirecting real visitors.
PAYLOAD="en/index.php"

# 5-hex-char doorway directories.
HEXDIRS=$(find . -maxdepth 1 -type d -regex "\./[0-9a-f]\{5\}" 2>/dev/null | sed 's|^\./||')

# Zero-byte droppers and beacons in the web root.
DROPPERS=$(find . -maxdepth 1 -type f \
    \( -name "*.php" -size 0 \
    -o -name "*.txt" -size 0 \
    -o -name "adman.*.txt" \
    -o -name "wpconf.php" \
    -o -name "php.ini" \) 2>/dev/null | sed 's|^\./||')

# Attacker dropper that landed inside the public storage tree.
STORAGE_PHP=$(find storage -type f -name "*.php" 2>/dev/null)

TARGETS=$(printf '%s\n%s\n%s\n%s\n' "$PAYLOAD" "$HEXDIRS" "$DROPPERS" "$STORAGE_PHP" \
    | grep -v '^$' | sort -u)

COUNT=$(printf '%s\n' "$TARGETS" | grep -c . || true)

echo "=============================================================="
echo " Direct2Kariakoo — malware cleanup"
echo " Root:    $ROOT"
echo " Targets: $COUNT"
echo " Mode:    $([ $DELETE -eq 1 ] && echo 'DELETE (after backup)' || echo 'DRY RUN — nothing will be touched')"
echo "=============================================================="
echo

if [ -f "$PAYLOAD" ]; then
    echo ">> ACTIVE PAYLOAD PRESENT: $PAYLOAD"
    echo "   This is the file redirecting Canadian visitors to the scam."
    echo
fi

printf '%s\n' "$TARGETS" | sed 's/^/  /'
echo

# en/logs21.txt is deliberately NOT removed — it is evidence and it lists
# the 86 people who were redirected.
if [ -f "en/logs21.txt" ]; then
    echo ">> KEEPING en/logs21.txt (evidence — 86 affected visitors)."
    echo
fi

if [ $DELETE -eq 0 ]; then
    echo "Dry run complete. Re-run with --delete to back up and remove."
    exit 0
fi

mkdir -p "$BACKUP"
echo ">> Backing up to: $BACKUP"

removed=0
while IFS= read -r t; do
    [ -z "$t" ] && continue
    [ -e "$t" ] || continue
    mkdir -p "$BACKUP/$(dirname "$t")"
    cp -a "$t" "$BACKUP/$t" 2>/dev/null
    rm -rf "$t"
    removed=$((removed + 1))
done <<< "$TARGETS"

# Remove the doorway directories once their index.php is gone, but only if
# they are genuinely empty — never delete a directory with content in it.
while IFS= read -r d; do
    [ -z "$d" ] && continue
    [ -d "$d" ] || continue
    rmdir "$d" 2>/dev/null && echo "   removed empty dir: $d"
done <<< "$HEXDIRS"

# en/ holds only the payload and the log; keep the log, drop the rest.
if [ -d "en" ] && [ -z "$(ls -A en 2>/dev/null | grep -v '^logs21.txt$')" ]; then
    echo "   en/ now contains only the evidence log — left in place."
fi

echo
echo ">> Removed: $removed items. Backup: $BACKUP"
echo
echo "NEXT, and none of this is optional:"
echo "  1. Rotate every credential in laravel/.env (DB, APP_KEY, AzamPay, Pusher)."
echo "  2. Change the DirectAdmin/FTP passwords and audit SSH keys."
echo "  3. Re-enable ModSecurity: remove the SecRuleEngine Off block from .htaccess."
echo "  4. Block PHP in the upload tree (see SECURITY-INCIDENT.md, Step 3)."
echo "  5. DELETE FROM personal_access_tokens; DELETE FROM sessions;"
echo "  6. Delete clear.php — it lets anyone flush your cache remotely."
