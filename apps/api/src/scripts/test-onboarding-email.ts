import { enviarCorreoOnboardingMasivo } from '../lib/email.js';
import { env } from '../config/env.js';

async function main() {
  const testEmail = 'jenfermz44@gmail.com';
  const testNombre = 'Jenfer';
  const mockToken = 'test-activation-token-12345';

  console.log(`🚀 Enviando modelo de correo de Onboarding a: ${testEmail}...`);

  // Parcheamos directamente el objeto env importado para engañar a la lógica de sendResendEmail
  (env as any).NODE_ENV = 'production';

  try {
    await enviarCorreoOnboardingMasivo(testNombre, testEmail, mockToken);
    console.log('✅ Correo enviado exitosamente.');
    console.log('---');
    console.log('Estructura definida en: apps/api/src/lib/email.ts');
    console.log('Función: enviarCorreoOnboardingMasivo');
  } catch (error) {
    console.error('❌ Error al enviar el correo:', error);
  }
}

main();
