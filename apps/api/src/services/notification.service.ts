import { db } from '../lib/db.js';
import { Resend } from 'resend';
import { env } from '../config/env.js';

/**
 * Tipos de canales soportados por el sistema.
 */
export type NotificationChannelType = 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';

/**
 * Interfaz para un canal de notificación.
 */
interface NotificationChannel {
  send(params: NotificationParams): Promise<boolean>;
}

/**
 * Parámetros para enviar una notificación.
 */
export interface NotificationParams {
  userId: number;
  title: string;
  message: string;
  type?: string;
  priority?: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';
  data?: Record<string, any>;
  channels?: NotificationChannelType[];
  emailConfig?: {
    subject?: string;
    template?: string;
  };
}

/**
 * Canal para notificaciones dentro de la intranet (Base de Datos).
 */
class InAppChannel implements NotificationChannel {
  async send(params: NotificationParams): Promise<boolean> {
    try {
      await db.execute({
        sql: `INSERT INTO notificaciones (id_user, tipo, prioridad, titulo, mensaje, data_json) 
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          params.userId,
          params.type || 'SISTEMA',
          params.priority || 'NORMAL',
          params.title,
          params.message,
          JSON.stringify(params.data || {})
        ]
      });
      return true;
    } catch (error) {
      console.error('[NotificationService] Error en InAppChannel:', error);
      return false;
    }
  }
}

/**
 * Canal para notificaciones vía Email.
 */
class EmailChannel implements NotificationChannel {
  private resend = new Resend(env.RESEND_API_KEY);
  private FROM_NAME = 'Cámara Inmobiliaria de Bolívar';
  private DEFAULT_FROM = `${this.FROM_NAME} <${env.RESEND_FROM_EMAIL}>`;

  async send(params: NotificationParams): Promise<boolean> {
    try {
      // Obtener el email del usuario si no se proporciona en data
      const userRes = await db.execute({
        sql: `SELECT email FROM users WHERE id = ?`,
        args: [params.userId]
      });

      const email = userRes.rows[0]?.email as string;
      if (!email) {
        console.warn(`[NotificationService] No se encontró email para el usuario ${params.userId}`);
        return false;
      }

      if (env.NODE_ENV === 'development') {
        console.log(`--- [MOCK EMAIL NOTIFICATION] ---`);
        console.log(`Para: ${email}`);
        console.log(`Asunto: ${params.emailConfig?.subject || params.title}`);
        console.log(`Mensaje: ${params.message}`);
        console.log('---------------------------------');
        return true;
      }

      if (!env.RESEND_API_KEY || env.RESEND_API_KEY === 're_123') return false;

      const { error } = await this.resend.emails.send({
        from: this.DEFAULT_FROM,
        to: email,
        subject: params.emailConfig?.subject || params.title,
        html: params.message, // Aquí se podría usar un template más complejo
      });

      if (error) {
        console.error('[NotificationService] Error Resend:', error);
        return false;
      }

      // Marcar en la BD que se envió el email (opcional, si existe el campo)
      // En nuestro esquema actual de 'notificaciones', este campo existe
      return true;
    } catch (error) {
      console.error('[NotificationService] Error en EmailChannel:', error);
      return false;
    }
  }
}

/**
 * Servicio Central de Notificaciones.
 * Orquestador escalable de múltiples canales.
 */
export class NotificationService {
  private static channels: Map<NotificationChannelType, NotificationChannel> = new Map([
    ['IN_APP', new InAppChannel()],
    ['EMAIL', new EmailChannel()]
  ]);

  /**
   * Envía una notificación a través de los canales especificados.
   */
  static async notify(params: NotificationParams): Promise<{ success: boolean; results: Record<string, boolean> }> {
    const requestedChannels = params.channels || ['IN_APP']; // Por defecto solo intranet
    const results: Record<string, boolean> = {};

    for (const channelType of requestedChannels) {
      const channel = this.channels.get(channelType);
      if (channel) {
        results[channelType] = await channel.send(params);
      } else {
        console.warn(`[NotificationService] Canal no soportado: ${channelType}`);
        results[channelType] = false;
      }
    }

    const success = Object.values(results).some(r => r === true);
    return { success, results };
  }

  /**
   * Envía una notificación a todos los usuarios administradores (roles 'admin' o 'super_admin').
   */
  static async notifyAdmins(params: Omit<NotificationParams, 'userId'>): Promise<void> {
    try {
      const res = await db.execute({
        sql: `SELECT id, roles FROM users WHERE roles LIKE '%admin%' OR roles LIKE '%super_admin%'`,
        args: []
      });

      for (const row of res.rows) {
        let roles: string[] = [];
        const rawRoles = row.roles;
        if (typeof rawRoles === 'string') {
          if (rawRoles.startsWith('[')) {
            try {
              roles = JSON.parse(rawRoles);
            } catch {
              roles = [rawRoles];
            }
          } else {
            roles = [rawRoles];
          }
        }
        if (roles.includes('admin') || roles.includes('super_admin')) {
          await this.notify({
            ...params,
            userId: row.id as number
          });
        }
      }
    } catch (error) {
      console.error('[NotificationService] Error notifying admins:', error);
    }
  }

  /**
   * Obtiene las notificaciones de un usuario.
   */
  static async getUserNotifications(userId: number, limit = 20, offset = 0) {
    const res = await db.execute({
      sql: `SELECT * FROM notificaciones 
            WHERE id_user = ? 
            ORDER BY creado_en DESC 
            LIMIT ? OFFSET ?`,
      args: [userId, limit, offset]
    });
    return res.rows;
  }

  /**
   * Obtiene la cantidad de notificaciones no leídas de un usuario.
   */
  static async getUnreadCount(userId: number): Promise<number> {
    const res = await db.execute({
      sql: `SELECT COUNT(*) as count FROM notificaciones WHERE id_user = ? AND leido = 0`,
      args: [userId]
    });
    return (res.rows[0]?.count as number) || 0;
  }

  /**
   * Marca una notificación como leída.
   */
  static async markAsRead(notificationId: number, userId: number) {
    await db.execute({
      sql: `UPDATE notificaciones 
            SET leido = 1, leido_en = (strftime('%Y-%m-%dT%H:%M:%SZ','now')) 
            WHERE id = ? AND id_user = ?`,
      args: [notificationId, userId]
    });
  }

  /**
   * Marca todas las notificaciones como leídas.
   */
  static async markAllAsRead(userId: number) {
    await db.execute({
      sql: `UPDATE notificaciones 
            SET leido = 1, leido_en = (strftime('%Y-%m-%dT%H:%M:%SZ','now')) 
            WHERE id_user = ? AND leido = 0`,
      args: [userId]
    });
  }
}
