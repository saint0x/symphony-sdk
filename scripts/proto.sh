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
    log_info "Checking proto dependencies..."
    
    if ! command -v protoc &> /dev/null; then
        log_error "protoc is required but not installed. Please install protobuf compiler."
    fi

    if ! command -v grpc_tools_node_protoc_plugin &> /dev/null; then
        log_warning "gRPC plugin not found, installing..."
        npm install -g grpc-tools || log_error "Failed to install gRPC tools"
    fi
}

# Clean proto artifacts
clean_proto() {
    log_info "Cleaning proto artifacts..."
    rm -rf src/proto/*.js src/proto/*.d.ts
    log_success "Proto artifacts cleaned"
}

# Compile proto files
compile_proto() {
    log_info "Compiling proto files..."
    
    # Ensure proto directory exists
    if [ ! -d "proto" ]; then
        log_error "Proto directory not found"
    fi

    # Compile each proto file
    for file in proto/*.proto; do
        if [ -f "$file" ]; then
            log_info "Compiling $(basename "$file")..."
            
            protoc \
                --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
                --ts_out=service=grpc-node,mode=grpc-js:./src/proto \
                --js_out=import_style=commonjs,binary:./src/proto \
                --grpc_out=grpc_js:./src/proto \
                -I ./proto \
                "$file" || log_error "Failed to compile $(basename "$file")"
        fi
    done
    
    log_success "Proto compilation completed"
}

# Analyze bundle size
analyze_bundle() {
    log_info "Analyzing bundle size..."
    
    # Get package size info
    DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
    PROTO_SIZE=$(du -sh src/proto 2>/dev/null | cut -f1)
    
    # Calculate dependencies size
    NODE_MODULES_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1)
    
    # Print size information with our logger style
    echo -e "\n${CYAN}Bundle Size Analysis${NC}"
    echo -e "${BLUE}├─ Distribution: ${NC}${DIST_SIZE}"
    echo -e "${BLUE}├─ Proto Files:  ${NC}${PROTO_SIZE}"
    echo -e "${BLUE}└─ Dependencies: ${NC}${NODE_MODULES_SIZE}"

    # Check for large dependencies
    log_info "Checking for large dependencies..."
    npm list --prod --parseable | while read -r pkg; do
        PKG_SIZE=$(du -sh "$pkg" 2>/dev/null | cut -f1)
        if [[ $PKG_SIZE == *"M"* ]]; then
            PKG_NAME=$(basename "$pkg")
            log_warning "Large package detected: ${PKG_NAME} (${PKG_SIZE})"
        fi
    done
}

# Run dependency audit
run_audit() {
    log_info "Running dependency audit..."
    
    # Run npm audit
    if npm audit --json > audit.json 2>/dev/null; then
        VULN_COUNT=$(jq '.metadata.vulnerabilities.total' audit.json 2>/dev/null || echo "0")
        if [ "$VULN_COUNT" -gt "0" ]; then
            log_warning "Found ${VULN_COUNT} vulnerabilities. Check audit.json for details."
        else
            log_success "No vulnerabilities found"
        fi
    else
        log_error "Audit failed"
    fi
    
    # Cleanup
    rm -f audit.json
}

# Main process
main() {
    log_info "Starting proto compilation and analysis..."
    
    check_dependencies
    clean_proto
    compile_proto
    analyze_bundle
    run_audit
    
    log_success "Proto compilation and analysis completed! 🎉"
}

main 