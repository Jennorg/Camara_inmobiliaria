import { enviarCorreoOnboardingMasivo } from '../lib/email.js';
import { env } from '../config/env.js';

async function main() {
  const testEmail = process.argv[2] || 'jenfermz44@gmail.com';
  const testNombre = 'Usuario de Prueba';
  const mockToken = 'test-activation-token-12345';

  console.log('--------------------------------------------------');
  console.log(`🚀 Preparando envío de correo de prueba de Onboarding`);
  console.log(`📧 Destinatario: ${testEmail}`);
  console.log('--------------------------------------------------');

  // Parcheamos directamente el objeto env importado para engañar a la lógica de sendResendEmail
  // y asegurar que se envíe realmente si estamos probando (si no, Resend lo mockea en dev)
  (env as any).NODE_ENV = 'production';

  if (!env.RESEND_API_KEY) {
    console.error('❌ Error: RESEND_API_KEY no está configurada en el entorno.');
    return;
  }

  try {
    await enviarCorreoOnboardingMasivo(testNombre, testEmail, mockToken);
    console.log('\n✅ Correo enviado exitosamente a ' + testEmail);
    console.log('👉 Revisa tu bandeja de entrada (y la carpeta de spam).');
  } catch (error) {
    console.error('\n❌ Error al enviar el correo:', error);
  }
}

main();
