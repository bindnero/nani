# UI/UX Design Specification

## 1. Visual direction
A polished developer workspace inspired by modern coding tools: restrained dark-first palette with optional light theme, compact typography, clear hierarchy, subtle borders, limited animation, and no copied logos or proprietary assets. Use real app state for all status indicators.

## 2. Main window layout
- **Left sidebar:** Workspace, Sessions, Skills, Settings.
- **Header:** current project name/path, CLI readiness indicator, session state.
- **Center panel:** conversation/output stream and prompt composer.
- **Optional right panel:** structured activity/tool events only when the CLI exposes them reliably.
- **Bottom drawer:** stdout/stderr terminal view, diagnostics, and errors.
- **Status strip:** actual process state and available verified metadata. Hide token/cost widgets when no trustworthy data is available.

## 3. Workspace
- Native folder picker.
- Selected path visible and copyable.
- Empty state explains how to choose a project.
- Prompt composer supports multiline input and keyboard shortcuts that are discoverable and documented.
- Send and Stop controls have clear labels, accessible focus, and safe enabled/disabled states.
- Streaming output should not jump unexpectedly when the user scrolls up to inspect prior output.
- Provide “scroll to latest”, “copy output”, and “clear view” controls where practical.

## 4. Onboarding states
1. **Checking:** concise progress indication tied to an actual check.
2. **CLI missing:** official installation guidance and Check Again.
3. **CLI detected:** display version/path when available; separately indicate whether authentication/provider readiness has been verified.
4. **Ready:** explain how to select a project and start a session.
5. **Error:** show actual error, likely cause if known, and next action.

## 5. Settings
- Provider route selector with only verified supported routes selectable.
- Omni-Company should appear only as “Integration pending details” until its URL/repository is supplied and reviewed.
- Secret inputs are masked; reveal is temporary and user-triggered.
- Show config diff and backup path before applying changes.
- Cancel should leave the original configuration unchanged.
- Test Connection must show the real check result and time, not a green status by default.

## 6. Skills Manager
- List view with skill name, source, compatibility status, and enabled state only if meaningful.
- Detail view shows metadata, files, and validation warnings.
- Import flow previews contents and possible overwrites.
- Destructive actions require confirmation.
- Clear notice that scripts are not executed on import.

## 7. States to design explicitly
- First launch; CLI absent; CLI found; provider not configured; invalid project path.
- Starting; running; stopping; completed; failed.
- Empty output; long output; stderr warning; malformed structured output.
- Permission denied; process spawn failure; cancellation timeout.
- Skills empty; invalid skill; duplicate; unsafe archive; overwrite confirmation.
- Configuration preview; backup failure; verification failure; rollback.

## 8. Accessibility and interaction
- Keyboard navigation for all primary actions.
- Visible focus rings and proper semantic labels.
- Status changes announced without excessively interrupting screen readers.
- Contrast checked in both themes.
- Never rely on color alone to communicate success/failure.
- Layout remains usable at narrow window sizes; Stop and error details must remain accessible.
