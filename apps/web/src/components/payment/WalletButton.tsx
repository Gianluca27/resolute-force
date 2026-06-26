import { Wallet } from '@mercadopago/sdk-react';

export default function WalletButton({ preferenceId }: { preferenceId: string }) {
  return <div data-testid="wallet-button"><Wallet initialization={{ preferenceId }} /></div>;
}
