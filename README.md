# Imgrar — Compresor de Imágenes Premium & 100% Local

**Imgrar** es una herramienta web moderna, rápida y segura diseñada para comprimir imágenes por lotes (lote ilimitado) directamente en tu navegador. Toda la compresión se realiza de forma local en tu dispositivo utilizando el hardware del cliente; tus imágenes nunca se suben a ningún servidor externo, garantizando privacidad absoluta y procesamiento inmediato offline.

---

## ✨ Características principales

- 🔒 **Privacidad Total (100% Local):** El procesamiento se realiza localmente utilizando APIs de navegador modernas. Tus fotos nunca salen de tu ordenador.
- 🚀 **Compresión en Lote Asíncrona:** Sube múltiples archivos simultáneamente y descárgalos individualmente o todos juntos empaquetados en un archivo `.ZIP` generado al instante.
- ⚡ **Optimización en Tiempo Real:** Visualiza dinámicamente cómo cambiará el peso final del archivo y el porcentaje de ahorro estimado mientras ajustas el deslizador de calidad de 5% en 5%.
- 🎨 **Paleta Minimalista Moderna:** Interfaz elegante en blanco y negro (estilo nórdico / editorial) con transiciones suaves.
- 🌓 **Modo Oscuro Integrado:** Alternador de tema (claro/oscuro) con soporte para preferencias del sistema e historial guardado localmente (`localStorage`).
- 📁 **Múltiples Formatos:** Soporte para compresión y conversión cruzada entre formatos **JPEG**, **PNG** y **WebP**.

---

## 🛠️ Tecnologías y Rendimiento bajo el capó

La aplicación ha sido optimizada para un alto rendimiento y evitar que la pestaña del navegador se congele durante el procesamiento de archivos pesados:
1. **`createImageBitmap`**: Decodifica de forma asíncrona los archivos de imagen en segundo plano evitando bloqueos del hilo de ejecución principal (Main Thread).
2. **`OffscreenCanvas`**: Realiza el renderizado de redimensionamiento de previsualizaciones y renderizado final de compresión en hilos de procesamiento no bloqueantes.
3. **`scheduler.yield` / `setTimeout(0)`**: Cede el control al Event Loop del navegador entre cada paso de la cola de compresión para mantener la página 100% fluida e interactiva.
4. **`JSZip`**: Empaqueta los archivos resultantes en un archivo comprimido comprimiendo en memoria a alta velocidad (Compresión nivel 1) ya que las imágenes individuales ya están optimizadas.
5. **Aislamiento de renderizado CSS:** Uso de la directiva `contain: layout style` en las tarjetas de imagen para mitigar reflows innecesarios del DOM.

---

## 🚀 Cómo usar

1. Abre el archivo [index.html](index.html) en cualquier navegador moderno.
2. Arrastra una o varias imágenes al cuadro punteado o haz clic sobre él para seleccionarlas desde tu explorador.
3. Ajusta el deslizador de **Calidad** y escoge el **Formato** deseado.
4. Las imágenes se comprimirán de manera automática al instante. Si realizas cambios en la calidad, las tarjetas se atenuarán sutilmente mostrando el proceso de cálculo de peso en tiempo real.
5. Haz clic en **Descargar** en las tarjetas individuales o presiona el botón **⬇ Descargar todo como ZIP** para descargar tu lote optimizado.
