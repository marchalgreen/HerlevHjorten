# Auto-Arrange/Omfordel Issue: Multiple Single-Player Courts

## Problem Description

When using the "Omfordel" (redistribute) button, the system sometimes produces invalid results:
- **Multiple courts with only 1 player each** (e.g., 3 courts with 1 player)
- **Many players left on the bench** (e.g., 6 players) when courts have available space
- This violates the core rules:
  - If total players is EVEN: ALL courts must be EVEN (no odd-numbered courts)
  - If total players is ODD: ONE court must be ODD, all others EVEN
  - Players should be assigned to courts when space is available

## Attempted Fixes (That Didn't Work)

### Fix 1: Removed Strategy 4 That Created 1-Player Courts
**Location:** `packages/webapp/src/api/index.ts` lines ~1098-1143

**What was changed:**
- Removed the code that created incomplete matches (1-player courts) as a "last resort"
- Replaced with logic to pair leftover players or add them to existing matches

**Why it didn't work:**
- The issue still persists, suggesting 1-player courts are being created elsewhere in the code
- Or the merge/redistribution logic isn't running correctly

### Fix 2: Added Merge Logic for Single-Player Courts
**Location:** `packages/webapp/src/api/index.ts` lines ~1207-1226

**What was changed:**
- Added a `while` loop that continuously merges single-player courts into 2-player courts
- Logic: Find all single-player courts, merge first two, repeat until at most 1 remains

**Why it didn't work:**
- The merge happens AFTER assignments are made, so it's reactive rather than preventive
- May not catch all cases if the merge logic has bugs
- The issue still occurs, suggesting either:
  - The merge isn't running
  - The merge isn't finding the single-player courts
  - The merge is being undone by subsequent logic

### Fix 3: Added Leftover Player Assignment Logic
**Location:** `packages/webapp/src/api/index.ts` lines ~1228-1286

**What was changed:**
- Added logic to assign leftover players to existing courts with space BEFORE merging
- Tries to add to courts with < 4 players first
- Falls back to pairing with other leftovers
- Last resort: adds to any court with space

**Why it didn't work:**
- The issue still persists, suggesting:
  - Leftover players aren't being detected correctly
  - The assignment logic isn't running
  - The assignment logic has conditions that prevent it from working
  - There's a race condition or ordering issue

### Fix 4: Fixed Redistribution Logic for Single-Player Courts
**Location:** `packages/webapp/src/api/index.ts` lines ~1330-1435

**What was changed:**
- Updated redistribution logic to handle single-player courts (not just courts with `length > 1`)
- Added logic to merge single-player courts with other single-player courts during redistribution

**Why it didn't work:**
- The redistribution only runs if there are multiple odd-numbered courts
- If single-player courts aren't being classified as "odd" correctly, they won't be fixed
- The redistribution may not be running at all if the conditions aren't met

## Root Cause Hypotheses

1. **1-Player Courts Are Created Earlier in the Code**
   - The main assignment loop (lines ~804-990) might be creating 1-player courts
   - The `createRandomSinglesMatch` function might be called with only 1 player
   - Edge cases in the while loop might leave single players unassigned

2. **Leftover Players Aren't Being Detected**
   - The `usedPlayerIds` Set might not be tracking all assigned players correctly
   - Players might be marked as "used" but not actually assigned to a court
   - The `leftoverPlayers` filter might be excluding players that should be assigned

3. **Merge Logic Runs But Gets Undone**
   - The merge might work, but subsequent redistribution logic might split courts again
   - The merge might happen, but then the assignments aren't properly saved/returned

4. **Ordering/Timing Issue**
   - The merge and leftover assignment might be running in the wrong order
   - The logic might need to run multiple passes to fully resolve the issue
   - There might be a dependency where one fix depends on another running first

5. **The Issue Occurs in a Different Code Path**
   - Maybe the issue only happens with specific parameters (locked courts, unavailable players, etc.)
   - Maybe it's related to the `isReshuffle` flag or `currentMatches` parameter
   - Maybe it's related to extended capacity courts

## What to Investigate Next

1. **Add Debug Logging**
   - Log when 1-player courts are created
   - Log when leftover players are detected
   - Log when merge logic runs and what it does
   - Log the state of assignments at each step

2. **Check the Main Assignment Loop**
   - Review lines ~804-990 carefully
   - Look for any code paths that could create 1-player courts
   - Check if `createRandomSinglesMatch` can be called with < 2 players

3. **Verify `usedPlayerIds` Tracking**
   - Ensure all assigned players are added to `usedPlayerIds`
   - Ensure `usedPlayerIds` is checked correctly when filtering leftovers

4. **Test with Specific Scenarios**
   - Test with exactly the scenario from the user (29 players, 20 men, 9 women)
   - Test with different numbers of players
   - Test with locked courts
   - Test with unavailable players

5. **Consider a Different Approach**
   - Instead of reactive fixes, prevent 1-player courts from being created in the first place
   - Ensure the main assignment loop never creates incomplete matches
   - Add validation that rejects any assignment with a 1-player court (unless total is odd and it's the only one)

## Related Code Locations

- Main function: `packages/webapp/src/api/index.ts` line 598 (`autoArrangeMatches`)
- Main assignment loop: lines ~804-990
- Leftover player handling: lines ~992-1145
- Merge logic: lines ~1207-1226
- Leftover assignment: lines ~1228-1286
- Redistribution logic: lines ~1288-1435
- Helper functions: `createRandomSinglesMatch` (line ~776), `createRandomDoublesMatch` (line ~755)

## Notes

- The user said "It doesn't happen often, but I've seen it happen sometimes" - this suggests it's an edge case, not a systematic issue
- The issue might be related to specific player counts, gender distributions, or other constraints
- Consider adding unit tests for the auto-arrange function to catch these edge cases

