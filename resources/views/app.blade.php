@php($u = $page['props']['auth']['user'] ?? null)
<!DOCTYPE html>
<html lang="en" data-pal="{{ $u['palette'] ?? 'dusk' }}" data-pref="{{ $u['theme'] ?? 'auto' }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="description" content="Merrymile: Travel Together, Fun Together, Memories for a Lifetime.">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        {{-- Pick light or dark before first paint: Auto is dark from 7 PM to 7 AM local time. --}}
        <script>
            (function () {
                var r = document.documentElement, p = r.getAttribute('data-pref'), h = new Date().getHours();
                r.setAttribute('data-theme', p === 'light' || p === 'dark' ? p : (h >= 19 || h < 7 ? 'dark' : 'light'));
            })();
        </script>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800&display=swap">
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body>
        @inertia
    </body>
</html>
