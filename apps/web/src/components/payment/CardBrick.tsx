import { CardPayment } from '@mercadopago/sdk-react';

export interface CardFormData {
  token: string; installments: number; payment_method_id: string; issuer_id?: string;
  payer: { email: string; identification?: { type: string; number: string } };
}

export default function CardBrick({ amount, onPay }: { amount: number; onPay: (data: CardFormData) => Promise<void> }) {
  return (
    <div data-testid="card-brick">
      <CardPayment
        initialization={{ amount }}
        customization={{ visual: { style: { theme: 'dark' } } }}
        onSubmit={async (formData) => { await onPay(formData as unknown as CardFormData); }}
      />
    </div>
  );
}
