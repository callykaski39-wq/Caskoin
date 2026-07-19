import {
  BackpackWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from 'https://esm.sh/@solana/wallet-adapter-wallets@0.19.37';
import { WalletReadyState } from 'https://esm.sh/@solana/wallet-adapter-base@0.9.27';

const signupForm = document.querySelector('[data-signup-form]');
const formMessage = document.querySelector('[data-form-message]');

if (signupForm && formMessage) {
  signupForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!signupForm.checkValidity()) {
      signupForm.reportValidity();
      return;
    }

    const emailInput = signupForm.querySelector('input[type="email"]');
    formMessage.textContent = `Thanks — we'll keep ${emailInput.value} updated.`;
    signupForm.reset();
  });
}

// localStorage key used to remember which wallet the visitor chose across refreshes.
const WALLET_STORAGE_KEY = 'caskoin:selected-wallet';

// Supported Solana wallet adapters. These official adapters detect installed browser wallets.
const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
  new BackpackWalletAdapter(),
];

const walletState = {
  activeWallet: null,
  publicKey: null,
};

const connectButton = document.querySelector('[data-wallet-connect]');
const disconnectButton = document.querySelector('[data-wallet-disconnect]');
const walletMenu = document.querySelector('[data-wallet-menu]');
const walletOptions = document.querySelector('[data-wallet-options]');
const walletStatusDot = document.querySelector('[data-wallet-status-dot]');
const walletStatusText = document.querySelector('[data-wallet-status-text]');
const toastRegion = document.querySelector('[data-toast-region]');

// Render each supported wallet as an accessible menu item without changing the existing nav layout.
const renderWalletOptions = () => {
  if (!walletOptions) return;

  walletOptions.innerHTML = wallets
    .map((wallet) => `<button type="button" role="menuitem" data-wallet-name="${wallet.name}">${wallet.name}</button>`)
    .join('');
};

// Shorten a Solana public key for compact display in the top navigation.
const shortenAddress = (address) => `${address.slice(0, 4)}...${address.slice(-4)}`;

// Display small, branded toast messages for important wallet events.
const showToast = (message, variant = 'success') => {
  if (!toastRegion) return;

  const toast = document.createElement('div');
  toast.className = `toast ${variant}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  toastRegion.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add('is-hiding');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3400);
};

// Keep button text, status indicator, and disconnect affordance in sync with wallet state.
const updateWalletUi = () => {
  const isConnected = Boolean(walletState.publicKey);

  if (connectButton) {
    connectButton.textContent = isConnected ? shortenAddress(walletState.publicKey.toBase58()) : 'Connect Wallet';
    connectButton.setAttribute('aria-expanded', 'false');
  }

  if (disconnectButton) {
    disconnectButton.hidden = !isConnected;
  }

  if (walletMenu) {
    walletMenu.classList.remove('is-open');
  }

  if (walletStatusDot && walletStatusText) {
    walletStatusDot.classList.toggle('connected', isConnected);
    walletStatusText.textContent = isConnected ? 'Connected' : 'Not Connected';
  }
};

// Convert adapter errors into helpful user-facing notifications.
const getConnectionErrorMessage = (error, walletName) => {
  if (error?.name === 'WalletNotReadyError') return `${walletName} is not installed.`;
  if (error?.name === 'WalletConnectionError') return `Connection to ${walletName} failed.`;
  if (error?.name === 'WalletSignMessageError' || error?.message?.toLowerCase().includes('reject')) {
    return 'Connection request rejected.';
  }
  return 'Connection Failed';
};

const findWallet = (walletName) => wallets.find((wallet) => wallet.name === walletName);

// Connect to the selected adapter and persist that choice so refreshes can reconnect.
const connectWallet = async (walletName, { silent = false } = {}) => {
  if (!window.isSecureContext) {
    showToast('Unsupported browser: secure HTTPS context required.', 'error');
    return;
  }

  const wallet = findWallet(walletName);
  if (!wallet) {
    showToast('Unsupported wallet selected.', 'error');
    return;
  }

  if (wallet.readyState === WalletReadyState.Unsupported) {
    showToast(`${wallet.name} is not supported in this browser.`, 'error');
    return;
  }

  if (wallet.readyState === WalletReadyState.NotDetected) {
    showToast(`${wallet.name} is not installed.`, 'error');
    return;
  }

  try {
    if (walletState.activeWallet && walletState.activeWallet.name !== wallet.name) {
      await walletState.activeWallet.disconnect();
    }

    walletState.activeWallet = wallet;
    await wallet.connect();
    walletState.publicKey = wallet.publicKey;
    localStorage.setItem(WALLET_STORAGE_KEY, wallet.name);
    updateWalletUi();

    if (!silent) showToast('Wallet Connected');
  } catch (error) {
    console.error('Wallet connection failed:', error);
    walletState.activeWallet = null;
    walletState.publicKey = null;
    localStorage.removeItem(WALLET_STORAGE_KEY);
    updateWalletUi();
    if (!silent) showToast(getConnectionErrorMessage(error, wallet.name), 'error');
  }
};

// Disconnect the current wallet and clear the persisted wallet selection.
const disconnectWallet = async () => {
  try {
    if (walletState.activeWallet) await walletState.activeWallet.disconnect();
  } catch (error) {
    console.error('Wallet disconnect failed:', error);
  } finally {
    walletState.activeWallet = null;
    walletState.publicKey = null;
    localStorage.removeItem(WALLET_STORAGE_KEY);
    updateWalletUi();
    showToast('Wallet Disconnected');
  }
};

// Close the wallet menu when a user clicks elsewhere or presses Escape.
const closeWalletMenu = () => {
  walletMenu?.classList.remove('is-open');
  connectButton?.setAttribute('aria-expanded', 'false');
};

renderWalletOptions();
updateWalletUi();

connectButton?.addEventListener('click', () => {
  const isOpen = walletMenu?.classList.toggle('is-open');
  connectButton.setAttribute('aria-expanded', String(Boolean(isOpen)));
});

walletOptions?.addEventListener('click', (event) => {
  const selectedButton = event.target.closest('[data-wallet-name]');
  if (!selectedButton) return;
  closeWalletMenu();
  connectWallet(selectedButton.dataset.walletName);
});

disconnectButton?.addEventListener('click', () => {
  closeWalletMenu();
  disconnectWallet();
});

document.addEventListener('click', (event) => {
  if (!walletMenu?.contains(event.target)) closeWalletMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeWalletMenu();
});

// Reconnect after refresh when the visitor previously selected a wallet.
const storedWalletName = localStorage.getItem(WALLET_STORAGE_KEY);
if (storedWalletName) {
  connectWallet(storedWalletName, { silent: true });
}
