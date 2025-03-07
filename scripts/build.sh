#!/bin/bash

# Style constants matching logger.ts aesthetics
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
INFO="💫"
SUCCESS="✨"
WARNING="⚠️"
ERROR="🚨"

# Logging functions
log_info() {
    echo -e "${BLUE}${INFO} [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}${SUCCESS} [SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}${WARNING} [WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}${ERROR} [ERROR]${NC} $1"
    exit 1
}

# Check for required tools
check_dependencies() {
    log_info "Checking build dependencies..."
    
    if ! command -v bun &> /dev/null; then
        log_error "Bun is required but not installed. Please install Bun first."
    fi

    if ! command -v tsc &> /dev/null; then
        log_error "TypeScript compiler is required but not installed. Please run: bun add -d typescript"
    fi
}

# Clean build artifacts
clean() {
    log_info "Cleaning build artifacts..."
    rm -rf dist
    rm -rf .tsbuildinfo
    log_success "Clean completed"
}

# Build TypeScript
build_typescript() {
    log_info "Building TypeScript..."
    
    # Ensure dist directory exists
    mkdir -p dist

    # Run TypeScript compiler
    if bun run tsc --project tsconfig.json; then
        log_success "TypeScript build completed"
    else
        log_error "TypeScript build failed"
    fi
}

# Copy necessary files
copy_assets() {
    log_info "Copying assets..."
    
    # Copy package.json (without dev dependencies and fix entry points)
    node -e "
        const pkg = require('./package.json');
        delete pkg.devDependencies;
        pkg.main = 'index.js';
        pkg.types = 'index.d.ts';
        require('fs').writeFileSync('dist/package.json', JSON.stringify(pkg, null, 2));
    "
    
    # Copy essential files
    cp README.md dist/
    cp .env.example dist/

    log_success "Assets copied"
}

# Main build process
main() {
    log_info "Starting build process..."
    
    check_dependencies
    clean
    build_typescript
    copy_assets
    
    log_success "Build completed successfully! 🎉"
}

main 