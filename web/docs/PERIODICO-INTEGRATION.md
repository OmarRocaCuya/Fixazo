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

El build y los dobles de los tests no acreditan llamadas reales de OpenRouter ni una evaluación validada con estudiantes. La prueba del despliegue y del navegador se registra a continuación cuando se complete.
