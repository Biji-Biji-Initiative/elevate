# Kajabi Integration Documentation

## Overview
Integration with Kajabi for automatic course completion tracking in MS Elevate LEAPS Tracker.

## Current Status
- Kajabi API is in **BETA** status as of 2024
- Limited webhook events available
- Course completion webhooks **NOT directly supported**

## Available Webhook Events
Based on research and documentation:
- `purchase.created` - When a purchase is made
- `purchase.refunded` - When a purchase is refunded
- `form.submitted` - When a form is submitted
- `contact.created` - When a new contact is created
- `contact.updated` - When contact information is updated

## Course Completion Workaround

Since Kajabi doesn't have native course completion webhooks, we need to implement a workaround:

### Option 1: Form-based Completion (Recommended)
1. Add a completion form at the end of each course
2. Configure webhook on form submission
3. Include student email and course completion data
4. Process webhook to award LEARN points

### Option 2: Assessment Integration
1. Use Kajabi assessments as completion markers
2. Configure form submission after assessment completion
3. Webhook triggers on assessment form submission

## Webhook Configuration

### Endpoint
```
POST /api/kajabi/webhook
```

### Authentication
- Shared secret validation via `X-Kajabi-Signature` header
- Environment variable: `KAJABI_WEBHOOK_SECRET`

### Expected Payload Structure
```json
{
  "event_type": "form.submitted",
  "event_id": "evt_123456789",
  "created_at": "2024-09-02T10:30:00Z",
  "data": {
    "form": {
      "id": "form_123",
      "name": "Course Completion Form",
      "site_id": "site_123"
    },
    "submission": {
      "id": "sub_123",
      "fields": {
        "email": "student@example.com",
        "course_name": "AI Foundations for Educators",
        "completion_date": "2024-09-02",
        "certificate_url": "https://...",
        "student_name": "John Doe"
      }
    }
  }
}
```

## Integration Requirements

### Environment Variables
```bash
KAJABI_WEBHOOK_SECRET=your-webhook-secret-here
KAJABI_API_KEY=your-api-key-here (if needed)
```

### Database Tracking
- Store all webhook events in `kajabi_events` table
- Prevent duplicate processing via `external_event_id`
- Match users by email (case-insensitive)
- Award points via `points_ledger` table

### Processing Logic
1. Validate webhook signature
2. Parse event payload
3. Match student email to existing user
4. Check for duplicate event processing
5. Award LEARN activity points (20 points)
6. Create audit log entry
7. Update user's submission status

## Implementation Steps

### 1. Webhook Endpoint
```typescript
// apps/web/app/api/kajabi/webhook/route.ts
export async function POST(request: Request) {
  // Validate signature
  // Parse payload
  // Process completion
  // Return 200 OK
}
```

### 2. Processing Function
```typescript
// packages/logic/kajabi-processor.ts
export async function processKajabiCompletion(event: KajabiEvent) {
  // User matching
  // Duplicate prevention
  // Points awarding
  // Audit logging
}
```

### 3. Email Matching Strategy
- Normalize emails to lowercase
- Handle common email variations
- Log unmatched submissions for manual review

## Testing Strategy

### Development
- Use ngrok to expose local webhook endpoint
- Configure test webhook in Kajabi sandbox
- Test with sample form submissions

### Production
- Configure webhook URL: `https://leaps.mereka.org/api/kajabi/webhook`
- Monitor webhook delivery success rates
- Set up alerting for failed processing

## Error Handling

### Webhook Failures
- Log all failed webhooks
- Implement retry mechanism
- Admin interface for manual processing

### User Matching Failures
- Store unmatched events for review
- Admin interface to manually link users
- Email notifications for unresolved matches

## Security Considerations

### Webhook Validation
```typescript
function validateKajabiSignature(payload: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.KAJABI_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Rate Limiting
- Implement rate limiting on webhook endpoint
- Prevent webhook spam attacks
- Use Redis for distributed rate limiting

## Monitoring and Analytics

### Metrics to Track
- Webhook delivery success rate
- User matching success rate
- Processing latency
- Duplicate event rate

### Alerting
- Failed webhook processing
- High unmatched user rate
- API quota warnings

## Fallback Plan

If webhooks fail:
1. Manual CSV import feature
2. Admin interface for bulk point awards
3. Email-based submission system
4. Integration with Google Sheets/Forms

## Future Enhancements

### When Kajabi Improves API
- Direct course completion webhooks
- Assessment result webhooks
- Progress tracking webhooks
- Bulk historical data import

### Additional Features
- Real-time completion notifications
- Automatic certificate validation
- Progress milestone webhooks
- Learning path tracking