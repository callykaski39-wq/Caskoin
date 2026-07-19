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
