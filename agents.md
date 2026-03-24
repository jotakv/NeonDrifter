# AGENT ROLE: NEON DRIFTER ARCHITECT

## 1. Contexto del Proyecto
Eres un desarrollador experto en juegos 2D (HTML5/JS Nativo). El proyecto es "Neon Drifter", un survival-racer de estética retrowave. El objetivo es transformar una demo técnica de 30 segundos en un videojuego infinito, estable y con mecánicas profundas de "Shape-Shifting".

## 2. Objetivos de Implementación (Prioritarios)

### A. Sistema de Niveles e Infinitud
- **Eliminar el Hard-Stop:** El juego no debe terminar por tiempo, sino solo por colisión o alcance de la Glitch Wall.
- **Dificultad Escalonada:** Implementar una variable `globalSpeed` que aumente un 5% cada 15 segundos.
- **Fases Dinámicas:** Cada 1000 puntos, cambiar el patrón de spawneo (ej. Fase 1: Estáticos, Fase 2: Láseres móviles, Fase 3: Zig-zag).

### B. Mecánica de "Formas y Vidas" (Shape-Shifting)
- **Cambio de Estado:** El jugador puede alternar entre 3 formas (Círculo, Triángulo, Cuadrado) usando una tecla (ej. 'Shift' o 'E').
- **Filtrado de Pickups:** - Si `player.shape == 'circle'`, solo suma puntos/vida si colisiona con `item.shape == 'circle'`.
  - Si la forma no coincide, el item se ignora o penaliza levemente.
- **Visual:** El `ctx.draw` del jugador debe cambiar según el estado actual.

### C. Dinámica de la "Glitch Wall" (Muro de Atrás)
- **Presión Constante:** Si el jugador no recoge "Data Scraps" o "Power-ups" en 10 segundos, la `glitchWall.x` debe avanzar más rápido hacia la derecha.
- **Retroceso:** Al obtener puntos extra o vidas, la pared debe retroceder `X` píxeles hacia la izquierda para dar respiro al jugador.

### D. Gestión del Menú y Pausa
- **Estado de Pausa:** Implementar un `gameState = 'PAUSED'` que congele el `requestAnimationFrame` pero permita renderizar el overlay del menú.
- **Estabilidad:** Asegurar que al reanudar no haya saltos bruscos en el `deltaTime`.

## 3. Guía de Estilo de Código
- **Nativo:** Prohibido el uso de librerías externas (Phaser, Three.js). Solo Canvas API.
- **Modularidad:** Separa la lógica de colisiones en una función `checkCollisions()` y el renderizado en `drawScene()`.
- **Efectos:** Usa `ctx.shadowBlur` y `ctx.shadowColor` para mantener la estética Neón.

## 4. Instrucciones para Iterar
1. **Paso 1:** Refactoriza el bucle principal para aceptar un sistema de estados (`MENU`, `PLAYING`, `PAUSED`, `GAMEOVER`).
2. **Paso 2:** Crea la clase o prototipo `Obstacle` que acepte una propiedad `shape`.
3. **Paso 3:** Implementa la lógica de la pared trasera vinculada al rendimiento del jugador.
4. **Paso 4:** Añade el sistema de cambio de forma en el input listener.