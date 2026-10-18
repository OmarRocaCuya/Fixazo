# Pendientes

Tareas acordadas que todavía no están hechas. Se tachan al terminarlas.

## Pipeline de noticias

- [x] ~~**Usar solo medios reconocidos.**~~ Hecho el 18 oct 2026. Lista cerrada en `MEDIOS` de `pipeline/pasos.mjs`: 19 medios A (con sello Trust Project, JTI, ranking del Digital News Report o servicio público/agencia) para la noticia principal y 12 medios B solo como segundo medio. Exa busca dentro de la lista y Tavily extrae el texto; sin `EXA_API_KEY` busca Tavily con los mismos dominios. Se excluyen opinión, etiquetas, programas y comunicados. Se retiraron las noticias de medios fuera de la lista.
  - Más adelante, evaluar la opción de dejar entrar medios de opinión solo si tienen un segundo medio de otra mirada y se marcan como "medio de opinión" en la portada.

## Despliegue y entrega

- [ ] Desplegar en el servidor de Hetzner con dominio y HTTPS (el micrófono solo funciona en contexto seguro). App: `cd web && npx next build && npx next start`. Pipeline: cron `*/30 * * * *` con `node pipeline/correr.mjs`. Variables: `OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, `EDICIONES_DIR` y `REGISTRO_DIR` si se usan otras carpetas.
- [ ] Hacer el repo público o confirmar con la organización cómo lo revisan los jurados.
- [ ] Entregar con `andes project submit` antes del domingo 18 a las 9:00 (URL pública, demo en vivo, repo y descripción).

## Rachas (para después)

- [x] ~~**Racha suave de lectura.**~~ Hecha el 18 oct 2026 (`web/src/lib/periodico/racha.ts` con 7 pruebas, `components/periodico/Racha.tsx`). Diseño e investigación en `RACHAS-diseno-simple.md` (carpeta de la hack). Reglas:
  - el día cuenta si se termina al menos una noticia;
  - hay un día de gracia por semana, en el que la racha queda en gris;
  - nunca se muestra "perdiste tu racha", sino "Empieza otra racha hoy" y la mejor racha;
  - se recupera terminando 2 noticias al día siguiente;
  - hay marcas a los 3, 7, 14 y 30 días.

  No lleva puntos, premios, rankings ni rachas con amigos. Se calcula con las fechas que ya guarda `fixazo:resultados` (una función pura `racha(fechas, hoy)` con prueba, una pastilla en la portada y los días de la semana en Mis insights). Base: un experimento del BID con 60.000 escolares de Perú (Cristia y otros, 2024).

## Voz

- [ ] Conectar el backend de voz que está preparando Daniel en su servidor (transcripción mejor que la del navegador y soporte en iPhone). Hoy se usa `createTranscriber("es")` con la transcripción del navegador.
