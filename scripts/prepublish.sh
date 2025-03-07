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

# Prepare the enchantment
main() {
    log_info "Beginning preparation..."
    
    log_info "Building package..."
    if bun run build; then
        log_success "Build completed successfully"
    else
        log_error "Build failed"
    fi
    
    log_success "Package is ready for publishing"
}

main 