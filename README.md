# Monster Tower

Juego casual de habilidad y equilibrio para navegador. Apila monstruos de goma, cada uno con una silueta distinta, sin que la torre se derrumbe.

- **Partida infinita:** gana quien apila más monstruos. El récord se guarda en el dispositivo.
- **Física real 2D:** cada monstruo choca con su silueta exacta, no con una caja.
- **Monstruos vivos:** parpadean, miran la pieza que cae, se asustan cuando la torre se tambalea y gritan cuando se derrumba.
- Funciona en teléfono, tableta y computadora, sin instalar nada.

## Cómo se juega

1. **Mueve** la pieza arrastrando sobre la pantalla (o con ← →).
2. **Gírala** con los botones de giro: un toque gira 5°, mantener presionado gira de forma continua (Z / X).
3. **Suéltala** (Espacio). Si un monstruo cae de la plataforma, se acaba la partida.

La caja **Sigue** muestra el próximo monstruo y **Cambiar** reemplaza la pieza actual por esa (3 veces por partida, tecla C). **P** o **Esc** pausan.

## Probarlo en tu computadora

El juego es HTML, CSS y JavaScript sin compilación. Los navegadores no permiten cargar sonidos desde archivos locales (`file://`), así que conviene abrirlo con un servidor local:

```bash
cd monster-tower
python3 -m http.server 8000
```

Y abrir `http://localhost:8000`. Si lo abres con doble clic en `index.html`, el juego funciona pero sin sonido.

## Publicarlo en GitHub Pages

1. Sube esta carpeta a un repositorio de GitHub.
2. En el repositorio: **Settings → Pages → Build and deployment**, elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. En uno o dos minutos el juego queda en `https://<tu-usuario>.github.io/<repositorio>/`.

El archivo `.nojekyll` evita que GitHub procese la carpeta; no lo borres.

## Estructura

```
index.html              pantallas y controles
css/styles.css          estilos (paleta y tipografía de la guía de identidad)
js/
  data/                 datos generados por las herramientas (siluetas, rostros, rutas de recursos)
  config.js             todos los valores ajustables: gravedad, fricción, giro, plataforma…
  geometry.js           división de siluetas cóncavas en piezas convexas
  monsters.js           tipos de monstruo y reparto aleatorio sin repetir
  physics.js            mundo de Planck.js, plataforma y absorción del impacto
  game.js               reglas: soltar, acomodarse, cambiar, derrota y récord
  input.js              teclado, arrastre y botones de giro
  render.js             cámara, fondo con paralaje, luz programada y sombras
  expressions.js        estados de ánimo y dibujo de ojos y bocas
  loop.js               bucle con paso fijo de física (60 Hz) e interpolación
  ui.js                 marcador, vista previa, pausa, derrota y portada animada
  sound.js              efectos de sonido (Web Audio)
  main.js               arranque
lib/planck.min.js       motor de física (Planck.js 1.5.0, licencia MIT)
assets/
  monsters/ ui/ sounds/ fonts/   recursos finales que usa el juego
  source/               originales en alta resolución, sin procesar
tools/                  scripts que convierten los originales en recursos del juego
```

## Decisiones técnicas

- **Canvas 2D y JavaScript puro, sin framework.** Con unas decenas de sprites en pantalla, Canvas 2D sobra en rendimiento y el proyecto no necesita compilación.
- **Planck.js (puerto de Box2D) como motor de física.** Es el estándar para pilas estables: resuelve bien cuerpos apilados, tiene reposo automático y detección continua para piezas rápidas.
- **Paso fijo de física.** La simulación avanza siempre a 60 pasos por segundo, separada del dibujo, para que la torre se comporte igual en un teléfono lento que en una computadora.
- **Colisiones con la silueta real.** `tools/build_assets.py` traza el contorno de cada ilustración desde su transparencia; `geometry.js` lo divide en piezas convexas (triangulación por orejas y fusión de Hertel-Mehlhorn), que es lo que Box2D acepta.
- **Apariencia 3D en 2D.** Las ilustraciones giran por código, nunca con imágenes por ángulo. Como la luz pintada giraría con el monstruo, el juego añade una luz programada que siempre viene de arriba, recortada a la silueta.
- **Física y animación separadas.** El cuerpo físico es la verdad; ojos, respiración y temblores solo se dibujan encima y nunca lo modifican. La respiración deforma el dibujo como máximo 1.2 % para no despegarse del colisionador.
- **Expresiones conectadas a la física.** Cada monstruo tiene un pequeño estado de ánimo (neutral, cayendo, impacto, nervioso, pánico) alimentado por señales reales: contacto, velocidad de la torre y derrota.
- **Ajuste con números.** `tools/sim/physics-check.js` corre la misma física sin navegador para medir cuánto tarda cada monstruo en quedarse quieto, qué combinaciones se pueden apilar y si la torre tiembla. Así se eligieron la absorción del impacto y la resistencia al rodar.

## Herramientas

Requieren Python 3 con `numpy`, `scipy`, `opencv-python` y `Pillow`, y Node.js para la simulación.

```bash
python3 tools/build_assets.py      # monstruos: recorte, sprites y colisionadores
python3 tools/measure_faces.py     # rostros: mide ojos y bocas en las referencias
python3 tools/build_ui.py          # interfaz: limpia bordes y reduce tamaños
node tools/sim/physics-check.js    # física: pruebas de reposo, apilamiento y temblor
```

Para agregar un monstruo: pon su ilustración sin cara en `assets/source/monsters/`, su referencia con cara en `assets/source/faces/`, añádelo a la lista de `build_assets.py` y `measure_faces.py`, y corre los dos scripts.

## Panel de pruebas

Agrega `#pruebas` al final de la dirección para ver, en el menú de pausa, el panel de ajustes: colisionadores visibles, valores de física en vivo, elección de pieza y una prueba de carga que apila monstruos sola midiendo los FPS.

## Créditos

- **Creación y dirección creativa:** Maga.
- **Dirección artística y recursos visuales y sonoros:** generados con ChatGPT bajo la dirección de la creadora.
- **Arquitectura, programación y animación:** desarrolladas con Claude (Anthropic).
- **Planck.js** © Erin Catto y Ali Shakiba, licencia MIT (`lib/planck-LICENSE.txt`).
- **Fredoka** © The Fredoka Project Authors, SIL Open Font License 1.1 (`assets/fonts/Fredoka-OFL.txt`).

© Maga. Todos los derechos reservados sobre el juego, sus personajes y su arte, salvo los componentes de terceros indicados arriba.
