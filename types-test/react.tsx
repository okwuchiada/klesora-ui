// React 19 JSX for Klesora elements.
import type {} from '../types/react.js';

export function Transfer() {
  return (
    <form>
      <kl-field>
        <label>Amount</label>
        <kl-amount-input name="amount" currency="NGN" min="100" required allow-negative={false}></kl-amount-input>
      </kl-field>
      <kl-tabs value="overview" onkl-change={(e) => console.log(e.detail.value)}>
        <div className="kl-tabs__list" />
      </kl-tabs>
      <kl-otp-input length={6} onkl-complete={(e) => console.log(e.detail.value)} />
      <kl-button variant="outline" size="sm" data-testid="pay" className="wide">Pay</kl-button>
      {/* @ts-expect-error: unknown variant */}
      <kl-button variant="primary">Nope</kl-button>
    </form>
  );
}
