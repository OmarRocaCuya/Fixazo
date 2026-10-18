# Periódico integrado con el MVP de voz

## Fuentes y alcance

- `periodico` (`695bc8a74c377eb5ba2579cd652adc4e6a182ba9`) se fusionó con el MVP (`59fa69329d7d0c6d1fb18c1764bfa1534d69b860`) mediante el merge `5063375`.
- Se trabajó en un worktree aislado para no incluir ni sobrescribir los cambios locales ajenos del checkout principal. No se fusionó a `main` ni se modificaron la aplicación raíz o el proyecto Vercel de Fixazo.
- `/` ofrece el periódico con seis noticias publicadas del archivo importado. `/noticia/[id]` conserva la práctica por pasos y `/insights` el avance local. Los enlaces de navegación llevan de vuelta a `/chat`, `/sesion` y el laboratorio de lenguas.
- Las noticias son material de archivo de la rama importada, no información cuya actualidad o veracidad se haya comprobado durante esta integración. El pipeline raíz se conserva, pero **no se ejecutó ni se programó** una publicación automática.

## Correcciones incluidas

- El juez de OpenRouter está **apagado por defecto**. No se habilitó ni se configuró una clave pagada en esta entrega. Leer, responder por escrito y continuar sin evaluación siguen disponibles.
- Una configuración futura exige `PERIODICO_JUDGE_ENABLED=true`, `OPENROUTER_API_KEY` y el código privado `VOICE_ACCESS_CODE`, además de autorización adulta explícita y mismo origen. El código se mantiene en memoria, no se incluye en el cuerpo ni en una URL.
- Cuerpo máximo de 8 KiB, texto máximo de 800 caracteres, una evaluación activa por instancia y cuotas por código/IP; tres llamadas fijas acotadas en tiempo, respuesta y tokens. **No es una cuota distribuida:** antes de habilitarlo hay que establecer un presupuesto del proveedor y verificar su privacidad.
- Sin proveedor o ante errores, datos inválidos o menos de dos corridas completas: `evaluacion: no_evaluable`, `cuenta: false`, sin habilidades negativas ni intentos consumidos. No se guardan identificadores o respuestas en logs del servidor.
- Detener una segunda grabación conserva el texto acumulado anterior. La captura opcional tiene autorización adulta/sintética explícita, límite y cancelación; detener no envía automáticamente una respuesta.
- Exportar y borrar en `/privacidad` incorpora únicamente `fixazo:resultados`, `fixazo:alumno` y `fixazo:avance:*`, además de los datos familiares existentes. Conserva claves ajenas y reconoce los fallos de almacenamiento sin afirmar un borrado completo.
- Las ediciones JSON se incluyen explícitamente en las funciones de Vercel. Las lecturas dinámicas no hacen que Turbopack trace todo el repositorio. Se retiró del árbol actual un log generado.

## Verificaciones locales ejecutadas

- **637 pruebas web**, 41 suites; ESLint, TypeScript y build de producción correctos, 22 entradas.
- **6 pruebas del pipeline** con Node, sin generar noticias ni ejecutar llamadas pagadas.
- Los traces de portada y de la ruta del evaluador contienen los diez JSON de `data/ediciones` (nueve registros y el índice `usadas.json`).
- Dos incompatibilidades de integración corregidas: `runtime` explícito no admitido con Cache Components y trazado excesivo por rutas de archivos dinámicas. Se conserva Node como runtime predeterminado y la comprobación de capacidades usa `connection()`.

El build y los dobles de los tests no acreditan llamadas reales de OpenRouter ni una evaluación validada con estudiantes.

## Despliegue y verificación de producción — 18 de octubre de 2026

- Los cuatro commits de integración se publicaron en `codex/nawinchay-voice-mvp`. El código desplegado corresponde a `55e70aa354533df5b4b03da6bb73dc23562ca727`; este registro posterior no cambia el código ejecutable.
- Preview `dpl_7PhvFSuK1PMoN2HKof9zSKLFysMn`: estado READY, portada HTTP 200, seis enlaces de noticias, marca Ñawinchay y navegación de voz presentes.
- Producción `dpl_F9vs5LRrtUuA9X6w7Dkdq42EavHN`: estado READY y asignada al proyecto exclusivo `nawinchay-voice-mvp`, cuya carpeta raíz sigue siendo `web`. URL pública: https://nawinchay-voice-mvp.vercel.app/.
- La portada publicada se comprobó en el navegador y se observó la carga de una noticia. No se realizó una grabación real, una evaluación pagada ni una validación pedagógica con estudiantes como parte de esta prueba.
- API publicada del periódico: capacidades `enabled: false`, motivo `periodico-judge-disabled`; POST sin proveedor devuelve `no_evaluable` y `cuenta: false`.
- La API de capacidades de voz sigue informando ASR listo, marcas de palabras disponibles y diálogo local listo para `quy_Latn` y `ayr_Latn`. Es una comprobación de disponibilidad, no una medición de precisión ni de latencia de extremo a extremo.
- También pasaron las **9 pruebas originales de Fixazo**. Los archivos de su aplicación raíz y su proyecto de Vercel no se modificaron por esta integración.
- El avance rápido del checkout principal se detuvo de forma segura porque sobrescribiría cambios pendientes en `web/src/app/(familia)/privacidad/page.tsx`. Ese checkout permanece en `59fa693` con sus cambios intactos; la integración publicada se conserva en el worktree aislado. No se usó stash, reset ni push forzado y no se modificaron `main` ni `periodico`.

## Claude Haiku — configuración privada de la demo

- El juez del periódico mantiene fijado `anthropic/claude-haiku-5.5` mediante OpenRouter, sin selección de modelo desde el cliente. Se conserva el razonamiento desactivado, tres llamadas por evaluación, máximo de 500 tokens por llamada, timeout de 12 segundos y validación estricta de la respuesta. El pipeline importado no se ejecuta como parte de esta configuración.
- Se solicita únicamente enrutamiento a proveedores con `require_parameters: true`, `data_collection: "deny"` y `zdr: true`. Si OpenRouter no encuentra un endpoint elegible o falla el contrato de respuesta, la revisión queda `no_evaluable`, sin consumir intento. Estos filtros son requisitos de enrutamiento declarados por el proveedor, **no una garantía independiente de su comportamiento ni una aprobación de privacidad para menores**.
- Se validó la clave y se confirmó que tiene un límite de gasto configurado. Se guardó `OPENROUTER_API_KEY` como secreto sensible únicamente en producción del proyecto Ñawinchay y se configuró `PERIODICO_JUDGE_ENABLED=true`. No se modificaron secretos de Fixazo ni el código privado existente. La clave no se incluye en código, documentación, navegador ni registros; no se habilitó en previews. El despliegue publicado se comprueba aparte de esta preparación.
- La demo sigue limitada a personas adultas o audio sintético. Se mantiene el código privado `VOICE_ACCESS_CODE` y la autorización explícita de cada sesión; el código se introduce en un campo de contraseña y permanece solo en memoria del cliente. No se autoriza el uso con voces de menores ni respuestas con datos personales.
- Las cuotas actuales son por instancia, no un límite monetario global: el responsable debe establecer un presupuesto de OpenRouter antes de habilitar el acceso. Si una activación posterior se confirma con una prueba real, su evidencia deberá registrarse aparte de esta preparación.

### Verificación de la configuración Haiku

- `npm test`: **637 pruebas / 41 suites** correctas. Pruebas focalizadas del juez, política y ruta: **59 pruebas / 3 suites**. ESLint, TypeScript y build de producción correctos, con 22 rutas.
- Petición real de texto sintético a OpenRouter: el proveedor respondió con `model: anthropic/claude-haiku-5.5`, contenido presente y `finish_reason: stop`, manteniendo los filtros de privacidad.
- Prueba HTTP del build local de producción, con secreto y código temporal solo en memoria: resultado `evaluacion: evaluada`, `ia: true`, `cuenta: true` y dos criterios, en 3708 ms en una ejecución. Esto no es un benchmark ni una validación pedagógica. Se detuvo el proceso temporal después de la prueba.
- Next.js usa `localhost` como origen canónico en este arranque local: el origen `127.0.0.1` fue rechazado con 403 y la repetición con el origen canónico pasó. No se debilitó la comprobación del origen para admitir la prueba.
- Las claves sensibles no se devuelven mediante `vercel env run`; se verificó su presencia en los metadatos de Vercel sin intentar extraerlas ni rotar el código privado existente. Por ello la prueba real del juez se hizo contra el build local equivalente, no como una evaluación autenticada en producción.
- Solo se usó texto sintético adulto. No se probaron micrófonos físicos ni voces infantiles; no se ejecutó el pipeline de noticias.
