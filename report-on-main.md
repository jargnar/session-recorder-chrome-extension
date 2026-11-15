# Session Report: Checkout demo

- **App:** http://localhost:5320
- **Date:** 2026-11-15T12:40:14.253Z
- **Duration:** 00:02
- **Verbosity level:** L1
- **Events:** 4

### Tabs

| Tab | Role | URL | Title |
| --- | --- | --- | --- |
| 211555449 | primary | http://localhost:5320/ | Checkout demo |

## Timeline

[00:00] 📷 Session start
![Session start](screenshots/001-0000.jpg)
[00:00] CLICK "Place order" (#order, tab 211555449)

⚠ **ERROR [00:00]** (log) Failed to load resource: the server responded with a status of 503 (Service Unavailable)

[00:00] 🌐 503 POST /api/orders
- Request (application/json):
```json
{"cart":"c1","total":120}
```
- Response (application/json):
```json
{"error":"payment_unavailable"}
```

## Appendix: Network Index

- [00:00] 503 POST http://localhost:5320/api/orders

## Appendix: Console Dump

```
[00:00] ERROR (log) Failed to load resource: the server responded with a status of 503 (Service Unavailable)
```
