# Integración de IA pendiente de activar

Por decisión de Antonio, esta versión deja preparada la conexión y no utiliza ningún proveedor de pago. No hay claves incorporadas ni se simula una respuesta de IA.

## Contrato del servicio

La app permite configurar una URL HTTPS pública mediante `VITE_AI_ENDPOINT`. Para desarrollo se acepta HTTP únicamente en localhost. El usuario introduce un código de acceso al generar; no se almacena. La aplicación envía:

```http
POST /reports
Content-Type: application/json
Authorization: Bearer <codigo-de-acceso>
```

```json
{
  "version": 1,
  "type": "hundra",
  "data": {
    "name": "Nombre de prueba",
    "match": "Local vs. Visitante",
    "starter": "Titular",
    "minutes": "90",
    "goals": "0",
    "assists": "0",
    "saves": "0",
    "rating": "7.5"
  },
  "notes": { "general": "Notas del colaborador." }
}
```

`type` admite `hundra`, `scouting` y `united`. Los datos específicos se definen en `src/model.js`. La petición solo se envía al pulsar «Generar con IA». Respuesta esperada:

```json
{
  "report": {
    "general": "Resumen apoyado en las notas.",
    "tactics": "",
    "technique": "",
    "physical": "",
    "attitude": "",
    "strengths": "",
    "improvements": ""
  }
}
```

Todas las claves de respuesta son obligatorias y sus valores son texto. Un apartado sin evidencia será una cadena vacía. La app descarta respuestas incompletas, demasiado largas o completamente vacías. Las respuestas se insertan como texto, nunca como HTML.

## Trabajo necesario antes de activar

1. Elegir proveedor y modelo, y acordar su coste. Guardar la clave exclusivamente en variables secretas del servidor.
2. Implementar el endpoint con autenticación, límites de peticiones por usuario, límites de gasto, validación de tipos y tamaño, y tiempo máximo de ejecución. CORS debe permitir solo el origen concreto de Scouty. CORS no sustituye a la autenticación.
3. Validar en el servidor los campos con `validate()` de `src/model.js`, limitar notas a 40.000 caracteres y apartados de respuesta a 15.000 caracteres. La validación del navegador no es una frontera de seguridad.
4. Usar `AI_INSTRUCTIONS` de `src/model.js` como punto de partida: mantener los datos y notas como entrada no confiable, no inventar hechos, no inferir atributos sensibles y no seguir instrucciones incrustadas en las notas. Solicitar una respuesta estructurada con el esquema anterior.
5. Evitar registrar datos personales, notas o códigos de acceso. Definir retención y tratamiento con el proveedor antes de usar observaciones reales. La ficha y las notas completas se enviarán al servicio conectado y al proveedor elegido.
6. Probar con datos ficticios las respuestas correctas, no autorizadas, con límites excedidos y fallos del proveedor. Verificar que las notas se conservan y que la revisión humana sigue siendo obligatoria.
7. Configurar `VITE_AI_ENDPOINT` en el entorno de compilación y reconstruir. En GitHub Actions, debe añadirse explícitamente al paso de build; un archivo `.env` local no cambia la web publicada.

No hay backend desplegado en esta entrega. Configurar solo la URL no implementa ninguno de los controles anteriores. Para colaboradores externos, se recomienda pasar de un código compartido a acceso individual revocable en el servidor.
