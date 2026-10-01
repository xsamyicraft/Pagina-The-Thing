<?php
/*
 * THE THING — cliente mínimo de la API de reportes de Unity LevelPlay (ironSource)
 *
 * 1) Token:   GET {API}/partners/publisher/auth
 *             cabeceras "secretkey" y "refreshToken" (LevelPlay → My Account)
 *             → devuelve un token Bearer válido 60 minutos.
 * 2) Reporte: GET {API}/partners/publisher/mediation/applications/v5/stats
 *             ?startDate=AAAA-MM-DD&endDate=AAAA-MM-DD&breakdowns=date,app&metrics=...
 *
 * Los datos se guardan en caché (LEVELPLAY_CACHE_MINUTES) porque la API
 * limita el número de consultas.
 */

declare(strict_types=1);

const LP_METRICS = ['revenue', 'impressions', 'activeUsers'];

function lp_http(string $url, array $headers): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($body === false) return [0, 'Error de red: ' . $err];
        return [$status, (string) $body];
    }
    $ctx = stream_context_create(['http' => [
        'method' => 'GET', 'header' => implode("\r\n", $headers), 'timeout' => 25, 'ignore_errors' => true,
    ]]);
    $body = @file_get_contents($url, false, $ctx);
    $status = 0;
    foreach ($http_response_header ?? [] as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $status = (int) $m[1];
    }
    if ($body === false) return [0, 'Error de red al contactar LevelPlay'];
    return [$status, (string) $body];
}

/** Pide un token nuevo. Lanza RuntimeException si falla. */
function lp_fetch_token(string $secretKey, string $refreshToken): string
{
    [$status, $body] = lp_http(LEVELPLAY_API . '/partners/publisher/auth', [
        'secretkey: ' . $secretKey,
        'refreshToken: ' . $refreshToken,
    ]);
    if ($status !== 200) {
        throw new RuntimeException('LevelPlay rechazó las credenciales (HTTP ' . $status . '). Revisa la Secret Key y el Refresh Token. ' . lp_excerpt($body));
    }
    $decoded = json_decode($body, true);
    $token = is_string($decoded) ? $decoded : (is_array($decoded) ? (string) ($decoded['token'] ?? $decoded['access_token'] ?? '') : trim($body, "\" \r\n"));
    if ($token === '') throw new RuntimeException('LevelPlay no devolvió un token válido');
    return $token;
}

function lp_excerpt(string $body): string
{
    $s = trim(strip_tags($body));
    return $s === '' ? '' : 'Respuesta: ' . (function_exists('mb_substr') ? mb_substr($s, 0, 200) : substr($s, 0, 200));
}

/** Descarga el reporte diario por app. Devuelve las filas tal cual. */
function lp_fetch_stats(string $token, string $start, string $end, array $metrics): array
{
    $q = http_build_query([
        'startDate' => $start,
        'endDate' => $end,
        'breakdowns' => 'date,app',
        'metrics' => implode(',', $metrics),
    ]);
    [$status, $body] = lp_http(LEVELPLAY_API . '/partners/publisher/mediation/applications/v5/stats?' . $q, [
        'Authorization: Bearer ' . $token,
        'Accept: application/json',
    ]);
    if ($status === 401) throw new RuntimeException('TOKEN_EXPIRED');
    if ($status !== 200) throw new RuntimeException('Error de LevelPlay (HTTP ' . $status . '). ' . lp_excerpt($body));
    $rows = json_decode($body, true);
    if (!is_array($rows)) throw new RuntimeException('Respuesta inesperada de LevelPlay. ' . lp_excerpt($body));
    // Algunas versiones envuelven la lista en { data: [...] }
    if (isset($rows['data']) && is_array($rows['data']) && !isset($rows[0])) $rows = $rows['data'];
    return $rows;
}

/** Convierte las filas de LevelPlay en totales por día y por app. */
function lp_aggregate(array $rows): array
{
    $daily = [];
    $apps = [];
    $totals = ['revenue' => 0.0, 'impressions' => 0, 'activeUsers' => 0];
    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        $date = substr((string) ($row['date'] ?? ''), 0, 10);
        $appKey = (string) ($row['appKey'] ?? '');
        // Las métricas pueden venir en la fila o dentro de "data": [ {...}, ... ]
        $metricRows = isset($row['data']) && is_array($row['data']) ? $row['data'] : [$row];
        $m = ['revenue' => 0.0, 'impressions' => 0, 'activeUsers' => 0];
        foreach ($metricRows as $mr) {
            if (!is_array($mr)) continue;
            $m['revenue'] += (float) ($mr['revenue'] ?? 0);
            $m['impressions'] += (int) ($mr['impressions'] ?? 0);
            $m['activeUsers'] += (int) ($mr['activeUsers'] ?? 0);
        }
        if ($date !== '') {
            $daily[$date] = $daily[$date] ?? ['date' => $date, 'revenue' => 0.0, 'impressions' => 0, 'activeUsers' => 0];
            foreach ($m as $k => $v) $daily[$date][$k] += $v;
        }
        if ($appKey !== '') {
            $apps[$appKey] = $apps[$appKey] ?? [
                'appKey' => $appKey, 'appName' => (string) ($row['appName'] ?? $appKey), 'platform' => (string) ($row['platform'] ?? ''),
                'revenue' => 0.0, 'impressions' => 0, 'activeUsers' => 0, 'days' => 0,
            ];
            foreach ($m as $k => $v) $apps[$appKey][$k] += $v;
            $apps[$appKey]['days']++;
        }
        foreach ($m as $k => $v) $totals[$k] += $v;
    }
    ksort($daily);
    foreach ($daily as &$d) $d['revenue'] = round($d['revenue'], 2);
    unset($d);
    foreach ($apps as &$a) {
        $a['revenue'] = round($a['revenue'], 2);
        $a['avgDau'] = $a['days'] ? (int) round($a['activeUsers'] / $a['days']) : 0;
        $a['ecpm'] = $a['impressions'] ? round($a['revenue'] / $a['impressions'] * 1000, 2) : 0;
    }
    unset($a);
    $totals['revenue'] = round($totals['revenue'], 2);
    $totals['ecpm'] = $totals['impressions'] ? round($totals['revenue'] / $totals['impressions'] * 1000, 2) : 0;
    $totals['avgDau'] = $daily ? (int) round($totals['activeUsers'] / count($daily)) : 0;
    return ['daily' => array_values($daily), 'apps' => $apps, 'totals' => $totals];
}

/**
 * Devuelve el reporte de los últimos $days días, usando la caché si es reciente.
 * Resultado: ['configured' => bool, 'data' => ?array, 'error' => ?string, 'fetchedAt' => ?string]
 */
function levelplay_report(int $days, bool $force = false): array
{
    $cfg = with_db(function (array &$db) {
        return $db['levelplay'];
    });
    if (empty($cfg['secretKey']) || empty($cfg['refreshToken'])) {
        return ['configured' => false, 'data' => null, 'error' => null, 'fetchedAt' => null];
    }
    $cache = $cfg['cache'] ?? null;
    $fresh = $cache && ($cache['days'] ?? 0) === $days
        && strtotime($cache['fetchedAt']) > time() - LEVELPLAY_CACHE_MINUTES * 60;
    if ($fresh && !$force) {
        return ['configured' => true, 'data' => $cache['data'], 'error' => null, 'fetchedAt' => $cache['fetchedAt']];
    }

    $end = gmdate('Y-m-d');
    $start = gmdate('Y-m-d', time() - ($days - 1) * 86400);
    $token = ($cfg['tokenExp'] ?? 0) > time() + 60 ? (string) $cfg['token'] : '';
    try {
        if ($token === '') $token = lp_fetch_token($cfg['secretKey'], $cfg['refreshToken']);
        try {
            $rows = lp_fetch_stats($token, $start, $end, LP_METRICS);
        } catch (RuntimeException $e) {
            if ($e->getMessage() === 'TOKEN_EXPIRED') {
                $token = lp_fetch_token($cfg['secretKey'], $cfg['refreshToken']);
                $rows = lp_fetch_stats($token, $start, $end, LP_METRICS);
            } elseif (strpos($e->getMessage(), 'HTTP 400') !== false) {
                // Si la cuenta no admite "activeUsers", reintenta solo con ingresos e impresiones
                $rows = lp_fetch_stats($token, $start, $end, ['revenue', 'impressions']);
            } else {
                throw $e;
            }
        }
        $data = lp_aggregate($rows);
        $data['range'] = ['start' => $start, 'end' => $end];
        $now = now_iso();
        with_db(function (array &$db) use ($token, $data, $days, $now) {
            $db['levelplay']['token'] = $token;
            $db['levelplay']['tokenExp'] = time() + 50 * 60;
            $db['levelplay']['cache'] = ['days' => $days, 'fetchedAt' => $now, 'data' => $data];
        }, true);
        return ['configured' => true, 'data' => $data, 'error' => null, 'fetchedAt' => $now];
    } catch (RuntimeException $e) {
        $msg = $e->getMessage() === 'TOKEN_EXPIRED' ? 'LevelPlay rechazó el token. Revisa las credenciales.' : $e->getMessage();
        return ['configured' => true, 'data' => $cache['data'] ?? null, 'error' => $msg, 'fetchedAt' => $cache['fetchedAt'] ?? null];
    }
}
