# Redacción con OpenAI

La web de GitHub Pages llama al servidor Node.js de `server/`. El navegador nunca recibe la clave OpenAI. La conexión requiere configurar los secretos del servidor y la URL pública en la compilación de la web.

## Servidor en Render

Crea un Web Service desde este repositorio y la rama `main`. Usa Node.js 22 o posterior, build `npm ci` y start `npm start`. La fuente de configuración es **Environment** de Render; no hay un Blueprint que sobrescriba las variables.

| Variable | Valor |
| --- | --- |
| `OPENAI_API_KEY` | Clave del proyecto Scouty, introducida directamente en Render |
| `OPENAI_MODEL` | `gpt-6.1-terra` |
| `ACCESS_CODES` | JSON con códigos privados: `{"antonio":"un-codigo-largo-y-unico"}` |
| `ALLOWED_ORIGINS` | `https://antonio8aranda98-lang.github.io`, sin ruta |

Usa un código aleatorio distinto por colaborador, de 16 a 200 caracteres. Los identificadores solo admiten letras, números, guion y guion bajo. Distribuye los códigos por un canal privado y revócalos eliminando su entrada y desplegando el cambio. No uses la clave OpenAI como código de colaborador.

`GET /health` devuelve `ok` y `aiReady`. El segundo indica que existen las variables necesarias, pero no demuestra que la clave sea válida o tenga saldo. Eso se verifica con una generación real de prueba. Si faltan secretos, la generación devuelve 503. Una configuración de códigos mal formada impide el arranque.

## Conexión de la web

Configura `VITE_AI_ENDPOINT=https://URL-DEL-SERVIDOR/reports` al compilar. La URL es pública. Nunca pongas secretos en variables `VITE_`.

La web pide el código en un campo de contraseña y lo mantiene solo en memoria mientras la página está abierta. No lo guarda en el borrador, `localStorage` ni el PDF. Recargar o recibir un 401 elimina ese acceso.

La web espera hasta 120 segundos a que despierte un servidor gratuito, y hasta 60 segundos adicionales para la redacción. El servidor cancela la llamada a OpenAI a los 50 segundos. No se reintenta automáticamente una generación para evitar gasto duplicado.

## Datos y revisión

La ficha y las notas llegan por HTTPS al servidor de Scouty. Este valida los campos y omite campos desconocidos. A OpenAI envía las notas y, si existen, categoría, titular/suplente, minutos, goles, asistencias, paradas, nota y nivel. **Omite de la ficha nombre, equipo, liga, partido y estudios.** Los datos personales escritos dentro de las notas sí se envían.

Se usa Responses API con `store:false`, esquema JSON estricto y máximo 3.000 tokens de salida, sin herramientas externas, archivos, búsquedas ni conversaciones persistentes. `store:false` no significa retención cero: se aplican los [controles de datos de OpenAI](https://developers.openai.com/api/docs/guides/your-data).

El servidor no guarda informes ni registra notas, códigos, claves o respuestas. Los borradores y PDF permanecen en el dispositivo. Las instrucciones piden basarse en las observaciones; esto reduce las invenciones, pero el colaborador debe revisar siempre el resultado antes de descargarlo.

La entrada principal es una única caja con todas las notas mezcladas. El servidor pide al modelo leerlas en conjunto, redactar una síntesis con sentido y distribuir el análisis en los siete apartados. La síntesis no debe repetir la ficha estadística y las secciones sin evidencia quedan vacías. El diseño visual se aplica con una plantilla común inspirada en el CV de referencia, sin fotos ni copia de sus datos personales. El modelo redacta el texto; no genera imágenes ni modifica el diseño del PDF.

## Cuotas y coste

- Códigos individuales comparados por hash en tiempo constante; CORS limitado al origen configurado. Las llamadas directas sin Origin también necesitan código válido.
- Hasta 40.000 caracteres en la caja única y 200 KB por petición HTTP; validación de servidor para los tres formularios. Por compatibilidad, los clientes antiguos pueden enviar apartados de hasta 12.000 caracteres con un total máximo de 40.000.
- Hasta 10 intentos por hora y 30 al día por código, 100 al día para todo el servicio y 2 generaciones simultáneas. Los fallos del proveedor también consumen cuota.
- **Los contadores están en memoria y se reinician al reiniciar o redesplegar el proceso. No son un tope mensual de gasto.** El día se calcula en UTC. Una cuota persistente requiere almacenamiento duradero.
- No se implementan compras ni recargas. El propietario controla facturación, saldo y límites en OpenAI; debe comprobar qué límites detienen peticiones y cuáles solo generan alertas.
- El plan gratuito de Render se suspende por inactividad y tiene cuotas de recursos compartidas; consulta sus [limitaciones](https://render.com/docs/free).

## Contrato y pruebas

`POST /reports` con `Content-Type: application/json` y `Authorization: Bearer <codigo>`.

Entrada: `{ "version": 1, "type": "hundra|scouting|united", "data": { ... }, "notes": { ... } }`. Los campos se definen en `src/model.js`.

Salida: `{ "report": { "general": "", "tactics": "", "technique": "", "physical": "", "attitude": "", "strengths": "", "improvements": "" } }`. Todos los valores son texto y al menos uno contiene observaciones. Un apartado sin evidencia queda vacío.

Errores: 400 datos, 401 código, 403 origen, 413 tamaño, 415 formato, 422 rechazo, 429 cuota/concurrencia, 502 proveedor/formato, 503 configuración o límite del proveedor, 504 timeout. Las notas se conservan y no se exponen detalles privados del proveedor.

`npm test` cubre permisos, CORS, manipulación de campos, minimización de datos, formato de salida, fallos, cuotas y timeout con un proveedor simulado, sin consumo de saldo. La prueba real final debe usar datos ficticios y verificar redacción, revisión y descarga PDF.
