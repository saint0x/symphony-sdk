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

# Check environment
check_environment() {
    log_info "Checking environment..."
    
    # Check for .env file
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            log_warning "Created .env from .env.example - please update with your credentials"
        else
            log_error "No .env or .env.example file found"
        fi
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    if command -v bun &> /dev/null; then
        bun install || log_error "Failed to install dependencies with Bun"
    else
        npm install || log_error "Failed to install dependencies with npm"
    fi
    
    log_success "Dependencies installed"
}

# Setup git hooks
setup_git_hooks() {
    log_info "Setting up git hooks..."
    
    # Ensure .git directory exists
    if [ -d .git ]; then
        # Create pre-commit hook
        cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
bun run lint
bun run test
EOF
        chmod +x .git/hooks/pre-commit
        log_success "Git hooks configured"
    else
        log_warning "Not a git repository - skipping git hooks"
    fi
}

# Main setup process
main() {
    log_info "Starting setup process..."
    
    check_environment
    install_dependencies
    setup_git_hooks
    
    log_success "Setup completed successfully! 🎉"
    log_info "You can now start developing with 'bun run dev'"
}

main 