#!/bin/bash

# Ralph - Autonomous Coding Loop for Tami-2
# Iteratively implements features from prd.json until all stories pass

set -e

RALPH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$RALPH_DIR/../.." && pwd)"
PRD_FILE="$RALPH_DIR/prd.json"
PROMPT_FILE="$RALPH_DIR/prompt.md"
PROGRESS_FILE="$RALPH_DIR/progress.txt"
LOG_DIR="$RALPH_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create logs directory
mkdir -p "$LOG_DIR"

# Log function
log() {
    local level=$1
    shift
    local msg="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] ${level}: $msg"
    echo "[$timestamp] ${level}: $msg" >> "$LOG_DIR/ralph.log"
}

# Count remaining stories
count_remaining() {
    jq '[.stories[] | select(.passes != true)] | length' "$PRD_FILE"
}

# Get next story to work on
get_next_story() {
    jq -r '[.stories[] | select(.passes != true)][0] // empty' "$PRD_FILE"
}

# Get story ID
get_story_id() {
    echo "$1" | jq -r '.id'
}

# Get story title
get_story_title() {
    echo "$1" | jq -r '.title'
}

# Mark story as passed
mark_story_passed() {
    local story_id=$1
    local tmp_file=$(mktemp)
    jq --arg id "$story_id" '
        .stories = [.stories[] | if .id == $id then .passes = true else . end]
    ' "$PRD_FILE" > "$tmp_file" && mv "$tmp_file" "$PRD_FILE"
    log "${GREEN}PASS${NC}" "Story $story_id marked as passed"
}

# Update progress file
update_progress() {
    local story_id=$1
    local status=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $story_id: $status" >> "$PROGRESS_FILE"
}

# Run Claude on a story
run_claude() {
    local story=$1
    local story_id=$(get_story_id "$story")
    local iteration_log="$LOG_DIR/iteration_${story_id}_$(date '+%Y%m%d_%H%M%S').log"

    log "${BLUE}START${NC}" "Working on story: $story_id"

    # Create context for Claude
    local context=$(cat <<EOF
## Current Story
$story

## Project PRD
$(cat "$PRD_FILE")

## Instructions
$(cat "$PROMPT_FILE")

## Previous Progress
$(tail -50 "$PROGRESS_FILE" 2>/dev/null || echo "No previous progress")
EOF
)

    # Run Claude Code
    echo "$context" | claude --print 2>&1 | tee "$iteration_log"

    return ${PIPESTATUS[1]}
}

# Main loop
main() {
    log "${GREEN}RALPH${NC}" "Starting autonomous coding loop"
    log "INFO" "Project root: $PROJECT_ROOT"
    log "INFO" "PRD file: $PRD_FILE"

    cd "$PROJECT_ROOT"

    local iteration=0
    local max_iterations=${MAX_ITERATIONS:-50}

    while true; do
        iteration=$((iteration + 1))
        local remaining=$(count_remaining)

        log "${YELLOW}ITER${NC}" "Iteration $iteration (Remaining stories: $remaining)"

        if [ "$remaining" -eq 0 ]; then
            log "${GREEN}DONE${NC}" "All stories completed!"
            break
        fi

        if [ "$iteration" -gt "$max_iterations" ]; then
            log "${RED}HALT${NC}" "Max iterations ($max_iterations) reached"
            break
        fi

        local story=$(get_next_story)
        local story_id=$(get_story_id "$story")
        local story_title=$(get_story_title "$story")

        log "INFO" "Next story: [$story_id] $story_title"
        update_progress "$story_id" "STARTED"

        # Run Claude to implement the story
        if run_claude "$story"; then
            log "${GREEN}SUCCESS${NC}" "Story $story_id implementation completed"
            update_progress "$story_id" "COMPLETED"

            # Ask user to verify or auto-mark as passed
            if [ "${AUTO_PASS:-false}" = "true" ]; then
                mark_story_passed "$story_id"
            else
                echo ""
                echo -e "${YELLOW}Story $story_id completed. Mark as passed? (y/n/s to skip)${NC}"
                read -r response
                case $response in
                    y|Y) mark_story_passed "$story_id" ;;
                    s|S) log "INFO" "Skipping story $story_id" ;;
                    *) log "INFO" "Keeping story $story_id as not passed" ;;
                esac
            fi
        else
            log "${RED}FAIL${NC}" "Story $story_id implementation failed"
            update_progress "$story_id" "FAILED"
        fi

        # Brief pause between iterations
        sleep 2
    done

    log "${GREEN}RALPH${NC}" "Coding loop finished"
    log "INFO" "Total iterations: $iteration"
    log "INFO" "Remaining stories: $(count_remaining)"
}

# Handle arguments
case "${1:-}" in
    --status)
        echo "Remaining stories: $(count_remaining)"
        jq -r '.stories[] | select(.passes != true) | "  - [\(.id)] \(.title)"' "$PRD_FILE"
        ;;
    --reset)
        jq '.stories = [.stories[] | del(.passes)]' "$PRD_FILE" > "$PRD_FILE.tmp" && mv "$PRD_FILE.tmp" "$PRD_FILE"
        echo "All stories reset to not passed"
        ;;
    --help)
        echo "Ralph - Autonomous Coding Loop"
        echo ""
        echo "Usage: ./ralph.sh [options]"
        echo ""
        echo "Options:"
        echo "  --status    Show remaining stories"
        echo "  --reset     Reset all stories to not passed"
        echo "  --help      Show this help"
        echo ""
        echo "Environment variables:"
        echo "  MAX_ITERATIONS  Maximum iterations (default: 50)"
        echo "  AUTO_PASS       Auto-mark stories as passed (default: false)"
        ;;
    *)
        main
        ;;
esac
