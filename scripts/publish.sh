#!/bin/bash

# Color palette matching logger.ts
MAIN_BLUE='\033[38;2;95;173;235m'     # #5FADEB
SECONDARY_BLUE='\033[38;2;74;155;217m' # #4A9BD9
WHITE='\033[38;2;255;255;255m'        # #FFFFFF
LIGHT_GRAY='\033[38;2;204;204;204m'   # #CCCCCC
DIM_GRAY='\033[38;2;128;128;128m'     # #808080
SUCCESS='\033[38;2;78;201;176m'       # #4EC9B0
WARN='\033[38;2;204;167;0m'          # #CCA700
ERROR='\033[38;2;241;76;76m'         # #F14C4C
NC='\033[0m'

# Modern, minimal indicators
INFO='│'
SUCCESS_ICON='✓'
WARN_ICON='!'
ERROR_ICON='✕'
DEBUG_ICON='›'
TRACE_ICON='·'

# Symphonic logging
log_info() {
    echo -e "${WHITE}${INFO} $1${NC}"
}

log_success() {
    echo -e "${SUCCESS}${SUCCESS_ICON} $1${NC}"
}

log_warn() {
    echo -e "${WARN}${WARN_ICON} $1${NC}"
}

log_error() {
    echo -e "${ERROR}${ERROR_ICON} $1${NC}"
    exit 1
}

# Clean build artifacts
clean() {
    log_info "Cleaning build artifacts..."
    rm -rf dist
    log_success "Clean completed"
}

# Build package
build_package() {
    log_info "Building package..."
    
    if bun run build; then
        log_success "Build completed successfully"
    else
        log_error "Build failed"
    fi
}

# Check version availability
check_version() {
    log_info "Checking version availability..."
    
    local version=$(node -p "require('./package.json').version")
    if npm view symphonic@$version version &> /dev/null; then
        log_error "Version $version already exists. Please bump version in package.json"
    else
        log_success "Version $version is available"
    fi
}

# Publish to npm
publish_package() {
    log_info "Publishing to npm..."
    
    # Check login status
    if ! npm whoami &> /dev/null; then
        log_error "Not logged in to npm. Please run 'npm login' first."
    fi
    
    # Publish directly with npm to avoid script loop
    if npm publish --access public; then
        log_success "Package published successfully"
    else
        log_error "Failed to publish package"
    fi
}

# Main process
main() {
    log_info "Starting publish process for ${MAIN_BLUE}symphonic${NC}..."
    
    clean
    check_version
    build_package
    publish_package
    
    log_success "Publish completed successfully"
}

main 