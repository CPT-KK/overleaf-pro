#!/bin/bash
# ---------------------------------------------------
# Local build script for overleaf-pro images
# Replicates the "build (linux/amd64, ubuntu-latest)"
# job from .github/workflows/build_release_image.yml
# ---------------------------------------------------
set -euo pipefail

# ---------- Configuration ----------
REGISTRY_IMAGE="overleaf-pro"
PLATFORM="linux/amd64"
ARCH="amd64"
NODE_IMAGE="node:22.18.0"
WEBPACK_DEV_IMAGE="ghcr.io/ayaka-notes/overleaf-pro/dev:webpack"
# -----------------------------------

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN[INFO]} $*${NC}"; }
ok()    { echo -e "${GREEN}[OK] $*${NC}"; }
warn()  { echo -e "${YELLOW}[WARN] $*${NC}"; }
err()   { echo -e "${RED}[ERROR] $*${NC}"; }

# ---- Parse arguments ----
SKIP_SYNC_LOCK=false
SKIP_TRANSLATIONS=false
PUSH=false
CUSTOM_TAG=""

usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --tag <tag>           Custom tag for the final image (default: auto-detect from branch)"
    echo "  --skip-sync-lock      Skip the package-lock.json sync step"
    echo "  --skip-translations   Skip the i18n translation extraction step"
    echo "  --push                Push images to registry after build"
    echo "  -h, --help            Show this help message"
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --tag)
            CUSTOM_TAG="$2"
            shift 2
            ;;
        --skip-sync-lock)
            SKIP_SYNC_LOCK=true
            shift
            ;;
        --skip-translations)
            SKIP_TRANSLATIONS=true
            shift
            ;;
        --push)
            PUSH=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            err "Unknown option: $1"
            usage
            ;;
    esac
done

# ---- Ensure we're in the project root ----
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f "server-ce/Dockerfile-base" || ! -f "server-ce/Dockerfile" ]]; then
    err "Cannot find server-ce/Dockerfile-base or server-ce/Dockerfile"
    err "Make sure you're running this from the project root."
    exit 1
fi

# ---- Resolve version ----
BRANCH_NAME="$(git rev-parse --abbrev-ref HEAD)"
MONOREPO_REVISION="$(git rev-parse HEAD)"

if [[ -n "$CUSTOM_TAG" ]]; then
    VERSION="$CUSTOM_TAG"
elif [[ "$BRANCH_NAME" == release-v* ]]; then
    VERSION="${BRANCH_NAME#release-v}"
else
    # Fallback: use short commit hash
    VERSION="dev-$(git rev-parse --short HEAD)"
    warn "Not on a release branch (current: $BRANCH_NAME), using version: $VERSION"
fi

BASE_TAG="${REGISTRY_IMAGE}-base:latest-${ARCH}-${MONOREPO_REVISION}-local"
APP_TAG="${REGISTRY_IMAGE}:${VERSION}-${ARCH}"

echo ""
echo "========================================"
echo "  Overleaf Pro - Local Build"
echo "========================================"
echo "  Branch:     $BRANCH_NAME"
echo "  Revision:   $MONOREPO_REVISION"
echo "  Version:    $VERSION"
echo "  Platform:   $PLATFORM"
echo "  Base tag:   $BASE_TAG"
echo "  App tag:    $APP_TAG"
echo "========================================"
echo ""

# ---- Step 1: Sync package-lock.json ----
if [[ "$SKIP_SYNC_LOCK" == false ]]; then
    info "Step 1/5: Syncing package-lock.json ..."
    docker run --rm \
        -v "$(pwd)":/workspace \
        -w /workspace \
        "$NODE_IMAGE" \
        npm install --package-lock-only --ignore-scripts
    ok "package-lock.json synced"
else
    warn "Step 1/5: Skipping package-lock.json sync (--skip-sync-lock)"
fi

# ---- Step 2: Extract translations ----
if [[ "$SKIP_TRANSLATIONS" == false ]]; then
    info "Step 2/5: Extracting translations ..."
    if docker image inspect "$WEBPACK_DEV_IMAGE" &>/dev/null || docker pull "$WEBPACK_DEV_IMAGE" &>/dev/null; then
        docker run --rm \
            -v "$(pwd)/services/web/":/overleaf/services/web \
            -w /overleaf/services/web \
            "$WEBPACK_DEV_IMAGE" \
            npm run extract-translations
        ok "Translations extracted"
    else
        warn "Could not pull $WEBPACK_DEV_IMAGE, skipping translations"
    fi
else
    warn "Step 2/5: Skipping translation extraction (--skip-translations)"
fi

# ---- Step 3: Prepare .dockerignore ----
info "Step 3/5: Preparing .dockerignore ..."
cp server-ce/.dockerignore ./.dockerignore
ok ".dockerignore copied"

# ---- Step 4: Build base image ----
info "Step 4/5: Building base image ..."
echo "  Dockerfile: server-ce/Dockerfile-base"
echo "  Tag:        $BASE_TAG"
echo ""
echo "  This may take a while on first run (installing TexLive, Node.js, etc.)"
echo ""

docker build \
    -f server-ce/Dockerfile-base \
    --platform "$PLATFORM" \
    -t "$BASE_TAG" \
    --provenance=false \
    .

ok "Base image built: $BASE_TAG"

# ---- Step 5: Build app image ----
info "Step 5/5: Building app image ..."
echo "  Dockerfile: server-ce/Dockerfile"
echo "  Base:       $BASE_TAG"
echo "  Tag:        $APP_TAG"
echo ""

docker build \
    -f server-ce/Dockerfile \
    --platform "$PLATFORM" \
    --build-arg "OVERLEAF_BASE_TAG=$BASE_TAG" \
    --label "com.overleaf.pro.revision=$MONOREPO_REVISION" \
    -t "$APP_TAG" \
    --provenance=false \
    .

ok "App image built: $APP_TAG"

# ---- Optional: Tag as latest and push ----
LATEST_TAG="${REGISTRY_IMAGE}:latest-${ARCH}"
docker tag "$APP_TAG" "$LATEST_TAG"
ok "Tagged as $LATEST_TAG"

if [[ "$PUSH" == true ]]; then
    info "Pushing images ..."
    docker push "$BASE_TAG" 2>/dev/null || warn "Could not push base image"
    docker push "$APP_TAG"  2>/dev/null || warn "Could not push app image"
    docker push "$LATEST_TAG" 2>/dev/null || warn "Could not push latest tag"
    ok "Images pushed"
fi

echo ""
echo "========================================"
echo "  Build Complete!"
echo "========================================"
echo ""
echo "  Images built:"
echo "    Base: $BASE_TAG"
echo "    App:  $APP_TAG"
echo "    Also: $LATEST_TAG"
echo ""
echo "  To test the image:"
echo "    docker run --rm -p 80:80 $APP_TAG"
echo ""
