# Scouty

Una aplicación en español para que los colaboradores de **HUNDRA** y **United Sports Agency** conviertan sus observaciones de un partido en un informe PDF. Diseñada para móvil, tableta y ordenador.

## Uso

1. Elige seguimiento HUNDRA, captación HUNDRA o captación United.
2. Completa los datos obligatorios. Las estadísticas admiten cero; la nota va de 0 a 10.
3. Pega todas las notas juntas en «Notas del partido». No hace falta ordenarlas ni clasificarlas.
4. Pulsa «Crear informe con IA», revisa la redacción y confirma que la has revisado.
5. Descarga el PDF para compartirlo por el canal autorizado.

OpenAI lee las notas en conjunto y las organiza en visión general, táctica, técnica, físico, actitud, puntos fuertes y mejoras. La redacción distingue lo observado de las valoraciones y conserva las incertidumbres; el colaborador debe revisarla. «Usar mis notas sin IA» crea un borrador literal sin atribuirle una redacción automática. El colaborador utiliza su código de acceso; nunca necesita una clave de OpenAI. Los borradores antiguos con notas por apartados se reúnen en una sola caja sin perder contenido.

## Tipos y campos obligatorios

| Tipo | Datos |
| --- | --- |
| Seguimiento HUNDRA | Nombre y apellidos, partido visto, titular/suplente, minutos disputados, goles, asistencias, paradas, nota media |
| Captación HUNDRA | Los anteriores, más dorsal, equipo, liga y categoría |
| Captación United | Los de captación HUNDRA, más estudios y nivel alto/medio/bajo |

La interfaz recoge 8, 12 y 14 campos respectivamente. «Nombre y apellidos» ocupa un solo campo.

## Desarrollo

Requisitos: Node.js 22 o posterior y npm.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

El PDF se genera en el dispositivo con jsPDF, sin subirlo a un servidor. Usa Bebas Neue para los titulares y tipografía estándar para el cuerpo, con soporte de español y texto occidental; normaliza la puntuación tipográfica y omite caracteres no compatibles, como emojis. No necesita ventana de impresión. Bebas Neue se distribuye bajo SIL Open Font License 1.1, incluida en `public/fonts/OFL.txt`.

Los informes siguen la estética del CV aportado como referencia: fondo oscuro, nombre destacado con parte del texto delineada, datos en tarjetas y análisis en dos columnas, sin fotografía. HUNDRA utiliza acentos celestes; United combina fondo azul marino y acentos rojos. Los logos originales conservan sus colores y se presentan sobre una placa blanca. La plantilla no copia datos biográficos, contactos, trayectoria, temporadas ni imágenes del CV de referencia. Las cabeceras con logo y los pies se repiten en las páginas necesarias; no se recorta la redacción para forzar una sola página. `src/brand-assets.js` conserva los PNG originales y `src/brands.js` define las paletas.

## Datos y privacidad

- El repositorio contiene exclusivamente código y ejemplos ficticios de pruebas. No deben añadirse informes ni datos personales a Git.
- Cada tipo tiene un borrador independiente en `localStorage`, en ese navegador y dispositivo. No hay cuenta, sincronización, base de datos ni copia de seguridad remota.
- Los borradores locales no están cifrados. En dispositivos compartidos, usa «Borrar este borrador» al terminar. Si el almacenamiento no está disponible, la interfaz lo indica y el trabajo permanece solo en memoria mientras la página esté abierta.
- Sin utilizar la IA, los datos de los informes no salen del navegador. Al generar con IA, la ficha y las notas pasan por el servidor de Scouty; este omite los identificadores de la ficha al llamar a OpenAI. Los datos personales escritos en las notas sí se envían. La aplicación carga tipografías de Google Fonts, con alternativas del sistema.
- No hay analítica ni seguimiento. Descargar un PDF no lo envía automáticamente a nadie.

## Conexión con IA

Consulta [docs/IA.md](docs/IA.md) para configurar el servidor, los códigos por colaborador y la conexión de GitHub Pages. `.env.example` contiene únicamente la URL pública; `server/.env.example` documenta las variables del servidor. Nunca incluyas claves reales en variables `VITE_`, en el navegador o en el repositorio.

## Publicación

El workflow comprueba la lógica, construye la aplicación y publica `dist/` con GitHub Pages. En **Settings → Pages → Build and deployment → Source**, selecciona **GitHub Actions**. Después ejecuta el workflow o sube un cambio a `main`.

La URL esperada para este repositorio es `https://antonio8aranda98-lang.github.io/scouty/` una vez el despliegue termine correctamente. El repositorio público permite consultar el código; los borradores locales no se publican.

## Alcance de esta primera versión

Incluye formularios, validaciones, una única caja de notas, revisión editable por apartados, borradores locales, PDF con varias páginas y servidor de redacción con OpenAI. El servicio requiere configurar secretos antes de usarse. No se han añadido fichajes, pagos, promesas de becas ni decisiones automatizadas.

Código © Antonio Aranda. No se concede una licencia de reutilización por el mero hecho de que el repositorio sea público. HUNDRA y United Sports Agency conservan sus marcas.
