# Rowing App — remo en casa

App web para entrenar en máquina de remo. Armás rutinas, seguís el ritmo con un remero animado y, si querés, navegás por un río 3D que se genera solo mientras remás.

Funciona en el navegador del celular (vertical y horizontal) y en la compu. No necesita servidor ni cuenta: todo se guarda en el navegador.

## Qué hace

- **Rutinas por tramos**: remo por tiempo y ritmo, remo por distancia en un tiempo objetivo (calcula las paladas por minuto necesarias), descansos, vueltas repetidas y combinación de rutinas. Favoritas con estrella.
- **Empezar rápido**: por tiempo, por distancia o remo libre.
- **Guía de ritmo**: "Tirá" / "Volvé" con colores, remero animado y sonidos distintos para cada fase (campanita, marimba, gota o voz), destello opcional y vibración en Android.
- **Modo navegación**: río 3D procedural con 12 paisajes (bosque, pueblo, delta, montaña, canales, selva, nieve, desierto, costa, campo, ciudad, lagos del sur), estaciones, día y noche, clima cambiante, animales, barcos, lugares especiales y la línea de llegada que se ajusta a tu ritmo real.
- **Mapas numerados**: del 1 al 999.999. Cada número arma su propio mundo; podés repetir un mapa desde el historial.
- **Historial** con tiempo, distancia estimada, paladas y el mapa usado.
- **Calculadora** de ritmo cada 500 m, velocidad, potencia aproximada y paladas.
- **Pantalla encendida** mientras remás (Wake Lock, con un video silencioso como respaldo).
- **Instalable y offline**: se puede agregar a la pantalla de inicio y funciona sin conexión después de la primera visita.

## Estructura

```
index.html              página principal
css/styles.css          estilos
js/app.js               toda la lógica (rutinas, reproductor, río 3D)
sw.js                   service worker (offline)
manifest.webmanifest    datos para instalar como app
icons/                  íconos
```

Dependencias externas, cargadas desde CDN: [three.js r128](https://cdnjs.com/libraries/three.js) (solo para el río 3D) y las fuentes Barlow y Big Shoulders Display de Google Fonts.

## Probarlo en tu compu

Tiene que servirse por HTTP (abrir el archivo directo con doble clic funciona, pero sin modo offline ni instalación):

```bash
cd rowing-app
python3 -m http.server 8000
# abrí http://localhost:8000
```

## Publicarlo con GitHub Pages

1. Creá un repositorio en GitHub y subí el contenido de esta carpeta:
   ```bash
   git init
   git add .
   git commit -m "Rowing App: primera versión"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/rowing-app.git
   git push -u origin main
   ```
2. En el repositorio: **Settings → Pages → Build and deployment**, elegí **Deploy from a branch**, rama `main` y carpeta `/ (root)`. Guardá.
3. En uno o dos minutos queda en `https://TU_USUARIO.github.io/rowing-app/`.
4. En el celular, abrí esa dirección y usá **Agregar a pantalla de inicio**. Se abre en pantalla completa como una app.

## Notas

- **Metros por palada**: la distancia es una estimación. En *Ajustes → Medirlo con tu máquina* podés calibrarla con lo que marca tu monitor.
- **Datos**: rutinas, historial y ajustes se guardan en el `localStorage` del navegador. Si borrás los datos del sitio, se pierden.
- **Actualizaciones**: si cambiás archivos, subí el número en `CACHE` dentro de `sw.js` (por ejemplo `rowing-v6`) para que los celulares tomen la versión nueva.
- **Mapas**: si agregás paisajes o elementos nuevos al generador, los números de mapa viejos pueden armar mundos algo distintos.
