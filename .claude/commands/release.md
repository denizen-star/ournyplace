# Git Release & Versioning Task
Analyze the current changes and prepare a formal Git release.

## 1. Determine Version Bump:
- **Minor (0.1.0)**: New features, but backward compatible.
- **Major (1.0.0)**: Breaking changes or massive architectural shifts.
- **Patch (0.0.1)**: Bug fixes only.

## 2. Generate Release Notes:
- Summarize all commits since the last tag.
- Group by: Features, Fixes, and Internal.

## 3. Execute Commands:
Ask for permission to run:
1. `git add .`
2. `git commit -m "chore: release v[version]"`
3. `git tag -a v[version] -m "[Summary of changes]"`
4. `git push origin main --tags`
