# Fixazo

## MVP educativo de cinco capas · Ñawinchay

El MVP con castellano/quechua, sesiones, evidencia y revisión familiar/docente está en [`web/`](web/README.md). Es una aplicación distinta de Fixazo.

```sh
npm run mvp          # Ñawinchay: http://localhost:3000
npm run test:mvp     # Pruebas del MVP
npm run build:mvp    # Compilación de producción
```

`npm run dev` desde esta raíz sigue iniciando Fixazo. No levantes ambas apps en el mismo puerto.

**Para desplegar Ñawinchay:** sigue [`web/DEPLOYMENT.md`](web/DEPLOYMENT.md), con Root Directory `web` y preset Next.js. Los pasos de Vercel más abajo en este README corresponden únicamente a Fixazo y no deben aplicarse al MVP Next.

**Emoción experimental de Ñawinchay:** sólo desde audio con emotion2vec+ y el código de acceso del despliegue (sin pantalla de consentimiento ni confirmación adulta en el MVP), nunca desde texto ni con reemplazo heurístico. El modelo real ya se ejecutó en CPU Windows; eso no acredita por sí solo la cadena HTTP/UI ni un despliegue. La [guía local aislada](web/services/indigenous/EMOTION_LOCAL.md) explica cómo arrancarlo y verificarlo sin afectar Fixazo.

Para voz, prueba Chrome en la misma computadora: no es necesario usar móvil. Opera puede permitir micrófono sin ofrecer transcripción. En móvil, abrir una IP de red con HTTP no habilita el micrófono: se necesita HTTPS. Siempre puedes continuar con transcripción manual, sin penalizar un fallo técnico como respuesta incorrecta.

Web para escolares (12 a 16 años) que entrena **lectura crítica de fuentes**. El alumno lee dos fuentes reales que cuentan distinto el mismo hecho, predice qué dirá cada una, elige y **explica con su voz por qué**. La IA no da respuestas: revisa la explicación y devuelve una pista para que el alumno la encuentre solo.

Texto de prueba inicial: **Sputnik, 1957**, contado por TASS (agencia del gobierno soviético) y por Eisenhower (presidente de EE. UU.). Vamos a probar con otros textos; cada uno es un archivo en `casos/`.

Hack the Andes 2026 · track Educación Escolar · equipo Fixazo.

> El trabajo anterior del equipo sobre Ñawinchay (PRD, diseños e investigación) está en la rama [`nawinchay`](../../tree/nawinchay).

## Cómo funciona

```
Ficha de la fuente ─► Predice ─► Lee (un párrafo en foco) ─► Elige ─► Explica con la voz ─► Pista ─► Repaso en 2 días
```

- **Las fuentes son reales y curadas a mano.** La IA nunca escribe textos históricos (`casos/`).
- **Las preguntas siguen las habilidades de lectura de fuentes** del Stanford History Education Group: procedencia, contexto, corroboración y lectura atenta, más una de comprensión.
- **Lo cerrado lo corrige el código** (elegir, ordenar, tocar la frase). **La explicación la revisa la IA** con criterios de cumple / no cumple.
- **La IA tiene que citar la frase del alumno** que prueba cada criterio. Si la cita no aparece literal en la respuesta, el criterio no cuenta (`lib/reglas.js`).
- **Guardia:** si la retroalimentación de la IA revela la respuesta, se reemplaza por una repregunta escrita por nosotros.
- **Si la IA falla o tarda, el alumno no se traba:** recibe una pista de plantilla.
- **Voz:** se toca para hablar y se toca para terminar. El navegador convierte la voz en texto (Web Speech API) y la IA solo recibe texto. Mientras escucha, los bordes de la pantalla brillan y siguen el volumen.
- **Registro de interacciones** (tiempo, pistas, cambios de opción, pegado de texto) para adaptar y medir.

## Estructura

```
public/        frontend (HTML, CSS y JS sin framework)
api/           funciones del servidor (Vercel): caso, responder, eventos
lib/           reglas en código, llamada al LLM, registro
casos/         casos curados (fuentes, preguntas, criterios privados)
test/          pruebas (node --test)
dev.js         servidor local que imita a Vercel
```

Lo privado de cada caso (criterios, respuestas correctas y respuesta modelo) **nunca viaja al navegador**: `api/caso.js` lo quita y una prueba lo verifica.

## Correr en local

Requiere Node 22 o más.

```sh
# 1. Crear .env.local con la clave de OpenRouter (no se sube al repo)
echo 'OPENROUTER_API_KEY=tu_clave' > .env.local

# 2. Levantar
npm run dev        # http://localhost:3000

# 3. Pruebas
npm test
```

Sin clave, la app funciona igual con pistas de plantilla. Para hablar, usa Chrome o Edge (otros navegadores escriben).

## Desplegar (Vercel)

1. Importar el repo en Vercel (framework: Other, sin build).
2. En *Settings → Environment Variables* agregar `OPENROUTER_API_KEY`.
3. Vercel sirve `public/` y convierte `api/*.js` en funciones.

## IA y costo

- Modelo único: `anthropic/claude-haiku-5.5` vía OpenRouter, con salida JSON estructurada y sin razonamiento extendido.
- Cerca de **US$0.0002 por respuesta** y **US$0.001 por alumno** (medido en pruebas el 17 oct 2026).

## Fuentes

- TASS, *Pravda*, 5 oct 1957, en F. J. Krieger, *Behind the Sputniks* (1958), pp. 311-312. NASA History Division: https://www.nasa.gov/history/sputnik/14.html
- Eisenhower, conferencia de prensa del 9 oct 1957. The American Presidency Project (UC Santa Barbara): https://www.presidency.ucsb.edu/documents/the-presidents-news-conference-308

Fragmentos con fin educativo. La traducción al español es nuestra.

## Evidencia detrás del diseño

- Wineburg (1991) y Reisman (2012): trabajar con fuentes que se contradicen mejora el razonamiento y la comprensión lectora.
- Richland, Kornell y Kao (2009): intentar responder antes de leer mejora el aprendizaje aunque se falle.
- Bastani et al. (2025, *PNAS*): la IA que da respuestas empeora el examen; con pistas, ese daño desaparece.
- Wisniewski, Zierer y Hattie (2020): la retroalimentación con información sobre el proceso funciona (d = 0.48).
- Hoober (2013, 2017): zona del pulgar y tamaño de los objetivos táctiles.
