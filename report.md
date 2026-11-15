# Session Report: Checkout demo

- **App:** http://localhost:5320
- **Date:** 2026-11-15T12:39:57.405Z
- **Duration:** 00:12
- **Verbosity level:** L1
- **Events:** 4

### Tabs

| Tab | Role | URL | Title |
| --- | --- | --- | --- |
| 211555295 | primary | http://localhost:5320/ | Checkout demo |

## Timeline

[00:00] 📷 Session start
![Session start](screenshots/001-0000.jpg)
[00:05] CLICK "Place order" (#order, tab 211555295)

⚠ **ERROR [00:05]** (log) Failed to load resource: the server responded with a status of 503 (Service Unavailable)

[00:05] 🌐 503 POST /api/orders
- response correlation IDs: `x-request-id: 732a9133-d39e-45cc-aef0-0d4068b3870e`
- request correlation IDs: `traceparent: 00-073898889e1e0386adb078038861e129-3cb60b24e2d71555-01`
- Request (application/json):
```json
{"cart":"c1","total":120}
```
- Response (application/json):
```json
{"error":"payment_unavailable"}
```

## Appendix: Network Index

- [00:05] 503 POST http://localhost:5320/api/orders

## Appendix: Console Dump

```
[00:05] ERROR (log) Failed to load resource: the server responded with a status of 503 (Service Unavailable)
```
