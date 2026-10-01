<?php
/*
 * THE THING — configuración
 * Puedes editar estos valores antes de subir el sitio a Hostinger.
 */

// Correo del administrador (dueño) que puede iniciar sesión en /admin.html
const ADMIN_EMAIL = 'admin@thethinggame.com';

// Horas de inactividad antes de cerrar la sesión del administrador
const SESSION_HOURS = 12;

// Días que un jugador registrado permanece conectado
const MEMBER_SESSION_DAYS = 30;

// Tamaño máximo de cada imagen subida (MB)
const MAX_UPLOAD_MB = 8;

// Remitente de los correos de novedades. Créalo en hPanel → Correos
// (debe ser una cuenta de tu dominio para que no llegue a spam).
const MAIL_FROM = 'no-reply@thethinggame.com';
const MAIL_FROM_NAME = 'THE THING';

// API de Unity LevelPlay (ironSource). No hace falta tocarlo.
const LEVELPLAY_API = 'https://platform.ironsrc.com';

// Minutos que se guardan en caché los datos de LevelPlay
// (su API permite ~20 consultas cada 10 minutos).
const LEVELPLAY_CACHE_MINUTES = 30;

// Verificación en dos pasos del panel: tras la contraseña se envía un PIN
// de 6 dígitos al correo del administrador. Si el correo no llega, el PIN
// también se guarda en data/ultimo-pin.php (ábrelo con el Administrador de
// archivos de Hostinger). Ponlo en false solo en caso de emergencia.
const ADMIN_2FA = true;

// Minutos de validez del PIN
const ADMIN_PIN_MINUTES = 10;

// Tamaño máximo de cada vídeo subido (MB). Hostinger suele permitir 128 MB;
// para vídeos largos es mejor usar un enlace de YouTube.
const MAX_VIDEO_MB = 100;

// Horas que se guardan en caché las descargas de Google Play
const PLAY_CACHE_HOURS = 6;
