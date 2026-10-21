# Retomar un objetivo en la próxima lectura

Al terminar una noticia, el lector puede elegir **Recordar este objetivo**. La portada y Mis insights recuperan los objetivos guardados para continuar en otra visita. No se interpreta un resultado como dominio, diagnóstico ni una característica permanente del estudiante.

El lector elige cada guardado. Solo se envía uno de tres objetivos redactados por la aplicación, sin nombre, respuestas, puntuaciones, audio, emociones ni transcripciones. Los resultados de lectura siguen siendo locales. **Borrar objetivos guardados** elimina los objetivos de este navegador en Atomic Memory sin borrar los resultados locales.

## Habilitar en el servidor

Configura las cuatro variables de `.env.example`: `ATOMICMEMORY_ENABLED=true`, `ATOMICMEMORY_API_URL`, `ATOMICMEMORY_API_KEY` y `PRACTICE_MEMORY_COOKIE_SECRET`. Genera el secreto con al menos 32 caracteres aleatorios. La clave de Atomic Memory nunca llega al navegador.

La identidad es una cookie aleatoria, firmada, HttpOnly y SameSite=Strict, con Secure en producción. No se acepta un identificador enviado en el cuerpo. Cada navegador tiene un sujeto independiente y las lecturas y escrituras usan el mismo `user_id`, sin `session_id` ni namespace. La cookie vence a los 30 días; esto no configura la retención del proveedor. Si se borra la cookie o se usa otro dispositivo, no se pueden recuperar ni borrar estos objetivos desde la aplicación. Configura la política de conservación del proyecto antes de un piloto real.

El servicio usa HTTP del lado del servidor, sin agregar dependencias. Aplica un límite de 2,5 segundos y reutiliza la cuota por IP y global del juez del periódico, que es por instancia, no un límite de gasto distribuido. Configura también un presupuesto en el proveedor. Un fallo no impide leer ni responder; nunca se muestra un guardado o borrado exitoso si el proveedor falla. Sin configuración, el flujo anterior no cambia.

Referencias: [identidad y scope](https://docs.atomicstrata.ai/sdk/concepts/scopes-and-identity), [API HTTP](https://docs.atomicstrata.ai/api-reference/http).

## Reproducir la demo local

La demo usa el producto real con un proveedor HTTP simulado local. No demuestra una llamada al servicio alojado de Atomic Memory ni su relevancia semántica. No necesita credenciales reales.

1. Ejecuta `node scripts/demo-practice-memory.mjs` desde `web`.
2. En otra terminal, inicia Next con estos valores de desarrollo:

```sh
ATOMICMEMORY_ENABLED=true \
ATOMICMEMORY_API_URL=http://127.0.0.1:4811 \
ATOMICMEMORY_API_KEY=fixture-key \
PRACTICE_MEMORY_COOKIE_SECRET=demo-only-cookie-secret-at-least-32-characters \
npm run dev -- --hostname 127.0.0.1 --port 4810
```

3. Abre `http://localhost:4810`. Termina una lectura y guarda su objetivo. Vuelve a la portada y recarga: el objetivo se recupera a través del backend. Bórralo desde la portada y verifica que no reaparece al recargar.
4. Detén el proveedor y repite el guardado. Debe aparecer un aviso de que no se guardó, conservando la lectura local.

Pruebas: `npm test -- src/lib/server/practice-memory.test.ts`.
