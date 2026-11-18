# DevToolkit

A personal collection of developer tools for AWS, data, shell scripting, and CI/CD guides.

## Projects

### AWS Tools

- **[CloudWatch Log Viewer](aws/cloud-watch_log-viewer.html)** - Interactive viewer for AWS CloudWatch logs with search and filtering capabilities. Supports keyword filtering with include/exclude tags.
- **[DynamoDB Table Cloner](aws/DynamoDB/)** - Clone DynamoDB tables with prefix, including schema, indexes, and data. Supports parallel scanning and retry logic.

### Data Tools

- **[CSV Diff Viewer](data/csv-diff-viewer.html)** - Side-by-side diff viewer for two CSV files. Highlights added, removed, and changed rows with dark/light theme support. Includes a column picker and CSV export for filtered data.
- **[normalizeToJson](data/normalize-to-json.html)** - Interactive demo for `normalizeToJson.js`. Converts loose object formats (Java/Kotlin toString, single-quoted, unquoted key-value, JAN code list, truncated strings) into valid JSON, with syntax highlighting and dark/light theme support.
- **[Crop & Overlay Multi-Frame](data/crop-and-overlay-multi-frame.html)** - Crop and overlay images across multiple frames in the browser, with a mobile-friendly layout.

### Shell Scripts

- **[Docker Monitor Daily Rotation](shell/docker_monitor_daily_rotation/)** - Bash script to monitor Docker container status, log output as JSON Lines, and auto-rotate logs daily with zip archiving. Designed to run via cron job.

### Guides

- **[Jenkins: Check Env (Secret File)](shell/jenkins-check-env.md)** - Guide to read the content of a Jenkins Secret file credential via Script Console (global or folder scope) without leaking it into build logs.

---

*Last updated: 2026-11-18*