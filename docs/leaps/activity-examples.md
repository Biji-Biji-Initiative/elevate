# Activity Examples — Requests/Responses

Kajabi webhook (200 duplicate)

```http
POST /api/kajabi/webhook
X-Webhook-Secret: ***
{
  "event_id": "abc123","created_at": "2025-01-02T03:04:05Z",
  "contact": {"id":"k_987","email":"user@example.com"},
  "tag": {"name":"elevate-ai-1-completed"}
}
-->
200 { "ok": true, "duplicate": true }
```

AMPlify approval (cap breach)

```json
{
  "type": "cap",
  "code": "CAP_PEERS_7D",
  "message": "Peers cap exceeded for the 7-day window.",
  "details": { "priorPeers": 38, "peers": 20, "cap": 50 }
}
```

Stats (Option B)

```json
{
  "educators_learning": 124,
  "peers_students_reached": 18250,
  "stories_shared": 211,
  "micro_credentials": 197,
  "mce_certified": 0
}
```

