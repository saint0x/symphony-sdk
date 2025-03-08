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
    
    # Ensure dist directories exist
    mkdir -p dist/bin

    # Build CJS version (with types)
    log_info "Building CommonJS version..."
    if ! bun run tsc --project tsconfig.json; then
        log_error "CommonJS build failed"
    fi

    # Build ESM version
    log_info "Building ESM version..."
    if ! bun run tsc --project tsconfig.esm.json; then
        log_error "ESM build failed"
    fi

    # Build source code to binary
    log_info "Building source code..."
    if ! bun build ./src/index.ts --outdir ./dist/bin --target node; then
        log_error "Source code build failed"
    fi

    # Create proper file structure
    log_info "Creating final file structure..."
    
    # Move ESM files to their final location and rename to .mjs
    for file in $(find dist/esm -name "*.js"); do
        mv "$file" "${file%.js}.mjs"
        # Move corresponding source maps
        if [ -f "${file}.map" ]; then
            mv "${file}.map" "${file%.js}.mjs.map"
        fi
    done
    
    # Move files to match package.json exports
    mkdir -p dist/tools dist/agents dist/teams dist/pipelines
    
    # Move main files
    if [ -f dist/index.js ]; then
        # Move CJS files
        mv dist/index.js dist/
        mv dist/index.js.map dist/ 2>/dev/null || true
        
        # Move type definitions
        mv dist/index.d.ts dist/
        mv dist/index.d.ts.map dist/ 2>/dev/null || true
        
        # Move ESM files
        mv dist/esm/index.mjs dist/
        mv dist/esm/index.mjs.map dist/ 2>/dev/null || true
    fi
    
    # Move module files
    for module in tools agents teams pipelines; do
        if [ -f "dist/$module/index.js" ]; then
            # Move CJS files
            mv "dist/$module/index.js" "dist/$module/"
            mv "dist/$module/index.js.map" "dist/$module/" 2>/dev/null || true
            
            # Move type definitions
            mv "dist/$module/index.d.ts" "dist/$module/"
            mv "dist/$module/index.d.ts.map" "dist/$module/" 2>/dev/null || true
            
            # Move ESM files
            mv "dist/esm/$module/index.mjs" "dist/$module/"
            mv "dist/esm/$module/index.mjs.map" "dist/$module/" 2>/dev/null || true
        fi
    done

    # Clean up temporary ESM directory
    rm -rf dist/esm

    log_success "TypeScript build completed"
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