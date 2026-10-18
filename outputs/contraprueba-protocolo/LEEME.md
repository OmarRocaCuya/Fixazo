# Contraprueba — mapa editable y dossier

## Para leer

Abra `contraprueba-protocolo.html` en un navegador. Seleccione una de las 14 secciones; use +/− para acercar y arrastre para desplazar. El visor funciona sin servidor ni dependencias externas. Los enlaces de fuentes sí requieren internet.

## Para editar

Abra Excalidraw y arrastre `contraprueba-protocolo.excalidraw` al lienzo, o use su opción Abrir. Shift+1 ajusta el dibujo completo. Las secciones son marcos con texto y formas editables, no capturas pegadas.

## Archivos

- `contraprueba-protocolo.excalidraw`: escena editable, 14 marcos y 631 elementos.
- `contraprueba-protocolo.svg`: versión vectorial del mismo contenido.
- `contraprueba-protocolo.html`: visor por secciones y 26 fuentes.
- `dossier.md`: fundamentos, protocolo, rúbricas, métricas, privacidad, costes, mercado y límites.
- `board-content.json` y `build-board.py`: contenido y generador reproducible con Python estándar.

## Alcance

Fecha de contraste: 17/10/2026. «Evidencia» identifica una fuente externa, no eficacia demostrada de Contraprueba. «Propuesta» es diseño sugerido. «Por validar» marca hipótesis o resultados pendientes. Tarifas y disponibilidad pueden cambiar. Es un diseño de producto, no una aplicación educativa conectada.

## Comprobaciones realizadas

- JSON y SVG válidos; IDs y referencias de marcos/fuentes comprobados.
- Importación real en Excalidraw realizada mediante arrastre: escena aceptada y 14 marcos visibles al ajustar dibujo.
- Inspección visual del editor y del visor; corregidas numeraciones duplicadas y filtración de paneles vecinos al enfocar.
- Navegación y zoom probados; una sección visible al seleccionar; anchura móvil de 390 px sin desbordamiento horizontal de página.
- Detección estática: ningún elemento fuera de su marco, ningún solape entre cajas de texto y ninguna línea desbordada con medición de Arial.

Estas comprobaciones validan los artefactos de diseño, no el protocolo educativo ni el modelo de negocio.
