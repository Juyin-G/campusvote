// src/shared/providers/messagingProvider.js
// Interfaz de envío de mensajes (SMS/WhatsApp) para OTP y notificaciones.
// Implementación MOCK que registra el envío en el log; en producción se
// reemplaza por Twilio/WhatsApp Business/Conekta SMS sin tocar el resto.

export class MessagingProvider {
  // @returns Promise<{ messageId: string|null, delivered: boolean }>
  async sendSms(_phoneNumber, _message) {
    throw new Error('MessagingProvider.sendSms() no implementado');
  }
}

export class MockMessagingProvider extends MessagingProvider {
  constructor({ logger = null } = {}) {
    super();
    this.logger = logger;
  }

  async sendSms(phoneNumber, message) {
    const normalized = String(phoneNumber || '').replace(/[^0-9+]/g, '');
    if (!normalized || normalized.length < 9) {
      return { messageId: null, delivered: false };
    }
    if (this.logger) {
      this.logger.info('[mock-sms]', { phone: normalized.slice(0, 6) + '***', message });
    }
    return { messageId: `mock-${Date.now()}`, delivered: true };
  }
}

export default new MockMessagingProvider({ logger: console });