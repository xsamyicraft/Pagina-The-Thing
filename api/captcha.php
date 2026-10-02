<?php
/*
 * THE THING — captcha en forma de minijuego
 *   GET  captcha.php?action=new     → { id, prompt, image (PNG en base64), cols, rows, seconds }
 *   POST captcha.php?action=verify  → { id, cells: [índices] } → { token }
 *
 * Se dibuja una cuadrícula de 3×3 sprites pixelados (monedas, corazones,
 * fantasmas, gatos, estrellas, cassettes) en una imagen. El jugador toca
 * los que pide el enunciado. La solución solo vive en la sesión del
 * servidor; la imagen lleva ruido y variaciones para que no se pueda leer
 * fácilmente con un programa. Si se acierta se entrega una ficha de un
 * solo uso que piden el registro, el inicio de sesión y el soporte.
 */

declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

require_same_origin();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

const CAPTCHA_COLS = 3;
const CAPTCHA_ROWS = 3;
const CAPTCHA_CELL = 110;
const CAPTCHA_SECONDS = 45;

/* Sprites de 12×12. '.' = transparente; letras = colores de la paleta */
const SPRITES = [
    'coin' => [
        'label' => 'TODAS LAS MONEDAS', 'pal' => ['a' => '#ffb547', 'b' => '#7a4a00', 'c' => '#fff6d8'],
        'px' => ['....bbbb....', '..bbaaaabb..', '.baaaaaaaab.', '.baccaaaaab.', 'baacaaabaaab', 'baacaaabaaab',
                 'baaaaaabaaab', 'baaaaaabaaab', '.baaaaaaaab.', '.baaaaaaaab.', '..bbaaaabb..', '....bbbb....'],
    ],
    'heart' => [
        'label' => 'TODOS LOS CORAZONES', 'pal' => ['a' => '#ff3355', 'b' => '#5c0012', 'c' => '#ffffff'],
        'px' => ['............', '.bbb....bbb.', 'baaab..baaab', 'bacaabbaaaab', 'bacaaaaaaaab', 'baaaaaaaaaab',
                 '.baaaaaaaab.', '..baaaaaab..', '...baaaab...', '....baab....', '.....bb.....', '............'],
    ],
    'ghost' => [
        'label' => 'TODOS LOS FANTASMAS', 'pal' => ['a' => '#dff6ff', 'b' => '#24425c', 'c' => '#ffffff', 'd' => '#1a3cff'],
        'px' => ['....bbbb....', '..bbaaaabb..', '.baaaaaaaab.', '.baccaaccab.', '.bacdaacdab.', 'baaaaaaaaaab',
                 'baaaaaaaaaab', 'baaaaaaaaaab', 'baaaaaaaaaab', 'baaaaaaaaaab', 'baabaabbaabb', 'bb.bb..bb.b.'],
    ],
    'cat' => [
        'label' => 'TODOS LOS GATOS', 'pal' => ['a' => '#a9a9a9', 'b' => '#141414', 'c' => '#ffffff', 'd' => '#000000'],
        'px' => ['b..........b', 'bb........bb', 'bab......bab', 'baabbbbbbaab', 'baaaaaaaaaab', 'bacccaacccab',
                 'bacdcaacdcab', 'baaaaaaaaaab', 'baaaabbaaaab', '.baaaaaaaab.', '..bbaaaabb..', '....bbbb....'],
    ],
    'star' => [
        'label' => 'TODAS LAS ESTRELLAS', 'pal' => ['a' => '#fff07a', 'b' => '#7a5c00'],
        'px' => ['.....bb.....', '....baab....', '....baab....', '...baaaab...', 'bbbbaaaabbbb', 'baaaaaaaaaab',
                 '.baaaaaaaab.', '..baaaaaab..', '..baaaaaab..', '.baaabbaaab.', '.baab..baab.', '.bb......bb.'],
    ],
    'tape' => [
        'label' => 'TODOS LOS CASSETTES', 'pal' => ['a' => '#34343a', 'b' => '#08080a', 'c' => '#efe8d6', 'd' => '#e8e8e8', 'e' => '#ff3355'],
        'px' => ['............', 'bbbbbbbbbbbb', 'baaaaaaaaaab', 'bacccccccccb', 'baeeeeeeeeab', 'baaaaaaaaaab',
                 'baddabbaddab', 'baddabbaddab', 'baaaaaaaaaab', 'bab.bbbb.bab', 'bbb......bbb', '............'],
    ],
];

function hex_rgb(string $hex, float $k = 1.0): array
{
    $n = hexdec(ltrim($hex, '#'));
    $f = function (int $v) use ($k): int {
        return max(0, min(255, (int) round($v * $k)));
    };
    return [$f(($n >> 16) & 255), $f(($n >> 8) & 255), $f($n & 255)];
}

/** Crea el reto: tipo buscado, celdas correctas y celdas de distracción. */
function make_challenge(): array
{
    $types = array_keys(SPRITES);
    $target = $types[random_int(0, count($types) - 1)];
    $others = array_values(array_diff($types, [$target]));
    $total = CAPTCHA_COLS * CAPTCHA_ROWS;
    $count = random_int(2, 4);
    $cells = range(0, $total - 1);
    shuffle($cells);
    $answer = array_slice($cells, 0, $count);
    sort($answer);
    $grid = [];
    for ($i = 0; $i < $total; $i++) {
        $grid[$i] = in_array($i, $answer, true) ? $target : $others[random_int(0, count($others) - 1)];
    }
    return ['target' => $target, 'answer' => $answer, 'grid' => $grid];
}

/** Dibuja la cuadrícula con GD (PNG). */
function draw_png(array $grid): string
{
    $w = CAPTCHA_COLS * CAPTCHA_CELL;
    $h = CAPTCHA_ROWS * CAPTCHA_CELL;
    $im = imagecreatetruecolor($w, $h);
    imagefill($im, 0, 0, imagecolorallocate($im, 8, 8, 10));
    // Grano de fondo
    for ($i = 0; $i < 900; $i++) {
        $g = random_int(14, 40);
        $c = imagecolorallocate($im, $g, $g, $g + random_int(0, 8));
        $s = random_int(1, 3);
        $x = random_int(0, $w);
        $y = random_int(0, $h);
        imagefilledrectangle($im, $x, $y, $x + $s, $y + $s, $c);
    }
    foreach ($grid as $i => $type) {
        $sp = SPRITES[$type];
        $col = $i % CAPTCHA_COLS;
        $row = intdiv($i, CAPTCHA_COLS);
        $scale = random_int(6, 8);
        $size = 12 * $scale;
        $ox = $col * CAPTCHA_CELL + random_int(4, CAPTCHA_CELL - $size - 4);
        $oy = $row * CAPTCHA_CELL + random_int(4, CAPTCHA_CELL - $size - 4);
        $flip = random_int(0, 1) === 1;
        $k = random_int(82, 112) / 100;
        $colors = [];
        foreach ($sp['pal'] as $ch => $hex) {
            [$r, $g, $b] = hex_rgb($hex, $k);
            $colors[$ch] = imagecolorallocate($im, $r, $g, $b);
        }
        foreach ($sp['px'] as $y => $line) {
            for ($x = 0; $x < 12; $x++) {
                $ch = $line[$flip ? 11 - $x : $x];
                if ($ch === '.') continue;
                $px = $ox + $x * $scale;
                $py = $oy + $y * $scale;
                imagefilledrectangle($im, $px, $py, $px + $scale - 1, $py + $scale - 1, $colors[$ch]);
            }
        }
    }
    // Bandas "glitch" desplazadas y líneas de barrido
    for ($i = 0; $i < 4; $i++) {
        $y = random_int(0, $h - 8);
        $bh = random_int(2, 6);
        $dx = random_int(-7, 7);
        $band = imagecreatetruecolor($w, $bh);
        imagecopy($band, $im, 0, 0, 0, $y, $w, $bh);
        imagecopy($im, $band, $dx, $y, 0, 0, $w, $bh);
        imagedestroy($band);
    }
    $scan = imagecolorallocatealpha($im, 0, 0, 0, 90);
    for ($y = 0; $y < $h; $y += 3) imageline($im, 0, $y, $w, $y, $scan);
    for ($i = 0; $i < 160; $i++) {
        $c = imagecolorallocate($im, random_int(60, 255), random_int(60, 255), random_int(60, 255));
        imagesetpixel($im, random_int(0, $w - 1), random_int(0, $h - 1), $c);
    }
    $line = imagecolorallocate($im, 255, 51, 85);
    for ($c = 1; $c < CAPTCHA_COLS; $c++) imagefilledrectangle($im, $c * CAPTCHA_CELL - 1, 0, $c * CAPTCHA_CELL, $h, $line);
    for ($r = 1; $r < CAPTCHA_ROWS; $r++) imagefilledrectangle($im, 0, $r * CAPTCHA_CELL - 1, $w, $r * CAPTCHA_CELL, $line);
    ob_start();
    imagepng($im);
    imagedestroy($im);
    return 'data:image/png;base64,' . base64_encode((string) ob_get_clean());
}

/** Respaldo si el servidor no tiene GD: la misma cuadrícula en SVG. */
function draw_svg(array $grid): string
{
    $w = CAPTCHA_COLS * CAPTCHA_CELL;
    $h = CAPTCHA_ROWS * CAPTCHA_CELL;
    $out = '<svg xmlns="http://www.w3.org/2000/svg" width="' . $w . '" height="' . $h . '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#08080a"/>';
    foreach ($grid as $i => $type) {
        $sp = SPRITES[$type];
        $scale = random_int(6, 8);
        $ox = ($i % CAPTCHA_COLS) * CAPTCHA_CELL + random_int(4, CAPTCHA_CELL - 12 * $scale - 4);
        $oy = intdiv($i, CAPTCHA_COLS) * CAPTCHA_CELL + random_int(4, CAPTCHA_CELL - 12 * $scale - 4);
        foreach ($sp['px'] as $y => $line) {
            for ($x = 0; $x < 12; $x++) {
                if ($line[$x] === '.') continue;
                $out .= '<rect x="' . ($ox + $x * $scale) . '" y="' . ($oy + $y * $scale) . '" width="' . $scale . '" height="' . $scale . '" fill="' . $sp['pal'][$line[$x]] . '"/>';
            }
        }
    }
    for ($c = 1; $c < CAPTCHA_COLS; $c++) $out .= '<rect x="' . ($c * CAPTCHA_CELL - 1) . '" y="0" width="2" height="' . $h . '" fill="#ff3355"/>';
    for ($r = 1; $r < CAPTCHA_ROWS; $r++) $out .= '<rect x="0" y="' . ($r * CAPTCHA_CELL - 1) . '" width="' . $w . '" height="2" fill="#ff3355"/>';
    return 'data:image/svg+xml;base64,' . base64_encode($out . '</svg>');
}

if ($action === 'new' && $method === 'GET') {
    $limited = with_db(function (array &$db) {
        return rate_limited($db, 'captcha:' . ip_key(), 40, 600);
    }, true);
    if ($limited) fail(429, 'Demasiadas partidas seguidas. Espera unos minutos.');
    $ch = make_challenge();
    $id = new_id();
    start_session(true);
    $_SESSION['captcha'] = ['id' => $id, 'answer' => $ch['answer'], 'exp' => time() + CAPTCHA_SECONDS + 5, 'at' => microtime(true)];
    respond(200, [
        'id' => $id,
        'prompt' => 'TOCA ' . SPRITES[$ch['target']]['label'],
        'image' => function_exists('imagecreatetruecolor') ? draw_png($ch['grid']) : draw_svg($ch['grid']),
        'cols' => CAPTCHA_COLS, 'rows' => CAPTCHA_ROWS, 'seconds' => CAPTCHA_SECONDS,
    ]);
}

if ($action === 'verify' && $method === 'POST') {
    $in = read_json();
    start_session(true);
    $ch = $_SESSION['captcha'] ?? null;
    unset($_SESSION['captcha']);                   // cada reto se puede intentar una sola vez
    if (!$ch || !hash_equals($ch['id'], (string) ($in['id'] ?? ''))) fail(400, 'La partida terminó. Juega otra.');
    if ($ch['exp'] < time()) fail(400, '¡Se acabó el tiempo! Juega otra.');
    $cells = array_values(array_unique(array_map('intval', is_array($in['cells'] ?? null) ? $in['cells'] : [])));
    sort($cells);
    if (microtime(true) - $ch['at'] < 1.0 || $cells !== $ch['answer']) fail(400, 'Fallaste. ¡Inténtalo otra vez!');
    $token = bin2hex(random_bytes(16));
    $tokens = $_SESSION['captcha_tokens'] ?? [];
    $tokens[$token] = time() + 600;
    $_SESSION['captcha_tokens'] = array_slice($tokens, -5, null, true);
    respond(200, ['token' => $token]);
}

fail(404, 'Acción no encontrada');
