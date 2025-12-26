#!/bin/bash
#
# deploy.sh - Master deployment script for Flow
# Deploys to Web (Vercel), Desktop (Tauri DMG), and iOS (TestFlight)
#

set -e
set -o pipefail

# ============================================
# CONFIGURATION
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Colors - disabled for compatibility, uncomment if your terminal supports them
# RED=$'\033[0;31m'
# GREEN=$'\033[0;32m'
# YELLOW=$'\033[1;33m'
# BLUE=$'\033[0;34m'
# CYAN=$'\033[0;36m'
# BOLD=$'\033[1m'
# NC=$'\033[0m'
RED=""
GREEN=""
YELLOW=""
BLUE=""
CYAN=""
BOLD=""
NC=""

# Deployment flags
DEPLOY_WEB=false
DEPLOY_DESKTOP=false
DEPLOY_IOS=false
SKIP_CHECKS=false
VERSION_BUMP_TYPE=""
NEW_VERSION=""
CURRENT_VERSION=""

# ============================================
# UTILITY FUNCTIONS
# ============================================
print_header() {
  echo ""
  printf "%s══════════════════════════════════════════════════════════%s\n" "$CYAN" "$NC"
  printf "%s  %s%s\n" "$CYAN" "$1" "$NC"
  printf "%s══════════════════════════════════════════════════════════%s\n" "$CYAN" "$NC"
  echo ""
}

print_step() {
  printf "%s▶ %s%s\n" "$BLUE" "$1" "$NC"
}

print_substep() {
  printf "  %s→ %s%s\n" "$BLUE" "$1" "$NC"
}

print_success() {
  printf "%s✓ %s%s\n" "$GREEN" "$1" "$NC"
}

print_error() {
  printf "%s✗ %s%s\n" "$RED" "$1" "$NC"
}

print_warning() {
  printf "%s⚠ %s%s\n" "$YELLOW" "$1" "$NC"
}

print_info() {
  printf "  %s\n" "$1"
}

# ============================================
# CLEANUP ON ERROR
# ============================================
cleanup() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    echo ""
    print_error "Deployment failed with exit code: $exit_code"
    print_info "You may need to manually revert version changes if any were made."
  fi
}

trap cleanup EXIT

# ============================================
# DEPENDENCY CHECK
# ============================================
check_dependencies() {
  print_step "Checking dependencies..."
  local missing=()

  command -v pnpm >/dev/null || missing+=("pnpm")
  command -v git >/dev/null || missing+=("git")
  command -v node >/dev/null || missing+=("node")

  if [[ "$DEPLOY_DESKTOP" == true ]]; then
    command -v cargo >/dev/null || missing+=("cargo (install Rust)")
  fi

  if [[ "$DEPLOY_IOS" == true ]]; then
    command -v xcodebuild >/dev/null || missing+=("xcodebuild (install Xcode)")
    command -v fastlane >/dev/null || missing+=("fastlane (brew install fastlane)")
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    print_error "Missing dependencies: ${missing[*]}"
    print_info "Install missing tools before proceeding."
    exit 1
  fi

  print_success "All dependencies found"
}

# ============================================
# VERSION MANAGEMENT
# ============================================
get_current_version() {
  node -p "require('$PROJECT_ROOT/package.json').version"
}

increment_version() {
  local version=$1
  local type=$2

  IFS='.' read -r major minor patch <<< "$version"

  case $type in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "$major.$((minor + 1)).0" ;;
    patch) echo "$major.$minor.$((patch + 1))" ;;
    *) echo "$version" ;;
  esac
}

update_all_versions() {
  local new_version=$1
  print_step "Updating all version files to $new_version..."

  # Update package.json files using node for safety
  for pkg in "$PROJECT_ROOT/package.json" \
             "$PROJECT_ROOT/apps/web/package.json" \
             "$PROJECT_ROOT/apps/desktop/package.json" \
             "$PROJECT_ROOT/apps/mobile/package.json"; do
    if [[ -f "$pkg" ]]; then
      node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('$pkg', 'utf8'));
        pkg.version = '$new_version';
        fs.writeFileSync('$pkg', JSON.stringify(pkg, null, 2) + '\n');
      "
      print_substep "Updated: $(basename $(dirname $pkg))/package.json"
    fi
  done

  # Update tauri.conf.json
  local tauri_conf="$PROJECT_ROOT/apps/desktop/src-tauri/tauri.conf.json"
  if [[ -f "$tauri_conf" ]]; then
    node -e "
      const fs = require('fs');
      const conf = JSON.parse(fs.readFileSync('$tauri_conf', 'utf8'));
      conf.package.version = '$new_version';
      fs.writeFileSync('$tauri_conf', JSON.stringify(conf, null, 2) + '\n');
    "
    print_substep "Updated: tauri.conf.json"
  fi

  # Update Cargo.toml
  local cargo_toml="$PROJECT_ROOT/apps/desktop/src-tauri/Cargo.toml"
  if [[ -f "$cargo_toml" ]]; then
    sed -i '' "s/^version = \".*\"/version = \"$new_version\"/" "$cargo_toml"
    print_substep "Updated: Cargo.toml"
  fi

  # Update iOS project.pbxproj (MARKETING_VERSION)
  local pbxproj="$PROJECT_ROOT/apps/mobile/ios/App/App.xcodeproj/project.pbxproj"
  if [[ -f "$pbxproj" ]]; then
    sed -i '' "s/MARKETING_VERSION = .*;/MARKETING_VERSION = $new_version;/g" "$pbxproj"
    print_substep "Updated: project.pbxproj (MARKETING_VERSION)"
  fi

  print_success "All versions updated to $new_version"
}

increment_ios_build_number() {
  local pbxproj="$PROJECT_ROOT/apps/mobile/ios/App/App.xcodeproj/project.pbxproj"

  if [[ ! -f "$pbxproj" ]]; then
    print_warning "project.pbxproj not found, skipping build number increment"
    return 0
  fi

  # Extract current build number (first occurrence)
  local current=$(grep -m1 "CURRENT_PROJECT_VERSION" "$pbxproj" | sed 's/.*= \([0-9]*\);/\1/')
  local new=$((current + 1))

  # Update all occurrences
  sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*;/CURRENT_PROJECT_VERSION = $new;/g" "$pbxproj"

  print_substep "iOS build number: $current → $new"
}

# ============================================
# PRE-DEPLOY CHECKS
# ============================================
run_pre_deploy_checks() {
  if [[ "$SKIP_CHECKS" == true ]]; then
    print_warning "Skipping pre-deploy checks (--skip-checks)"
    return 0
  fi

  print_step "Running pre-deploy checks..."

  print_substep "Running tests..."
  if ! pnpm test; then
    print_error "Tests failed"
    return 1
  fi

  print_substep "Running typecheck..."
  if ! pnpm typecheck; then
    print_error "Typecheck failed"
    return 1
  fi

  print_substep "Running lint..."
  if ! pnpm lint; then
    print_error "Lint failed"
    return 1
  fi

  print_success "All pre-deploy checks passed"
}

# ============================================
# PLATFORM DEPLOYERS
# ============================================
deploy_web() {
  print_header "Deploying Web (Vercel)"

  cd "$PROJECT_ROOT"

  # Check if there are changes to commit
  if [[ -n $(git status --porcelain) ]]; then
    print_substep "Staging changes..."
    git add -A

    print_substep "Creating release commit..."
    git commit -m "chore: release v${NEW_VERSION}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
  else
    print_warning "No changes to commit"
  fi

  print_substep "Pushing to main..."
  git push origin main

  print_success "Web deployment triggered!"
  print_info "Vercel will auto-deploy from main branch"
  print_info "Check: https://vercel.com/dashboard"
}

deploy_desktop() {
  print_header "Building Desktop (macOS DMG)"

  cd "$PROJECT_ROOT"

  print_substep "Building web export..."
  pnpm build:web:export

  print_substep "Building Tauri bundle..."
  cd "$PROJECT_ROOT/apps/desktop"
  pnpm build

  cd "$PROJECT_ROOT"

  # Find the DMG
  local dmg_dir="$PROJECT_ROOT/apps/desktop/src-tauri/target/release/bundle/dmg"
  local dmg_file

  if [[ -d "$dmg_dir" ]]; then
    dmg_file=$(ls "$dmg_dir"/*.dmg 2>/dev/null | head -1)
  fi

  if [[ -f "$dmg_file" ]]; then
    print_success "Desktop build complete!"
    print_info "DMG: $dmg_file"

    # Copy to Downloads folder
    cp "$dmg_file" ~/Downloads/
    print_info "Copied to: ~/Downloads/$(basename "$dmg_file")"
    print_info "Open the DMG from your Downloads folder to install"
  else
    print_warning "DMG not found at expected path"
    print_info "Check: $dmg_dir"
  fi
}

deploy_ios() {
  print_header "Building iOS (TestFlight)"

  cd "$PROJECT_ROOT"

  # Check if Fastlane is configured
  local fastlane_dir="$PROJECT_ROOT/apps/mobile/ios/fastlane"
  if [[ ! -d "$fastlane_dir" ]]; then
    print_error "Fastlane not configured!"
    print_info "Run: cd apps/mobile/ios && fastlane init"
    print_info "Then create Fastfile and Appfile as documented"
    return 1
  fi

  print_substep "Building web export..."
  pnpm build:web:export

  print_substep "Syncing Capacitor..."
  cd "$PROJECT_ROOT/apps/mobile"
  pnpm sync

  print_substep "Incrementing iOS build number..."
  cd "$PROJECT_ROOT"
  increment_ios_build_number

  print_substep "Building and uploading via Fastlane..."
  cd "$PROJECT_ROOT/apps/mobile/ios"
  fastlane beta

  print_success "iOS uploaded to TestFlight!"
  print_info "Check: https://appstoreconnect.apple.com/apps"
}

# ============================================
# INTERACTIVE MENU
# ============================================
show_menu() {
  print_header "Flow - Deployment"

  CURRENT_VERSION=$(get_current_version)
  printf "Current version: %s%s%s\n" "$BOLD" "$CURRENT_VERSION" "$NC"
  echo ""
  echo "Select deployment target:"
  printf "  %s1%s) Deploy ALL platforms\n" "$BOLD" "$NC"
  printf "  %s2%s) Deploy Web only\n" "$BOLD" "$NC"
  printf "  %s3%s) Deploy Desktop only\n" "$BOLD" "$NC"
  printf "  %s4%s) Deploy iOS only\n" "$BOLD" "$NC"
  printf "  %s5%s) Version bump only (no deploy)\n" "$BOLD" "$NC"
  printf "  %sq%s) Quit\n" "$BOLD" "$NC"
  echo ""
  read -p "Choice: " choice

  case $choice in
    1) DEPLOY_WEB=true; DEPLOY_DESKTOP=true; DEPLOY_IOS=true ;;
    2) DEPLOY_WEB=true ;;
    3) DEPLOY_DESKTOP=true ;;
    4) DEPLOY_IOS=true ;;
    5) ;; # Version bump only
    q|Q) echo "Cancelled."; exit 0 ;;
    *) print_error "Invalid choice"; exit 1 ;;
  esac
}

show_version_menu() {
  echo ""
  echo "Select version bump type:"
  printf "  %sp%s) Patch  (%s → %s)\n" "$BOLD" "$NC" "$CURRENT_VERSION" "$(increment_version $CURRENT_VERSION patch)"
  printf "  %sm%s) Minor  (%s → %s)\n" "$BOLD" "$NC" "$CURRENT_VERSION" "$(increment_version $CURRENT_VERSION minor)"
  printf "  %sM%s) Major  (%s → %s)\n" "$BOLD" "$NC" "$CURRENT_VERSION" "$(increment_version $CURRENT_VERSION major)"
  printf "  %ss%s) Skip   (keep %s)\n" "$BOLD" "$NC" "$CURRENT_VERSION"
  echo ""
  read -p "Choice: " choice

  case $choice in
    p) VERSION_BUMP_TYPE="patch" ;;
    m) VERSION_BUMP_TYPE="minor" ;;
    M) VERSION_BUMP_TYPE="major" ;;
    s) VERSION_BUMP_TYPE="" ;;
    *) print_error "Invalid choice"; exit 1 ;;
  esac
}

show_summary() {
  print_header "Deployment Complete!"

  printf "Version: %s%s%s\n" "$BOLD" "$NEW_VERSION" "$NC"
  echo ""

  if [[ "$DEPLOY_WEB" == true ]]; then
    print_info "Web: Vercel deploying from main branch"
  fi

  if [[ "$DEPLOY_DESKTOP" == true ]]; then
    print_info "Desktop: DMG available in ~/Downloads/"
  fi

  if [[ "$DEPLOY_IOS" == true ]]; then
    print_info "iOS: Check TestFlight in ~15 minutes"
  fi
}

# ============================================
# USAGE
# ============================================
show_usage() {
  echo "Usage: ./deploy.sh [options]"
  echo ""
  echo "Options:"
  echo "  --web           Deploy to Vercel (git push)"
  echo "  --desktop       Build macOS DMG"
  echo "  --ios           Upload to TestFlight"
  echo "  --all           Deploy all platforms"
  echo "  --skip-checks   Skip tests/lint/typecheck"
  echo "  --patch         Bump patch version (x.y.Z)"
  echo "  --minor         Bump minor version (x.Y.0)"
  echo "  --major         Bump major version (X.0.0)"
  echo "  -h, --help      Show this help"
  echo ""
  echo "Examples:"
  echo "  ./deploy.sh                    # Interactive mode"
  echo "  ./deploy.sh --all --patch      # Deploy all with patch bump"
  echo "  ./deploy.sh --web --minor      # Deploy web with minor bump"
  echo "  ./deploy.sh --desktop          # Build desktop only (no version bump)"
}

# ============================================
# MAIN
# ============================================
main() {
  cd "$PROJECT_ROOT"

  # Parse command-line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --web) DEPLOY_WEB=true; shift ;;
      --desktop) DEPLOY_DESKTOP=true; shift ;;
      --ios) DEPLOY_IOS=true; shift ;;
      --all) DEPLOY_WEB=true; DEPLOY_DESKTOP=true; DEPLOY_IOS=true; shift ;;
      --skip-checks) SKIP_CHECKS=true; shift ;;
      --patch) VERSION_BUMP_TYPE="patch"; shift ;;
      --minor) VERSION_BUMP_TYPE="minor"; shift ;;
      --major) VERSION_BUMP_TYPE="major"; shift ;;
      -h|--help) show_usage; exit 0 ;;
      *) print_error "Unknown option: $1"; show_usage; exit 1 ;;
    esac
  done

  # Get current version
  CURRENT_VERSION=$(get_current_version)

  # If no CLI args, show interactive menu
  if [[ "$DEPLOY_WEB" == false && "$DEPLOY_DESKTOP" == false && "$DEPLOY_IOS" == false && -z "$VERSION_BUMP_TYPE" ]]; then
    show_menu
    show_version_menu
  fi

  # Check dependencies based on selected platforms
  check_dependencies

  # Calculate new version
  if [[ -n "$VERSION_BUMP_TYPE" ]]; then
    NEW_VERSION=$(increment_version "$CURRENT_VERSION" "$VERSION_BUMP_TYPE")
  else
    NEW_VERSION="$CURRENT_VERSION"
  fi

  # Show confirmation
  echo ""
  print_step "Deployment Summary"
  print_info "Version: $CURRENT_VERSION → $NEW_VERSION"

  local platforms=""
  [[ "$DEPLOY_WEB" == true ]] && platforms+="Web "
  [[ "$DEPLOY_DESKTOP" == true ]] && platforms+="Desktop "
  [[ "$DEPLOY_IOS" == true ]] && platforms+="iOS "
  [[ -z "$platforms" ]] && platforms="(version bump only)"

  print_info "Platforms: $platforms"
  [[ "$SKIP_CHECKS" == true ]] && print_info "Pre-deploy checks: SKIPPED"
  echo ""

  read -p "Proceed? [y/N]: " confirm
  if [[ ! "$confirm" =~ ^[yY]$ ]]; then
    echo "Cancelled."
    exit 0
  fi

  # Run pre-deploy checks (if any platform is selected)
  if [[ "$DEPLOY_WEB" == true || "$DEPLOY_DESKTOP" == true || "$DEPLOY_IOS" == true ]]; then
    run_pre_deploy_checks
  fi

  # Update versions (if bumping)
  if [[ "$NEW_VERSION" != "$CURRENT_VERSION" ]]; then
    update_all_versions "$NEW_VERSION"
  fi

  # Deploy platforms (desktop and iOS first, web last since it commits)
  [[ "$DEPLOY_DESKTOP" == true ]] && deploy_desktop
  [[ "$DEPLOY_IOS" == true ]] && deploy_ios
  [[ "$DEPLOY_WEB" == true ]] && deploy_web

  # Show summary
  show_summary
}

main "$@"
