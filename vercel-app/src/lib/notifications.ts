export type NotificationKind = 'invoice' | 'attention' | 'profile' | 'payment' | 'account';
export type AppNotification = {
  id:string; profileId?:string|null; ticketId?:string|null; kind:NotificationKind;
  title:string; body:string; actionLabel?:string|null; createdAt:string; readAt?:string|null;
};
export function notificationForState(state:string) {
  const messages:Record<string,{kind:NotificationKind;title:string;body:string;actionLabel:string}>= {
    'Factura recibida':{kind:'invoice',title:'Tu factura ya está disponible',body:'Recibimos el XML. Abre el ticket para descargarlo y revisar sus archivos.',actionLabel:'Ver factura'},
    'Requiere revisión':{kind:'attention',title:'Revisa los datos de tu ticket',body:'La lectura está lista. Confirma que los datos sean correctos para continuar.',actionLabel:'Revisar ticket'},
    'Requiere información':{kind:'attention',title:'Necesitamos una foto más clara',body:'No pudimos leer todos los datos. Abre el ticket y revisa qué falta.',actionLabel:'Revisar ticket'},
    'CAPTCHA pendiente':{kind:'attention',title:'El comercio necesita tu ayuda',body:'El portal pidió comprobar que eres una persona. Completa la verificación para continuar.',actionLabel:'Continuar solicitud'},
    'Portal bloqueado':{kind:'attention',title:'La solicitud se detuvo',body:'El portal del comercio impidió continuar. Revisa las opciones de este ticket.',actionLabel:'Ver qué pasó'},
    'Error temporal':{kind:'attention',title:'No pudimos continuar con tu ticket',body:'Hubo un problema durante el proceso. Tus datos siguen guardados; abre el ticket para revisar el siguiente paso.',actionLabel:'Ver qué pasó'},
    'Error permanente':{kind:'attention',title:'Este ticket necesita atención',body:'No pudimos completar la solicitud. Revisa el motivo y las opciones disponibles.',actionLabel:'Ver qué pasó'},
    'No facturable':{kind:'attention',title:'No se pudo facturar este ticket',body:'Abre el ticket para revisar el motivo registrado.',actionLabel:'Ver motivo'},
    'Solicitud enviada':{kind:'invoice',title:'Tu solicitud llegó al comercio',body:'La solicitud está enviada. Te avisaremos aquí cuando la factura esté disponible.',actionLabel:'Ver solicitud'},
  };
  return messages[state];
}
// Connect these to the selected payment provider only after signature verification.
// Never infer unpaid invoices from a timer or fabricate subscription charges.
export const billingNoticeTemplates = {
  payment_due:{kind:'payment',title:'Tu pago está pendiente',body:'Revisa tu suscripción para completar el pago.',actionLabel:'Revisar suscripción'},
  payment_failed:{kind:'payment',title:'No se pudo completar tu pago',body:'Revisa o cambia tu método de pago para continuar con tu suscripción.',actionLabel:'Actualizar método de pago'},
  payment_method_expiring:{kind:'payment',title:'Actualiza tu método de pago',body:'Tu método de pago está por vencer. Cámbialo antes de la próxima renovación.',actionLabel:'Actualizar método de pago'},
} satisfies Record<string,Pick<AppNotification,'kind'|'title'|'body'|'actionLabel'>>;
