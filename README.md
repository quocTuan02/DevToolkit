# DevToolkit

A personal collection of developer tools for AWS, data, and shell scripting.

## Projects

### AWS Tools

- **[CloudWatch Log Viewer](aws/cloud-watch_log-viewer.html)** - Interactive viewer for AWS CloudWatch logs with search and filtering capabilities. Supports keyword filtering with include/exclude tags.
- **[DynamoDB Table Cloner](aws/DynamoDB/)** - Clone DynamoDB tables with prefix, including schema, indexes, and data. Supports parallel scanning and retry logic.

### Data Tools

- **[CSV Diff Viewer](data/csv-diff-viewer.html)** - Side-by-side diff viewer for two CSV files. Highlights added, removed, and changed rows with dark/light theme support.
- **[normalizeToJson Demo](data/normalize-to-json-demo.html)** - Interactive demo for `normalizeToJson.js`. Converts loose object formats (Java/Kotlin toString, single-quoted, unquoted key-value, JAN code list, truncated strings) into valid JSON, with syntax highlighting and dark/light theme support.

### Shell Scripts

- **[Docker Monitor Daily Rotation](shell/docker_monitor_daily_rotation/)** - Bash script to monitor Docker container status, log output as JSON Lines, and auto-rotate logs daily with zip archiving. Designed to run via cron job.

---

*Last updated: 2026-05-22*