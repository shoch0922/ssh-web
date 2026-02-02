#!/bin/bash

# SSH Web Terminal - Setup Script
# Supports: macOS and WSL2

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Emoji
CHECK="✓"
CROSS="✗"
INFO="ℹ"
ARROW="→"

print_header() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  SSH Web Terminal - Setup${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}${ARROW}${NC} $1"
}

print_success() {
    echo -e "${GREEN}${CHECK}${NC} $1"
}

print_error() {
    echo -e "${RED}${CROSS}${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}${INFO}${NC} $1"
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif grep -qEi "(Microsoft|WSL)" /proc/version &> /dev/null; then
        echo "wsl2"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unknown"
    fi
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js version
check_node_version() {
    if command_exists node; then
        local version=$(node -v | sed 's/v//')
        local major_version=$(echo $version | cut -d. -f1)
        if [ "$major_version" -ge 18 ]; then
            return 0
        fi
    fi
    return 1
}

# Install Homebrew (macOS only)
install_homebrew() {
    if ! command_exists brew; then
        print_step "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        print_success "Homebrew installed"
    else
        print_success "Homebrew already installed"
    fi
}

# Install dependencies on macOS
install_macos_deps() {
    print_step "Installing dependencies for macOS..."

    # Homebrew
    install_homebrew

    # Node.js
    if ! check_node_version; then
        print_step "Installing Node.js..."
        brew install node
        print_success "Node.js installed"
    else
        print_success "Node.js $(node -v) already installed"
    fi

    # tmux
    if ! command_exists tmux; then
        print_step "Installing tmux..."
        brew install tmux
        print_success "tmux installed"
    else
        print_success "tmux already installed"
    fi
}

# Install dependencies on WSL2/Linux
install_wsl2_deps() {
    print_step "Installing dependencies for WSL2/Linux..."

    # Update package list
    print_step "Updating package list..."
    sudo apt-get update -qq

    # Build tools
    if ! command_exists gcc || ! command_exists make; then
        print_step "Installing build-essential..."
        sudo apt-get install -y build-essential
        print_success "build-essential installed"
    else
        print_success "build-essential already installed"
    fi

    # Python3
    if ! command_exists python3; then
        print_step "Installing python3..."
        sudo apt-get install -y python3
        print_success "python3 installed"
    else
        print_success "python3 already installed"
    fi

    # Node.js
    if ! check_node_version; then
        print_step "Installing Node.js..."
        print_warning "Installing Node.js 20.x via NodeSource repository..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        print_success "Node.js installed"
    else
        print_success "Node.js $(node -v) already installed"
    fi

    # tmux
    if ! command_exists tmux; then
        print_step "Installing tmux..."
        sudo apt-get install -y tmux
        print_success "tmux installed"
    else
        print_success "tmux already installed"
    fi
}

# Install PM2 globally
install_pm2() {
    if ! command_exists pm2; then
        print_step "Installing PM2 globally..."
        npm install -g pm2
        print_success "PM2 installed"
    else
        print_success "PM2 already installed"
    fi
}

# Install npm dependencies
install_npm_deps() {
    print_step "Installing npm dependencies..."
    npm install
    print_success "npm dependencies installed"
}

# Verify installation
verify_installation() {
    echo ""
    print_step "Verifying installation..."
    echo ""

    local all_good=true

    # Node.js
    if check_node_version; then
        print_success "Node.js: $(node -v)"
    else
        print_error "Node.js: Not installed or version < 18"
        all_good=false
    fi

    # npm
    if command_exists npm; then
        print_success "npm: $(npm -v)"
    else
        print_error "npm: Not installed"
        all_good=false
    fi

    # tmux
    if command_exists tmux; then
        print_success "tmux: $(tmux -V)"
    else
        print_warning "tmux: Not installed (optional but recommended)"
    fi

    # PM2
    if command_exists pm2; then
        print_success "PM2: $(pm2 -v)"
    else
        print_warning "PM2: Not installed (optional, for production)"
    fi

    # Build tools
    if command_exists gcc && command_exists make; then
        print_success "Build tools: Available"
    else
        print_error "Build tools: Not available"
        all_good=false
    fi

    # Python3
    if command_exists python3; then
        print_success "Python3: $(python3 --version | cut -d' ' -f2)"
    else
        print_error "Python3: Not installed"
        all_good=false
    fi

    echo ""
    if [ "$all_good" = true ]; then
        print_success "All required dependencies are installed!"
    else
        print_error "Some required dependencies are missing"
        return 1
    fi
}

# Print next steps
print_next_steps() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${GREEN}Setup completed successfully!${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo ""
    echo "  Development mode:"
    echo -e "    ${BLUE}make dev${NC}     or     ${BLUE}npm run dev${NC}"
    echo ""
    echo "  Production mode (with PM2):"
    echo -e "    ${BLUE}make start${NC}   # Build and start with PM2"
    echo -e "    ${BLUE}make status${NC}  # Check PM2 status"
    echo -e "    ${BLUE}make logs${NC}    # View logs"
    echo ""
    echo "  Access the application:"
    echo -e "    Development: ${BLUE}http://localhost:3000${NC}"
    echo -e "    Production:  ${BLUE}http://localhost:50001${NC}"
    echo ""
}

# Main
main() {
    print_header

    # Detect OS
    OS=$(detect_os)
    print_step "Detected OS: $OS"
    echo ""

    case $OS in
        macos)
            install_macos_deps
            ;;
        wsl2|linux)
            install_wsl2_deps
            ;;
        *)
            print_error "Unsupported OS: $OSTYPE"
            exit 1
            ;;
    esac

    echo ""

    # Install PM2
    install_pm2

    echo ""

    # Install npm dependencies
    install_npm_deps

    # Verify installation
    verify_installation

    # Print next steps
    print_next_steps
}

# Run main
main
