// Typed DOM lookups, element properties, events and services.
import { dialog, toast, theme, secureStorage, encryption, money, KlButton, type TransactionItem } from '../types/index.js';

const button = document.querySelector('kl-button')!;
const isButton: KlButton = button;
button.variant = 'outline';
button.loading = true;
button.disabled = false;
// @ts-expect-error: not a variant
button.variant = 'primary';

const select = document.createElement('kl-select');
select.placeholder = 'Choose a bank';
select.show();
const options: Element[] = select.options;

const amount = document.querySelector('kl-amount-input')!;
amount.currency = 'USD';
const minor: number | bigint | null = amount.minorUnits;
// @ts-expect-error: amounts are strings, never numbers
amount.value = 45000;

const tabs = document.querySelector('kl-tabs')!;
tabs.addEventListener('kl-change', (e) => {
  const value: string = (e as CustomEvent<{ value: string }>).detail.value;
});
document.querySelector('kl-otp-input')!.addEventListener('kl-complete', (e) => {
  const code: string = e.detail.value;
});

const list = document.querySelector('kl-transaction-list')!;
const item: TransactionItem = { title: 'Ada Obi', amount: '-45000', date: new Date() };
list.items = [item];

async function services() {
  const ok: boolean = await dialog.confirm({ title: 'Send?', tone: 'danger' });
  const name: string | null = await dialog.prompt({ title: 'Rename', label: 'Name' });
  const t = toast.success('Sent', { description: '₦45,000' });
  t.update({ tone: 'warning' });
  theme.set({ style: 'chorus', theme: 'dark' });
  const resolved: 'light' | 'dark' = theme.get().resolved;
  const store = await secureStorage.open('wallet', { passphrase: '2580', autoLock: 5 });
  await store.set('cards', [{ last4: '4242' }]);
  const key = await encryption.generateKey();
  const box = await encryption.encrypt(key, { a: 1 }, { aad: 'x' });
  const text: string = money.formatMoney('45000.5', { currency: 'NGN' });
  void [ok, name, resolved, box, text, isButton, options, minor];
}
void services;
