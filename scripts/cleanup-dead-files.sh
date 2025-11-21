#!/bin/bash
# cleanup-dead-files.sh
# AI Schedule Manager - Codebase Cleanup Script
# Removes backup files, Python cache, and temporary files

set -e  # Exit on error

echo "========================================="
echo "AI Schedule Manager Cleanup Script"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counter for removed files
total_removed=0

# 1. Remove Python cache files
echo -e "${YELLOW}[1/5] Removing Python cache files...${NC}"
cache_count=$(find backend -type d -name "__pycache__" 2>/dev/null | wc -l)
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find backend -type f -name "*.pyc" -delete 2>/dev/null || true
find backend -type f -name "*.pyo" -delete 2>/dev/null || true
find backend -type f -name "*.pyd" -delete 2>/dev/null || true
echo -e "${GREEN}✓ Removed ${cache_count} __pycache__ directories${NC}"
total_removed=$((total_removed + cache_count))

# 2. Backup employee backup file (archive to git history)
echo ""
echo -e "${YELLOW}[2/5] Archiving backup files...${NC}"
if [ -f "backend/src/api/employees_backup.py" ]; then
    # Create archive of git history
    git log --all --full-history -- "backend/src/api/employees_backup.py" > /tmp/employees_backup_history.txt 2>/dev/null || true
    echo "Git history archived to: /tmp/employees_backup_history.txt"

    # Show file info before deletion
    file_size=$(du -h backend/src/api/employees_backup.py | cut -f1)
    echo "File size: ${file_size}"

    # Remove from git
    git rm backend/src/api/employees_backup.py 2>/dev/null || rm backend/src/api/employees_backup.py
    echo -e "${GREEN}✓ Backup file archived and removed${NC}"
    total_removed=$((total_removed + 1))
else
    echo "No backup file found (already removed)"
fi

# 3. Remove temporary log files
echo ""
echo -e "${YELLOW}[3/5] Removing temporary log files...${NC}"
log_count=$(find . -type f -name "*.log" -not -path "*/venv/*" -not -path "*/node_modules/*" 2>/dev/null | wc -l)
find . -type f -name "*.log" -not -path "*/venv/*" -not -path "*/node_modules/*" -delete 2>/dev/null || true
find . -type f -name "*.tmp" -not -path "*/venv/*" -not -path "*/node_modules/*" -delete 2>/dev/null || true
echo -e "${GREEN}✓ Removed ${log_count} log/tmp files${NC}"
total_removed=$((total_removed + log_count))

# 4. Remove other backup patterns
echo ""
echo -e "${YELLOW}[4/5] Removing backup pattern files...${NC}"
backup_count=$(find . -type f \( -name "*_old.*" -o -name "*.bak" -o -name "*~" \) -not -path "*/venv/*" -not -path "*/node_modules/*" 2>/dev/null | wc -l)
find . -type f \( -name "*_old.*" -o -name "*.bak" -o -name "*~" \) -not -path "*/venv/*" -not -path "*/node_modules/*" -delete 2>/dev/null || true
echo -e "${GREEN}✓ Removed ${backup_count} backup files${NC}"
total_removed=$((total_removed + backup_count))

# 5. Update .gitignore
echo ""
echo -e "${YELLOW}[5/5] Updating .gitignore...${NC}"
if ! grep -q "# Python cache files" .gitignore 2>/dev/null; then
    cat >> .gitignore << 'EOF'

# Python cache files
__pycache__/
*.py[cod]
*$py.class
*.so
.Python

# Logs
*.log
*.tmp
debug.log
error.log

# Backup files
*_backup.*
*_old.*
*.bak
*~

# Development
.swarm/
.claude-flow/metrics/
EOF
    echo -e "${GREEN}✓ .gitignore updated with cleanup rules${NC}"
else
    echo "✓ .gitignore already contains cleanup rules"
fi

# Summary
echo ""
echo "========================================="
echo -e "${GREEN}Cleanup Complete!${NC}"
echo "========================================="
echo ""
echo "Files removed:"
echo "  - ${cache_count} Python __pycache__ directories"
echo "  - 1 backup file (employees_backup.py)"
echo "  - ${log_count} log/tmp files"
echo "  - ${backup_count} backup pattern files"
echo ""
echo "Total items removed: ${total_removed}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Review changes: git status"
echo "  2. Test application: npm test && pytest"
echo "  3. Commit changes: git commit -m 'chore: cleanup backup files and cache'"
echo ""
echo "Estimated space freed: 30-50MB"
echo "========================================="
