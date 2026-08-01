import type { Locale } from './locales';

const SHELL_COPY = {
  en: {
    accessibility: 'Accessibility',
    authEyebrow: 'Secure access',
    authHeading: 'Sign-in is coming in Phase 2',
    authMessage:
      'This placeholder does not collect credentials or create an account.',
    backHome: 'Back to public site',
    closeMenu: 'Close navigation menu',
    contact: 'Contact us',
    contactSafety:
      'Do not send sensitive documents, account credentials, or personal identifiers through public contact channels.',
    footerNavigation: 'Footer navigation',
    home: 'Home',
    language: 'Language',
    mainNavigation: 'Main navigation',
    mobileNavigation: 'Mobile navigation',
    openMenu: 'Open navigation menu',
    portalEyebrow: 'Client portal',
    portalHeading: 'Portal access is not available yet',
    portalMessage:
      'This Phase 1 placeholder does not provide account access or private client services.',
    privacy: 'Privacy',
    services: 'Services',
    signIn: 'Sign in (coming soon)',
    skipToContent: 'Skip to main content',
    terms: 'Terms',
  },
  es: {
    accessibility: 'Accesibilidad',
    authEyebrow: 'Acceso seguro',
    authHeading: 'El inicio de sesión llegará en la Fase 2',
    authMessage:
      'Este marcador de posición no recopila credenciales ni crea una cuenta.',
    backHome: 'Volver al sitio público',
    closeMenu: 'Cerrar el menú de navegación',
    contact: 'Contáctenos',
    contactSafety:
      'No envíe documentos confidenciales, credenciales de cuenta ni identificadores personales por canales públicos de contacto.',
    footerNavigation: 'Navegación del pie de página',
    home: 'Inicio',
    language: 'Idioma',
    mainNavigation: 'Navegación principal',
    mobileNavigation: 'Navegación móvil',
    openMenu: 'Abrir el menú de navegación',
    portalEyebrow: 'Portal del cliente',
    portalHeading: 'El acceso al portal aún no está disponible',
    portalMessage:
      'Este marcador de posición de la Fase 1 no brinda acceso a cuentas ni servicios privados para clientes.',
    privacy: 'Privacidad',
    services: 'Servicios',
    signIn: 'Iniciar sesión (próximamente)',
    skipToContent: 'Saltar al contenido principal',
    terms: 'Términos',
  },
} as const;

export type ShellCopy = (typeof SHELL_COPY)[Locale];

export function getShellCopy(locale: Locale): ShellCopy {
  return SHELL_COPY[locale];
}
