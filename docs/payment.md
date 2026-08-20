# Payment Architecture

## Status: Not Integrated

No payment provider is connected yet. The architecture is designed for future integration.

## Design

### PaymentProvider Interface

```typescript
interface PaymentProvider {
  name: string;
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
  verifyWebhook(payload, signature): Promise<WebhookVerificationResult>;
  queryTransaction(transactionId): Promise<PaymentResult>;
}
```

### PaymentService

Orchestrates payment flow using the registered PaymentProvider.

```
Checkout → PaymentService.initiatePayment() → PaymentProvider.createPayment()
                                                    ↓
                                            Payment Gateway (external)
                                                    ↓
Webhook → PaymentService.handleWebhook() → PaymentProvider.verifyWebhook()
                                                    ↓
                                        Update Order to PAID
                                        Generate Download Tokens
                                        Send Confirmation Email
```

### Files

- `src/features/payments/types.ts` — Payment types
- `src/features/payments/payment-provider.ts` — Abstract interface
- `src/features/payments/payment-service.ts` — Service orchestration
- `src/features/payments/providers/index.ts` — Provider registry
- `src/app/api/payments/webhook/route.ts` — Webhook endpoint

## Integration Steps

1. Choose a payment provider (VNPay, MoMo, ZaloPay, etc.)
2. Implement the `PaymentProvider` interface in `providers/`
3. Register the provider in `providers/index.ts`
4. Configure API keys in `.env.local`
5. Update the webhook route with provider-specific verification
6. Test with sandbox/test mode first

## Security Considerations

- Webhook signatures MUST be verified
- Transaction amounts MUST be cross-checked against the order
- Webhook handler MUST be idempotent
- Order status updates use service_role (bypasses RLS)
