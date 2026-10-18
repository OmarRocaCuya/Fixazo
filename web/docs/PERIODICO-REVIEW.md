# Revisión de `periodico`

Revisión de `695bc8a74c377eb5ba2579cd652adc4e6a182ba9`, descargada de `origin/periodico` sin cambiar de rama ni hacer merge. Comparación contra `9e3920c` de la rama de voz: 29 archivos, 3274 inserciones y 17 eliminaciones. Esta revisión no modifica el periódico.

## Hallazgos para corregir antes de publicar

### P1 — Admisión y presupuesto de IA solo en el cliente

`web/src/app/api/periodico/responder/route.ts:40–42` acepta IDs públicos y cualquier texto elegible; `web/src/lib/server/juez-noticia.ts:80` inicia tres llamadas de pago. No hay autenticación, cuota servidor o límite de concurrencia en este camino. Un cliente puede ignorar el límite visual de dos intentos y consumir créditos repetidamente cuando se configure `OPENROUTER_API_KEY`.

**Recomendación:** validar autorización y una cuota/presupuesto servidor antes del juez; limitar concurrencia y tamaño de entrada. La cuota del navegador no es una barrera de seguridad.

### P1 — Un fallo del juez se convierte en resultado educativo negativo

Sin clave o cuando fallan las tres corridas, `responder/route.ts:41` usa `[]`. `web/src/lib/periodico/reglas.ts:77–79` lo convierte en `cumple:false, dudoso:false`, pero la API devuelve `cuenta:true` (`route.ts:60`). `NoticiaFlow.tsx:134–141` consume intentos y, tras dos, guarda la habilidad como falsa (`:298,319`), muestra “Para practicar” (`:359`) e incorpora ese resultado a los insights.

**Recomendación:** distinguir `no_evaluable` de `no_cumple`, devolver `cuenta:false` ante indisponibilidad técnica y no guardar una dificultad del estudiante por un error de infraestructura.

### P2 — La segunda grabación pierde el texto acumulado que muestra

`NoticiaFlow.tsx:165,171` presenta `base + t` mientras se habla, pero `:147–152` sustituye y envía solamente el `stop()` del nuevo transcriptor. Al añadir una justificación por voz tras un intento incompleto, el texto anterior desaparece al terminar y no llega al juez.

**Recomendación:** conservar la base de cada grabación al finalizar, o mostrar explícitamente una respuesta nueva desde el inicio. No mostrar una cosa y evaluar otra.

## Evidencia y alcance

- Las seis pruebas existentes de `reglas.test.ts` pasaron en una copia aislada de ese SHA, usando Vitest de `web/`. No se ejecutaron llamadas pagadas ni se modificaron datos del periódico.
- El caso de corridas vacías está cubierto por esas pruebas, pero su expectativa actual (`cumple:false`) no distingue disponibilidad técnica de capacidad educativa.
- Revisión estática de la ruta, juez, flujo, reglas y persistencia; no constituye aprobación de despliegue ni auditoría completa del pipeline editorial.
- No se mezclaron cambios de `periodico` en `codex/nawinchay-voice-mvp`.
