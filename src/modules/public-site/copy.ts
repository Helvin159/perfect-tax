import type { Locale } from '@/modules/localization/locales';

type FallbackService = Readonly<{
  key: string;
  requiresReview?: boolean;
  summary: string;
  title: string;
}>;

type LegalDocument = 'accessibility' | 'privacy' | 'terms';

const PUBLIC_SITE_COPY = {
  en: {
    hero: {
      eyebrow: 'Administrative services in English and Spanish',
      heading: 'Clear support for important paperwork and tax needs',
      body: 'Get practical help organizing documents, understanding next steps, and coordinating the information needed for the service you request.',
    },
    services: {
      heading: 'Services designed around clear next steps',
      body: 'Support is available for common administrative and document needs. Service scope and requirements are confirmed directly with the business.',
    },
    fallbackServices: [
      {
        key: 'document-preparation',
        title: 'Document preparation assistance',
        summary:
          'Administrative help organizing and preparing information for client-directed documents.',
      },
      {
        key: 'tax-preparation',
        title: 'Tax preparation services',
        summary:
          'Help coordinating the records and information used for tax preparation.',
        requiresReview: true,
      },
      {
        key: 'notary',
        title: 'Notary services',
        summary:
          'Notary service availability and document requirements are confirmed before service.',
        requiresReview: true,
      },
      {
        key: 'document-coordination',
        title: 'Client document coordination',
        summary:
          'Practical support keeping requested documents and administrative follow-up organized.',
      },
    ] satisfies readonly FallbackService[],
    process: {
      heading: 'How it works',
      body: 'Start with a direct conversation. The business will confirm whether it can assist and explain the appropriate next step.',
      steps: [
        {
          title: 'Contact the office',
          description:
            'Use an approved public channel to request a conversation or callback.',
        },
        {
          title: 'Confirm the service',
          description:
            'Discuss the type of assistance needed, service scope, and safe way to coordinate documents.',
        },
        {
          title: 'Coordinate next steps',
          description:
            'Follow the instructions provided by staff and ask questions when something is unclear.',
        },
      ],
    },
    portal: {
      eyebrow: 'Client portal',
      heading: 'A secure online experience is planned',
      body: 'Online accounts and document exchange are not available in Phase 1. The future portal is intended to support safer client document coordination after security and privacy controls are in place.',
      linkLabel: 'Read the portal availability notice',
      status: 'Online access is not available yet',
    },
    trust: {
      heading: 'Practical support with clear boundaries',
      body: 'The public experience is designed to make contact straightforward while avoiding sensitive data collection before secure systems are ready.',
      points: [
        'English and Spanish service experience',
        'Direct coordination with the business',
        'No sensitive information collected on this website',
      ],
    },
    cta: {
      heading: 'Start with a conversation',
      body: 'Contact the business to ask about service availability or request a callback. Do not include sensitive personal information in a public message.',
      callLabel: 'Call the office',
      emailLabel: 'Email the office',
      whatsappLabel: 'Request contact on WhatsApp',
      noChannels:
        'No approved public contact channel is available on this site right now. Please check back later.',
      safety:
        'Do not send tax documents, account credentials, government identifiers, or other sensitive information by email or WhatsApp.',
    },
    reviewRequired: 'Business review required',
    defaultFooter:
      'Administrative and document support information is provided for general service coordination.',
    placeholders: {
      contactHeading: 'Contact the business safely',
      signIn: {
        eyebrow: 'Secure access',
        heading: 'Online sign-in is not available yet',
        body: 'This Phase 1 page does not accept or store usernames, passwords, or other account credentials. Contact the business through an approved channel if you need assistance.',
      },
      portal: {
        eyebrow: 'Client portal',
        heading: 'Online account access is not available yet',
        body: 'The client portal is a future service. This page does not provide private records, document upload, messaging, or account access.',
      },
      approvedNotice: 'Business update',
    },
    legal: {
      eyebrow: 'Content pending approval',
      status: 'Placeholder — not a finalized policy',
      body: 'Approved content is still being prepared and reviewed. This page is a placeholder and should not be treated as the final policy or statement.',
      titles: {
        privacy: 'Privacy notice',
        terms: 'Terms of use',
        accessibility: 'Accessibility statement',
      } satisfies Record<LegalDocument, string>,
    },
  },
  es: {
    hero: {
      eyebrow: 'Servicios administrativos en inglés y español',
      heading:
        'Apoyo claro para trámites importantes y necesidades tributarias',
      body: 'Reciba ayuda práctica para organizar documentos, entender los próximos pasos y coordinar la información necesaria para el servicio que solicite.',
    },
    services: {
      heading: 'Servicios orientados a próximos pasos claros',
      body: 'Hay apoyo disponible para necesidades administrativas y documentales comunes. El alcance y los requisitos del servicio se confirman directamente con el negocio.',
    },
    fallbackServices: [
      {
        key: 'document-preparation',
        title: 'Asistencia con la preparación de documentos',
        summary:
          'Ayuda administrativa para organizar y preparar información para documentos indicados por el cliente.',
      },
      {
        key: 'tax-preparation',
        title: 'Servicios de preparación de impuestos',
        summary:
          'Ayuda para coordinar los registros y la información utilizados en la preparación de impuestos.',
        requiresReview: true,
      },
      {
        key: 'notary',
        title: 'Servicios notariales',
        summary:
          'La disponibilidad del servicio notarial y los requisitos del documento se confirman antes del servicio.',
        requiresReview: true,
      },
      {
        key: 'document-coordination',
        title: 'Coordinación de documentos del cliente',
        summary:
          'Apoyo práctico para mantener organizados los documentos solicitados y el seguimiento administrativo.',
      },
    ] satisfies readonly FallbackService[],
    process: {
      heading: 'Cómo funciona',
      body: 'Comience con una conversación directa. El negocio confirmará si puede ayudar y explicará el próximo paso apropiado.',
      steps: [
        {
          title: 'Comuníquese con la oficina',
          description:
            'Use un canal público aprobado para solicitar una conversación o una llamada.',
        },
        {
          title: 'Confirme el servicio',
          description:
            'Converse sobre el tipo de asistencia, el alcance del servicio y la forma segura de coordinar documentos.',
        },
        {
          title: 'Coordine los próximos pasos',
          description:
            'Siga las instrucciones del personal y haga preguntas cuando algo no esté claro.',
        },
      ],
    },
    portal: {
      eyebrow: 'Portal del cliente',
      heading: 'Se planifica una experiencia segura en línea',
      body: 'Las cuentas en línea y el intercambio de documentos no están disponibles en la Fase 1. El portal futuro está destinado a apoyar una coordinación más segura de documentos después de implementar controles de seguridad y privacidad.',
      linkLabel: 'Leer el aviso de disponibilidad del portal',
      status: 'El acceso en línea aún no está disponible',
    },
    trust: {
      heading: 'Apoyo práctico con límites claros',
      body: 'La experiencia pública facilita el contacto y evita recopilar datos confidenciales antes de que los sistemas seguros estén listos.',
      points: [
        'Experiencia de servicio en inglés y español',
        'Coordinación directa con el negocio',
        'Este sitio web no recopila información confidencial',
      ],
    },
    cta: {
      heading: 'Comience con una conversación',
      body: 'Comuníquese con el negocio para preguntar sobre la disponibilidad del servicio o solicitar una llamada. No incluya información personal confidencial en un mensaje público.',
      callLabel: 'Llamar a la oficina',
      emailLabel: 'Enviar correo a la oficina',
      whatsappLabel: 'Solicitar contacto por WhatsApp',
      noChannels:
        'No hay un canal público aprobado disponible en este sitio en este momento. Vuelva a consultar más adelante.',
      safety:
        'No envíe documentos tributarios, credenciales de cuenta, identificadores gubernamentales ni otra información confidencial por correo electrónico o WhatsApp.',
    },
    reviewRequired: 'Requiere revisión del negocio',
    defaultFooter:
      'La información sobre apoyo administrativo y documental se proporciona para la coordinación general de servicios.',
    placeholders: {
      contactHeading: 'Comuníquese con el negocio de forma segura',
      signIn: {
        eyebrow: 'Acceso seguro',
        heading: 'El inicio de sesión en línea aún no está disponible',
        body: 'Esta página de la Fase 1 no acepta ni almacena nombres de usuario, contraseñas u otras credenciales de cuenta. Comuníquese con el negocio por un canal aprobado si necesita ayuda.',
      },
      portal: {
        eyebrow: 'Portal del cliente',
        heading: 'El acceso a cuentas en línea aún no está disponible',
        body: 'El portal del cliente es un servicio futuro. Esta página no proporciona registros privados, carga de documentos, mensajes ni acceso a cuentas.',
      },
      approvedNotice: 'Actualización del negocio',
    },
    legal: {
      eyebrow: 'Contenido pendiente de aprobación',
      status: 'Marcador de posición — no es una política finalizada',
      body: 'El contenido aprobado todavía se está preparando y revisando. Esta página es un marcador de posición y no debe considerarse la política o declaración final.',
      titles: {
        privacy: 'Aviso de privacidad',
        terms: 'Términos de uso',
        accessibility: 'Declaración de accesibilidad',
      } satisfies Record<LegalDocument, string>,
    },
  },
} as const;

export type PublicSiteCopy = (typeof PUBLIC_SITE_COPY)[Locale];
export type PublicSiteDocument = LegalDocument;

export function getPublicSiteCopy(locale: Locale): PublicSiteCopy {
  return PUBLIC_SITE_COPY[locale];
}
