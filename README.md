# Fixazo

Un periódico web para jóvenes de secundaria (12 a 16 años) que entrena el **pensamiento crítico con noticias reales del día**. Cada noticia viene con unas pocas preguntas que se desbloquean una por una: predecir qué dirá el medio, leer un fragmento, ver **quién habla y por qué lo cuenta así**, comparar con cómo lo cuenta otro medio y, al final, **explicar con la propia voz por qué** se piensa lo que se piensa. La IA nunca da la respuesta: revisa si el joven dio razones sacadas de la noticia y, si le falta algo, le hace una pregunta para que lo encuentre solo.

Hack the Andes 2026 · track Educación Escolar · equipo Fixazo (Mateo Rodríguez, Omar Roca y Daniel Marron).

- **Demo:** https://fixazo-voice-mvp.vercel.app/ (la portada es el periódico). Presentación: https://fixazo-pitch.vercel.app
- **La app está en `web/`** (Next.js). **El pipeline de noticias está en `web/pipeline/`**, y también se puede correr en vivo desde la página `/generar` (botón "Buscar una noticia nueva").

## Por qué

- Al terminar el colegio, solo 1 de cada 10 peruanos lee al nivel esperado, y solo el 8 % de los escolares no usa IA.
- Cuando la IA les da la respuesta, rinden peor en el examen. Cuando los obliga a pensar, aprenden más (Bastani y otros, *PNAS* 2025).
- Para 2050, Harari dice que nadie sabe qué enseñar, pero sí que hará falta **dar sentido a la información y distinguir lo importante**. PISA 2029 va a medir justamente el criterio frente a la IA.
- El pensamiento crítico no se enseña en abstracto: depende de lo que se lee (Willingham). Por eso usamos noticias reales, y no ejercicios inventados.

## Cómo funciona

```
pipeline (Node: a mano, con cron o con el botón de /generar)
  Exa busca noticias de IA de las últimas 24 h, solo en 19 medios confiables
  → filtra (temas no aptos para menores, opinión, comunicados, idioma)
  → busca el mismo hecho en un segundo medio
  → Tavily extrae el texto
  → Haiku 5.5 elige fragmentos TEXTUALES y escribe 8 pasos con estructura fija
  → el código valida: citas literales, ≤ 90 palabras, índices, y que toda cifra de una respuesta correcta esté en el fragmento
  → una ronda de corrección; si no pasa, se guarda como "rechazada"
  → web/data/ediciones/<día>/<hora>-<slug>.json

app (web/, Next.js)
  portada → noticia paso a paso → respuesta con voz → juez → Mis insights
```

### Los 8 pasos de cada noticia

1. **Predicción:** antes de leer, ¿cómo crees que lo contará este medio?
2. **Fragmento A** del primer medio.
3. **Comprensión:** qué dice el texto.
4. **Procedencia:** quién habla y por qué lo cuenta así.
5. **Una pregunta variable**, según lo que tenga la nota: dato o afirmación sin fuente, palabra que convence, hecho u opinión, o cómo comprobarlo.
6. **Postura y seguridad:** qué opinas y qué tan seguro estás.
7. **Contraprueba:** fragmento B (otro medio u otra voz) y "¿mantienes o cambias tu idea?".
8. **¿Por qué?, con tu voz.**

Responder, aunque sea mal, desbloquea el siguiente paso. Cada respuesta trae una explicación, nunca solo ✓ o ✗. Las preguntas ya respondidas se cierran para que se vea una idea a la vez.

### La IA y lo que la controla

- **Un solo modelo:** `anthropic/claude-haiku-5.5` vía OpenRouter, sin razonamiento extendido y con salida JSON estricta.
- **No reescribe noticias:** elige fragmentos literales y el código lo comprueba. Se muestran con el nombre del medio y el enlace a la nota completa.
- **El juez de la respuesta de voz corre 3 veces en paralelo.** Un criterio cuenta solo si la mayoría coincide **y cita una frase que está literal en lo que dijo el joven**. Si las corridas no coinciden, el criterio queda como dudoso.
- **Guardia:** si la retroalimentación de la IA revela la respuesta modelo, se reemplaza por una repregunta escrita por nosotros.
- **Si la IA falla o no está disponible**, la respuesta queda "no evaluable" y no cuenta como error del joven.
- **Los criterios, la respuesta modelo y las frases prohibidas nunca viajan al navegador.**

### Voz

- La voz se transcribe en el navegador. La IA solo recibe texto y nunca habla.
- La capa de voz de Daniel mide **señales del proceso**: pausas largas, muletillas y palabras de duda, y además da una **estimación experimental de emociones** desde el audio (emotion2vec+). Es una estimación, no un diagnóstico.
- `web/services/indigenous` es el servidor de voz de Daniel, con modelos de Meta, para castellano, quechua y aimara y con el tiempo de cada palabra. Ver [web/README.md](web/README.md).

### Mis insights y racha

- **Mis insights:** el avance por habilidad, cómo explica cuando habla y la comparación entre su seguridad declarada y lo que logró. Se guarda solo en el navegador del joven, no hay cuentas.
- **Racha suave:** el día cuenta si termina al menos una noticia. Tiene un día libre por semana y nunca se muestra "perdiste tu racha". No hay puntos ni premios. Se basa en Cristia y otros (BID, 2024), un experimento con 60.000 escolares de Perú.

## Decisiones y lo que quedó fuera

| Decisión | Por qué |
|---|---|
| Solo **19 medios con señal de confianza** como fuente principal: Trust Project, certificación JTI, ranking del Digital News Report o servicio público o agencia. Hay 12 más de reserva, solo como segundo medio | Al principio entraban medios partidistas y estatales |
| **Exa para buscar y Tavily para extraer** | Probamos los dos con 33 medios. Exa trae notas recientes con fecha y Tavily extrae el texto completo |
| **Fragmentos cortos con enlace**, no la nota entera | Derechos de autor, y además se lee menos |
| **Estructura fija de 8 pasos** | Se basa en el Historical Thinking Chart de Stanford: procedencia, contexto, corroboración y lectura atenta. También en que intentar responder antes de leer ayuda a aprender (Richland 2009) |
| **Sin puntos, insignias ni rankings** | Los premios esperados bajan la motivación propia (Deci, Koestner y Ryan 1999) |
| **Progreso en el navegador, sin cuentas** | Privacidad de menores y menos piezas. El costo es que no pasa de un dispositivo a otro |

**Límites actuales:**
- En la web publicada las noticias no se actualizan solas: el pipeline se corre a mano. El botón de `/generar` arma una noticia en vivo, pero en Vercel no se puede guardar (el disco es de solo lectura), así que ahí se ve como vista previa.
- La voz del navegador funciona en Chrome y Edge, y en iPhone se responde escribiendo.
- No está validado con escolares todavía.
- El juez puede equivocarse. Por eso hay 3 corridas, cita literal y "no evaluable".

## Estructura

```
web/                 la app: portada, noticia, juez, insights, racha (Next.js 16, React 19)
  src/lib/periodico/   reglas del juez, lectura de ediciones, progreso, racha (con pruebas)
  src/lib/server/      juez de noticias (Haiku vía OpenRouter)
  data/ediciones/      noticias generadas por el pipeline (JSON)
  services/indigenous  servidor de voz de Daniel (Python)
  pipeline/            pipeline de noticias (Node, sin dependencias)
    pasos.mjs            filtros, lista de medios, validación y armado (con pruebas)
    correr.mjs           búsqueda, extracción, generación y guardado
  src/app/generar      botón de demo que corre el pipeline en vivo y muestra cada paso
PENDIENTES.md        tareas acordadas
public/ api/ lib/ casos/ test/ dev.js   primera versión (prototipo de Sputnik, 17 oct); no se usa en la demo
```

## Correr en local

Requiere Node 22 o más. Las claves van en archivos `.env.local`, que no se suben al repo.

```sh
# App
cd web && npm install
npm run dev                      # http://localhost:3000
npm test                         # pruebas (vitest)

# Pipeline (desde web/): necesita TAVILY_API_KEY y OPENROUTER_API_KEY; EXA_API_KEY es opcional
# (sin ella busca con Tavily). Van en web/.env.local. Para el botón de /generar: PERIODICO_DEMO_GENERAR=true.
node pipeline/correr.mjs                 # genera una noticia
node pipeline/correr.mjs --cada 30       # una cada 30 minutos
node --test pipeline/pasos.test.mjs      # pruebas del pipeline
```

Las variables de la app (juez y voz) y el despliegue están en [web/DEPLOYMENT.md](web/DEPLOYMENT.md).

## Costo medido (18 oct 2026)

- **Generar una noticia** cuesta entre US$ 0,05 y 0,09 (Exa más Haiku) y toma entre 13 y 78 segundos. En la corrida del 18 oct el validador rechazó 3 de 7.
- **Revisar una respuesta de voz** son 3 llamadas cortas a Haiku, de 500 tokens como máximo cada una.

## Evidencia detrás del diseño

- Wineburg (1991) y el Stanford History Education Group, con el Historical Thinking Chart: leer fuentes que se contradicen.
- Richland, Kornell y Kao (2009): intentar antes de leer ayuda aunque se falle.
- Bastani y otros (2025, *PNAS*): la IA que da respuestas empeora el examen, y con pistas el daño desaparece.
- Wisniewski, Zierer y Hattie (2020): la retroalimentación con información sobre el proceso funciona (d = 0,48).
- Silverman y Barasch (2023) y Cristia y otros (BID, 2024): cómo funcionan las rachas.
- Nielsen Norman Group, *UX Design for Teenagers*: poco texto, nada infantil.
