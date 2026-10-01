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
