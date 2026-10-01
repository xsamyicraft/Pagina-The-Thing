<?php
/*
 * THE THING — correos con el estilo de la web (pantalla CRT, doble línea roja,
 * letras verdes). Hechos con tablas y estilos en línea para que se vean bien
 * en Gmail, Outlook y Apple Mail.
 */

declare(strict_types=1);

const MAIL_C = [
    'bg' => '#050506', 'panel' => '#111113', 'text' => '#ebe6d8', 'muted' => '#8f8b80',
    'green' => '#6bff7f', 'red' => '#ff3355', 'line' => '#2b2b31', 'font' => "'Courier New', Courier, monospace",
];

function mail_e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

/** Botón con doble línea: borde rojo exterior + botón claro interior. */
function mail_button(string $url, string $label): string
{
    $c = MAIL_C;
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 8px"><tr>'
        . '<td style="border:2px solid ' . $c['red'] . ';padding:3px">'
        . '<a href="' . mail_e($url) . '" style="display:inline-block;background:' . $c['text'] . ';color:#000;font-family:' . $c['font'] . ';font-size:14px;font-weight:bold;letter-spacing:2px;text-decoration:none;padding:14px 26px;text-transform:uppercase">▶ ' . mail_e($label) . '</a>'
        . '</td></tr></table>';
}

/** Plantilla común. $inner es HTML ya seguro. */
function mail_layout(string $preheader, string $inner, string $footerExtra = ''): string
{
    $c = MAIL_C;
    $site = site_url();
    $logo = $site . 'assets/img/logo-email.png';
    $year = gmdate('Y');
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>THE THING</title></head>'
        . '<body style="margin:0;padding:0;background:' . $c['bg'] . '">'
        . '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:' . $c['bg'] . '">' . mail_e($preheader) . '</div>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' . $c['bg'] . '"><tr><td align="center" style="padding:28px 12px">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;border:6px double ' . $c['red'] . ';background:' . $c['panel'] . ';background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 2px,rgba(0,0,0,.25) 3px,transparent 4px)">'
        // Cabecera
        . '<tr><td style="padding:22px 28px 6px;font-family:' . $c['font'] . ';font-size:12px;color:' . $c['red'] . ';letter-spacing:2px">● REC'
        . '<span style="float:right;color:' . $c['muted'] . '">CH-01 · ' . gmdate('d.m.Y') . '</span></td></tr>'
        . '<tr><td align="center" style="padding:10px 28px 0"><a href="' . mail_e($site) . '"><img src="' . mail_e($logo) . '" width="120" alt="THE THING" style="display:block;border:0;width:120px;height:auto"></a></td></tr>'
        . '<tr><td align="center" style="padding:8px 28px 18px;font-family:' . $c['font'] . ';font-size:22px;font-weight:bold;letter-spacing:6px;color:' . $c['text'] . '">THE THING'
        . '<div style="font-size:11px;letter-spacing:4px;color:' . $c['muted'] . ';font-weight:normal;margin-top:4px">GAME STUDIO</div></td></tr>'
        . '<tr><td style="padding:0 28px"><div style="border-top:2px solid ' . $c['red'] . ';border-bottom:2px solid ' . $c['red'] . ';height:2px;line-height:2px;font-size:0">&nbsp;</div></td></tr>'
        // Cuerpo
        . '<tr><td style="padding:26px 28px 30px;font-family:' . $c['font'] . ';font-size:15px;line-height:1.6;color:' . $c['text'] . '">' . $inner . '</td></tr>'
        // Pie
        . '<tr><td style="padding:16px 28px 22px;border-top:1px dashed ' . $c['line'] . ';font-family:' . $c['font'] . ';font-size:11px;line-height:1.6;color:' . $c['muted'] . ';text-align:center">'
        . 'INSERT COIN TO CONTINUE<br>© ' . $year . ' THE THING · <a href="' . mail_e($site) . '" style="color:' . $c['green'] . '">' . mail_e(preg_replace('#^https?://#', '', rtrim($site, '/'))) . '</a>'
        . ($footerExtra ? '<br>' . $footerExtra : '')
        . '</td></tr></table></td></tr></table></body></html>';
}

function mail_eyebrow(string $s): string
{
    return '<div style="font-size:13px;letter-spacing:3px;color:' . MAIL_C['green'] . ';text-transform:uppercase;margin:0 0 8px">■ ' . mail_e($s) . '</div>';
}

function mail_title(string $s): string
{
    return '<h1 style="margin:0 0 16px;font-family:' . MAIL_C['font'] . ';font-size:24px;line-height:1.3;color:' . MAIL_C['text'] . '">' . mail_e($s) . '</h1>';
}

/* ------------------------------------------------------------------ */
/* Plantillas                                                          */
/* ------------------------------------------------------------------ */

/** PIN de acceso al panel. */
function mail_pin(string $pin, string $ip, int $minutes): array
{
    $c = MAIL_C;
    $cells = '';
    foreach (str_split($pin) as $d) {
        $cells .= '<td style="padding:0 3px"><div style="border:4px double ' . $c['red'] . ';background:#000;color:' . $c['green'] . ';font-family:' . $c['font'] . ';font-size:30px;font-weight:bold;width:40px;line-height:54px;text-align:center">' . mail_e($d) . '</div></td>';
    }
    $inner = mail_eyebrow('Acceso staff')
        . mail_title('Tu PIN de acceso')
        . '<p style="margin:0 0 6px;color:' . $c['muted'] . '">Alguien (esperamos que tú) ha introducido la contraseña correcta del panel de THE THING. Para terminar de entrar escribe este código:</p>'
        . '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px auto"><tr>' . $cells . '</tr></table>'
        . '<p style="margin:0 0 6px;text-align:center;color:' . $c['green'] . '">&gt; Caduca en ' . $minutes . ' minutos_</p>'
        . '<p style="margin:22px 0 0;padding:12px 14px;border:1px dashed ' . $c['line'] . ';font-size:12px;color:' . $c['muted'] . '">'
        . 'Fecha: ' . gmdate('d/m/Y H:i') . ' UTC<br>IP: ' . mail_e($ip) . '<br>'
        . '<span style="color:' . $c['red'] . '">¿No fuiste tú?</span> Alguien conoce tu contraseña: cámbiala desde el panel (Cuenta) cuanto antes. Sin este PIN no puede entrar.</p>';
    $text = "THE THING — PIN de acceso al panel\n\nTu PIN: {$pin}\nCaduca en {$minutes} minutos.\n\nIP: {$ip}\nSi no fuiste tú, cambia tu contraseña.";
    return [mail_layout('Tu PIN de acceso: ' . $pin, $inner), $text];
}

/** Alerta: contraseña incorrecta con el correo del administrador. */
function mail_alert(string $ip, int $attempts): array
{
    $c = MAIL_C;
    $inner = mail_eyebrow('Alerta de seguridad')
        . mail_title('Intento de acceso fallido')
        . '<p style="margin:0 0 14px;color:' . $c['muted'] . '">Alguien escribió el correo del administrador con una contraseña incorrecta (' . $attempts . ' ' . ($attempts === 1 ? 'intento' : 'intentos') . ').</p>'
        . '<p style="margin:0;padding:12px 14px;border:4px double ' . $c['red'] . ';background:#000;color:' . $c['green'] . '">&gt; FECHA: ' . gmdate('d/m/Y H:i') . ' UTC<br>&gt; IP: ' . mail_e($ip) . '</p>'
        . '<p style="margin:16px 0 0;color:' . $c['muted'] . '">No puede entrar sin la contraseña y sin el PIN que te enviaríamos a este correo. Si fuiste tú, ignora este mensaje.</p>';
    $text = "THE THING — Alerta de seguridad\n\nIntento de acceso fallido al panel ({$attempts}).\nIP: {$ip}\nFecha: " . gmdate('d/m/Y H:i') . " UTC";
    return [mail_layout('Intento de acceso fallido al panel', $inner), $text];
}

/** Aviso de novedades para jugadores. */
function mail_notification(string $name, array $n, string $link, string $unsub): array
{
    $c = MAIL_C;
    $kinds = ['news' => 'Nueva transmisión', 'app' => 'Nuevo cartucho', 'image' => 'Galería', 'video' => 'Nuevo cassette', 'product' => 'Tienda', 'data' => 'Datos', 'aviso' => 'Aviso del estudio'];
    $inner = mail_eyebrow($kinds[$n['kind']] ?? 'Novedad')
        . '<p style="margin:0 0 8px;color:' . $c['muted'] . '">Hola <span style="color:' . $c['green'] . '">' . mail_e($name) . '</span>,</p>'
        . mail_title($n['title'])
        . ($n['text'] !== '' ? '<p style="margin:0;color:' . $c['text'] . '">' . nl2br(mail_e($n['text'])) . '</p>' : '')
        . mail_button($link, 'Ver en la web');
    $text = "Hola {$name}:\n\n{$n['title']}\n" . ($n['text'] !== '' ? "{$n['text']}\n" : '') . "\nVer en la web: {$link}\n\n— THE THING\n\nDarte de baja: {$unsub}";
    $foot = '¿No quieres más correos? <a href="' . mail_e($unsub) . '" style="color:' . $c['muted'] . '">Darte de baja</a>';
    return [mail_layout($n['title'], $inner, $foot), $text];
}

/** Bienvenida al registrarse. */
function mail_welcome(string $name, string $unsub): array
{
    $c = MAIL_C;
    $site = site_url();
    $inner = mail_eyebrow('Player 2 has joined')
        . mail_title('¡Bienvenido, ' . $name . '!')
        . '<p style="margin:0 0 14px;color:' . $c['muted'] . '">Tu cuenta de jugador ya está activa. Desde ahora puedes:</p>'
        . '<p style="margin:0;color:' . $c['green'] . ';line-height:1.9">&gt; Votar el mejor juego y el más jugado<br>&gt; Dejar reseñas con estrellas<br>&gt; Recibir avisos de juegos nuevos y noticias</p>'
        . mail_button($site, 'Entrar a la web');
    $text = "¡Bienvenido a THE THING, {$name}!\n\nYa puedes votar, dejar reseñas y recibir avisos.\n{$site}\n\nDarte de baja de los correos: {$unsub}";
    $foot = 'Recibes este correo porque te registraste en THE THING. <a href="' . mail_e($unsub) . '" style="color:' . $c['muted'] . '">Darte de baja</a>';
    return [mail_layout('Tu cuenta de jugador está lista', $inner, $foot), $text];
}

/* ------------------------------------------------------------------ */
/* Envío                                                               */
/* ------------------------------------------------------------------ */

/** Envía un correo HTML + texto plano con mail() (Hostinger lo soporta). */
function send_mail(string $to, string $subject, string $html, string $text, ?string $unsub = null): bool
{
    if (!function_exists('mail') || !filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
    $boundary = 'tt_' . bin2hex(random_bytes(8));
    $enc = function (string $s): string {
        return '=?UTF-8?B?' . base64_encode($s) . '?=';
    };
    $headers = 'From: ' . $enc(MAIL_FROM_NAME) . ' <' . MAIL_FROM . ">\r\n"
        . "MIME-Version: 1.0\r\n"
        . 'Content-Type: multipart/alternative; boundary="' . $boundary . "\"\r\n"
        . ($unsub ? 'List-Unsubscribe: <' . $unsub . ">\r\n" : '');
    $body = "--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($text))
        . "--{$boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($html))
        . "--{$boundary}--\r\n";
    return @mail($to, $enc($subject), $body, $headers);
}
