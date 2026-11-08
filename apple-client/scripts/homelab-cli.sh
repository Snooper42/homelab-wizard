# Sourced by the other scripts: finds the homelab command for the homelab
# in ~/Homelab (or $HOMELAB_ROOT) and puts it in the HOMELAB_CLI array.
# Returns 1 when there is none.

HOMELAB="${HOMELAB_ROOT:-$HOME/Homelab}"
HOMELAB_CLI=()

find_homelab_cli() {
  if [ -x "$HOMELAB/homelab" ]; then
    HOMELAB_CLI=("$HOMELAB/homelab" --no-color)
  elif [ -x "/Applications/Homelab Wizard.app/Contents/Helpers/homelab" ]; then
    HOMELAB_CLI=("/Applications/Homelab Wizard.app/Contents/Helpers/homelab" --no-color --root "$HOMELAB")
  else
    return 1
  fi
}

# The paired phones, one per line, as `homelab phone list` prints them:
#   <id>  <name>  <can>  <finances>  paired <date>  last seen <when|never>
phone_rows() {
  "${HOMELAB_CLI[@]}" phone list 2>/dev/null | grep -E '^  [0-9a-f]{6}  ' || true
}
