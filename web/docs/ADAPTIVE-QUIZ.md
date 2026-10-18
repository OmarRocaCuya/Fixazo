# Quiz adaptativo, micrófono de sesión e informe final

## Protocolo recuperado y alcance

El dossier anterior `contraprueba-protocolo-completo` describe: texto autorizado, tareas y rúbrica, intento, apoyo pertinente, contraevidencia, una nueva tarea sin pistas e informe comprensible. La rama del periódico contiene preguntas y rúbricas específicas de cada noticia; no se ejecutó ni se regeneró el pipeline de noticias.

Esta implementación adapta el apoyo al fragmento y a la pregunta de opción múltiple ya escrita, conserva el primer intento y registra un segundo intento con apoyo. Las predicciones y opiniones no se califican como correctas o incorrectas. El contraste remite a la fuente B y a la postura anterior, sin premiar cambiar o mantener de opinión. La explicación final se revisa solo contra su rúbrica y citas de la respuesta actual.

**Límite pedagógico:** no se ha añadido ni validado un banco de tareas nuevas de transferencia independiente. Un acierto con pistas o en el mismo texto no demuestra dominio. El informe separa el primer intento del resultado con apoyo y no inventa esa observación si el avance procede del formato anterior.

Haiku recibe, opcionalmente, hasta doce selecciones múltiples. El servidor resuelve sus preguntas y opciones desde la noticia; no acepta textos o instrucciones del cliente para ese contexto. Las elecciones personalizan la retroalimentación, no son evidencia para la calificación de la respuesta libre. Se mantiene la validación estricta, las cuotas y el resultado no evaluable ante fallos.

## Audio: cambio explícito respecto del dossier

El usuario pidió mantener el **micrófono durante el quiz**, no lectura automática de las preguntas. Se cambia la recomendación anterior de no escucha continua por una sesión de captura voluntaria, visible, acotada y transitoria:

- Iniciar audio es una acción explícita. Montar la página no solicita permiso ni envía audio.
- Se usa una sola captura PCM, no Web Speech ni un segundo analizador. La transcripción castellana utiliza Meta ASR mediante el backend autenticado, evitando depender de Web Speech en Opera.
- El código privado se mantiene en memoria y se comparte entre ASR y juez dentro de la práctica. No se guarda en el avance ni en el informe. El MVP ya no pide autorización adulta ni consentimiento (decisión de producto); el navegador pide el micrófono al pulsar Iniciar.
- Se procesan segmentos de 8 segundos, con un máximo de 10 minutos por inicio. Hay una petición de transcripción activa y una pendiente, sin una cola ilimitada. Se detiene con aviso al saturarse o fallar; siempre se puede escribir.
- Los fragmentos que cruzan un cambio de pregunta y los resultados tardíos se descartan para no contestar otra pregunta. Puede haber una espera de preparación tras cambiar de paso: no es reconocimiento instantáneo palabra por palabra.
- Una orden de opción múltiple solo preselecciona una alternativa inequívoca; el usuario debe confirmarla. La explicación libre permanece editable y solo se envía el texto visible al pulsar su botón.
- Pausar, ocultar la pestaña, desmontar o finalizar detiene la captura y cancela el trabajo pendiente. Volver a la pestaña no reactiva el micrófono. Una renovación interna de segmento solo ocurre en la misma sesión explícitamente activa y visible.
- No se almacenan grabaciones. No se incorporan modelos de emociones, identidad vocal, salud, atención o engaño. Las pausas o métricas acústicas no observadas permanecen sin medir, no se rellenan con ceros ni etiquetas.

La captura requiere HTTPS o localhost y permiso del navegador. Su implementación y pruebas con dobles no acreditan una prueba de micrófono físico en Opera o un celular. El modelo ASR no constituye una evaluación validada de voces infantiles.

Se conservaron los segmentos de 8 segundos para no duplicar la cuota compartida de Meta (90 solicitudes/10 minutos por proceso, usada también por traducción, TTS y diálogo). No se elevaron los límites del servidor ni se modificó el VPS compartido. Su semáforo serializa inferencias, pero no garantiza latencia; cancelar una petición en el navegador no asegura interrumpir el trabajo Python ya iniciado. Si otra actividad consume el cupo o el modelo está ocupado, se muestra una parada y se conserva la alternativa escrita.

## Entrada sin pantalla previa

La ruta antigua `/consentimiento` redirige a `/chat`; desaparece el aviso previo y no se crea un consentimiento ficticio ni se activa el micrófono al entrar. Se puede usar el texto sin perfil. Privacidad es informativa y conserva exportación y borrado (incluidas las estimaciones experimentales); ya no tiene interruptores de permisos. La captura sigue requiriendo una acción explícita dentro de la sesión.

## Reporte y familia

Al terminar un quiz se muestra su informe, con resultados observados, primeros intentos frente a apoyo, explicación revisada o no evaluable y siguiente paso. Las sesiones guiadas abren automáticamente su informe guardado al finalizar.

Compartir con un familiar siempre requiere una acción y ofrece una vista previa. Se puede abrir el panel nativo, preparar un WhatsApp, copiar o descargar TXT. No se recoge un contacto ni se envía un mensaje automáticamente. El resumen utiliza una lista explícita de campos: no incluye alias, tema, respuestas textuales, audio, caritas ni opiniones personales. Abrir una aplicación de compartir no permite afirmar que un familiar recibió el mensaje.

El avance y los resultados siguen en el mismo almacenamiento local cubierto por exportar/borrar en Privacidad. No se añadió una base de datos, servicio de correo ni dependencia de mensajería.

## Despliegue y límites

Los cambios pertenecen al frontend del proyecto Ñawinchay con raíz `web`, en el worktree aislado de la rama `codex/nawinchay-voice-mvp`. La rama de publicación `codex/mvp-release` integra además el reconocedor experimental de emociones (emotion2vec+) y la lectura enriquecida; no se modifica la aplicación raíz de Fixazo.

Las comprobaciones ejecutadas y el identificador de la publicación se añaden al completar la integración. No se acredita transferencia independiente, validación pedagógica con estudiantes, entrega real a un familiar ni acceso sin restricciones a proveedores de pago.

## Verificación local

- Suite completa: **711 pruebas en 49 suites**, ESLint y TypeScript correctos. El resultado del build, la prueba del navegador y la publicación se registran al finalizar.
- Prueba de la entrada antigua: dos casos confirman la redirección directa sin permisos inventados ni captura al montar.
- Los tests usan dobles de captura, proveedor y plataforma de compartir: no se enviaron datos de menores, no se realizó una entrega a un familiar y no se afirma que se haya probado un micrófono físico.
