# Backend

API NestJS y TypeScript para el checkout de un solo producto. El backend ofrece consultas de productos, cotizaciones calculadas por el servidor, consentimientos de pago vigentes, inicio idempotente del checkout, recepción de eventos de pago firmados y consultas limitadas del estado de transacciones locales. Persiste checkouts PENDING y puede enviar un intento de pago al entorno de prueba. La ruta de eventos firmados consulta una transacción autoritativa mediante la clave privada exclusiva del servidor antes de la finalización local atómica. Se observaron aprobación local en el entorno de prueba y entrega solo tras éxito mediante conciliación del operador para un ID conocido, incluido un recorrido en navegador; la recepción de eventos desplegada y la recuperación autónoma **no** se verificaron. Existe un comando de conciliación para el operador con ID conocido, implementada y probada localmente.

## Ejecutar localmente

Requisitos previos: Docker con Compose para la configuración de dos contenedores siguiente. Node.js 24 y npm 11 solo se necesitan para la alternativa de ejecución en el equipo o para desarrollar el frontend; estas versiones coinciden con el entorno de verificación local, pero aún no se establecieron rangos de versiones compatibles.

Solo en la primera configuración, copie `.env.example` de la raíz a `.env` y elija una contraseña local para la base de datos que sea segura dentro de una URL; no sobrescriba un `.env` raíz existente al reiniciar, porque el volumen nombrado conserva la contraseña original de la base de datos. Proporcione las seis variables `PAYMENT_*` aprobadas en `backend/.env`, separado y no versionado (consulte `backend/.env.example`). Mantenga las credenciales reales de pago fuera del `.env` raíz y de todos los archivos versionados. El contenedor carga `backend/.env` solo en tiempo de ejecución y reemplaza su `DATABASE_URL` del equipo por la dirección de la base de datos de Compose.

```bash
test -f .env || cp .env.example .env
# Primera configuración: edite los dos archivos de entorno locales antes de iniciar.
docker compose up --build -d --wait
curl -i http://127.0.0.1:3000/products
```

Compose ejecuta PostgreSQL 17 en `127.0.0.1:5433` y la API Nest compilada en `127.0.0.1:3000`. Espera la comprobación de salud de la base de datos y luego ejecuta migraciones explícitas y la carga inicial idempotente antes de servir la API. Los datos sobreviven a las detenciones normales en el volumen nombrado `checkout_pgdata`. El frontend Vite sigue siendo un proceso del equipo en `frontend/` (`npm run dev`) y redirige las rutas de API al puerto 3000.

```bash
docker compose down                 # Detiene la API y la base de datos; conserva los datos.
# docker compose down -v            # Destructivo: también elimina el volumen local de la base de datos.
```

Use `docker compose ps` y `docker compose logs api` para diagnosticar fallos de inicio. La API exige configuración de pago válida y exclusiva del servidor incluso para consultar productos. Esta configuración Compose es para desarrollo local, no una API desplegada ni un límite HTTPS.

### Alternativa de ejecución en el equipo

Desde la raíz del repositorio, inicie una base de datos local desechable:

```bash
docker run --name product-payment-postgres \
  -e POSTGRES_USER=checkout \
  -e POSTGRES_PASSWORD=local-only \
  -e POSTGRES_DB=checkout \
  -p 127.0.0.1:5432:5432 \
  -d postgres:17-alpine
```

`local-only` es una contraseña ilustrativa para esta base desechable, **no** una credencial de aplicación. No la reutilice fuera del desarrollo local. Si el puerto 5432 o el nombre del contenedor ya están en uso, elija otro puerto o nombre local y ajuste `DATABASE_URL` en consecuencia.

En una segunda terminal:

```bash
cd backend
npm ci
export DATABASE_URL='postgresql://checkout:local-only@127.0.0.1:5432/checkout'
npm run build
npm run db:migrate
npm run db:seed
# Proporcione primero las seis variables PAYMENT_* descritas abajo desde configuración local aprobada y no versionada.
npm run start:dev
```

La API escucha en `http://localhost:3000` de forma predeterminada (`PORT` puede cambiarlo). La documentación interactiva local está en [Swagger UI](http://localhost:3000/api); su [JSON OpenAPI](http://localhost:3000/api-json) generado describe las mismas rutas en ejecución. Son **URL locales**, no enlaces verificados de un despliegue público. `DATABASE_URL` y las seis variables `PAYMENT_*` siguientes son obligatorias al iniciar la aplicación, incluso para consultas exclusivas de productos; ningún archivo `.env` se carga automáticamente. La [plantilla de entorno](.env.example) versionada enumera los nombres necesarios sin valores y no es una configuración ejecutable. En particular, `PAYMENT_EVENTS_SECRET` debe ser el secreto independiente para eventos del entorno de prueba. Conserve las credenciales y los secretos de pago en configuración no versionada del servidor. El adaptador exige un nombre de servidor de prueba exacto configurado de forma independiente y familias coincidentes de rutas y claves. La configuración por sí sola **no** autoriza solicitudes en vivo al entorno de prueba; se verificó por separado un inicio UAT sintético autorizado el 2026-09-26 (consulte [Verificar](#verificar)).

La API Nest aplica sus cabeceras de seguridad integradas tanto a respuestas exitosas como de error, entre ellas CSP, `X-Content-Type-Options` y `Referrer-Policy`, y omite `X-Powered-By`. HSTS está desactivado deliberadamente hasta verificar el HTTPS público, la cobertura del certificado y del dominio, y el borde que termina TLS. Estas cabeceras de la API no protegen una SPA alojada por separado; su capa de entrega necesita su propia política. El HTTP local y las pruebas de cabeceras no demuestran un despliegue seguro en AWS.

| Variable | Propósito |
| --- | --- |
| `PAYMENT_API_BASE_URL` | URL base aprobada de la API HTTPS de prueba terminada en `/v1`. |
| `PAYMENT_SANDBOX_HOST` | Nombre exacto del servidor aprobado de esa API de prueba, sin protocolo ni puerto; debe coincidir con la URL base. |
| `PAYMENT_PUBLIC_KEY` | Clave pública de comercio del entorno de prueba para los documentos de consentimiento vigentes. |
| `PAYMENT_PRIVATE_KEY` | Clave del entorno de prueba exclusiva del servidor para enviar transacciones y consultar el estado autoritativo. |
| `PAYMENT_INTEGRITY_SECRET` | Secreto de integridad del entorno de prueba exclusivo del servidor para firmar importe y referencia. |
| `PAYMENT_EVENTS_SECRET` | Secreto independiente del entorno de prueba, exclusivo del servidor, para verificar eventos firmados; no es la clave privada ni el secreto de integridad. |

El puente de tokenización utiliza únicamente el servidor HTTPS de prueba exacto configurado en el backend, la familia de clave pública correspondiente, rutas fijas, ninguna redirección y tiempos de espera acotados. Nunca descifra ni persiste el JWE y nunca devuelve los cuerpos de respuesta remotos. Ambas rutas de tokenización tienen una protección temprana por ventana fija dentro del proceso: GET permite 30 solicitudes por par TCP y 300 por proceso cada 60 segundos; POST permite 10 por par y 100 por proceso cada 60 segundos. El exceso devuelve `429` y `Retry-After` antes de validar o efectuar I/O remoto. La protección utiliza la dirección del par del socket, no cabeceras de reenvío aportadas por el cliente, y limita a 4,096 las ventanas de pares registradas. Los límites se restablecen al reiniciar el proceso y **no** se coordinan entre instancias; detrás de un ALB, el par puede ser el balanceador y no el comprador. Antes de una exposición pública en AWS, configure límites distribuidos o perimetrales por cliente y supervisión de abuso con una política de proxy/IP confiable. La validación de entradas y esta protección local no son controles completos contra pruebas abusivas de tarjetas. Desactive la caché de ambas rutas de tokenización en todas las capas de proxy.

Si `GET /checkout/consents` devuelve el 503 público seguro, los registros del backend emiten solo una categoría censurada: `auth`, `timeout`, `invalid_response`, `network` o `unexpected` para fallos internos no clasificados. Los operadores pueden usarla para acotar la comprobación de configuración o conectividad; no revela cuerpos de respuesta del proveedor, claves, tokens ni datos de tarjeta, y no establece la causa de ningún 503 anterior.

Espere a que PostgreSQL acepte conexiones antes de ejecutar la migración. Las migraciones son explícitas: la sincronización en tiempo de ejecución y la ejecución automática de migraciones están desactivadas. La carga inicial puede ejecutarse de nuevo: los ID fijos de los productos evitan duplicados y no restablecen las existencias existentes.

Para detener y eliminar la base de datos desechable:

```bash
docker stop product-payment-postgres
docker rm -v product-payment-postgres
```

`-v` también elimina el volumen anónimo de datos del contenedor; use un volumen persistente con nombre si necesita conservar los datos locales. Nunca use estas credenciales locales ni esta configuración desechable para el despliegue.

## API implementada

`GET /products` enumera todos los registros de productos disponibles con sus existencias actuales; `GET /products/:id` consulta uno. Ninguna ruta cambia las existencias ni crea un checkout. Ambas rutas carecen actualmente de autenticación; no deben tratarse como endpoints de estado de transacciones o datos de compradores.

La carga inicial explícita añade diez productos de demostración deterministas a una base nueva, entre ellos `8a52ea31-08d9-4f52-a604-00e56143dce0` y `3685f095-a601-4ca6-ab54-0f8eb66bccd8`. Las filas existentes no se restablecen al repetirla. Tras actualizar una instalación existente, ejecute nuevamente `npm run db:seed` para insertar los ocho productos nuevos. Por ejemplo:

```bash
curl -i http://localhost:3000/products
curl -i http://localhost:3000/products/8a52ea31-08d9-4f52-a604-00e56143dce0
```

Respuesta exitosa (`200 OK`):

```json
{
  "id": "8a52ea31-08d9-4f52-a604-00e56143dce0",
  "name": "Audífonos inalámbricos",
  "description": "Audífonos inalámbricos de diadema en color negro, con copas que rodean las orejas y un diseño sobrio para el uso diario. Pensados para escuchar música, pódcast y otros contenidos de audio sin depender de un cable.",
  "currency": "COP",
  "priceCents": 12990000,
  "stock": 12
}
```

`priceCents` es un entero en la representación de moneda del servidor; los clientes no deben presentar su propio precio como fuente autoritativa. Las existencias son un entero no negativo. Consultar productos no las modifica; una aprobación confirmada puede reducirlas atómicamente durante la finalización del pago.

| Resultado | Estado | Comportamiento |
| --- | --- | --- |
| UUID v4 existente | `200` | Los campos del producto anteriores, consultados en PostgreSQL. |
| ID inválido o distinto de v4 | `400` | Error de validación de Nest; no se consulta la persistencia. |
| UUID v4 válido pero inexistente | `404` | `Product not found`. |

También permanece el `GET /` del proyecto inicial generado, pero se excluye del documento OpenAPI del checkout. No hay endpoints de creación de productos ni CRUD de clientes o entregas. El callback de eventos firmados solo comunica servidores. Una URL pública de Swagger/OpenAPI y una URL pública de API siguen siendo entregables futuros.

### Contrato HTTP del checkout

Las rutas siguientes devuelven `Cache-Control: no-store` y se describen en el [documento OpenAPI local](http://localhost:3000/api-json) generado. Sus precios, tarifas, referencias y estado de pago son responsabilidad del servidor; las solicitudes de API no deben incluir datos de tarjeta sin cifrar. El navegador cifra localmente y después obtiene un token de tarjeta transitorio mediante rutas fijas de retransmisión de la API en el mismo origen, antes de `POST /checkouts`; la API acepta únicamente un JWE compacto, no los campos de tarjeta sin cifrar.

| Método y ruta | Entrada | Éxito | Rechazo esperado |
| --- | --- | --- | --- |
| `GET /checkout/quote` | Consulta: `productId` (UUID v4), `quantity` (cadena de entero positivo). | `200` con `productId`, `quantity`, `currency`, `unitPriceCents`, `productAmountCents`, `baseFeeCents`, `deliveryFeeCents`, `totalCents`. | `400` entrada inválida, `404` producto ausente, `409` existencias insuficientes, `422` moneda no admitida. |
| `GET /checkout/consents` | Sin entrada del comprador. | `200` con `publicKey` del entorno de prueba y dos documentos de consentimiento vigentes (`token`, `permalink`). | `503` si no se pueden consultar los documentos vigentes; no se exponen detalles del error remoto. |
| `GET /checkout/tokenization-key` | Sin entrada del comprador. | `200` solo con PEM de cifrado público. | `429` con `Retry-After` si se supera el límite local; `503` ante una respuesta de prueba no disponible o inválida. |
| `POST /checkout/card-tokens` | Solo JSON `{ "payload": "<compact JWE>" }`; máximo 4,096 caracteres. | `201` solo con `{ "token": "tok_…" }` opaco. | `400` por estructura inválida o campos inesperados; `429` con `Retry-After` si se supera el límite local; `503` ante una respuesta de prueba no disponible o inválida. |
| `POST /checkouts` | Cabecera `Idempotency-Key` (UUID v4) y cuerpo JSON descrito abajo. | `201` con `reference`, `status` local y `quote` calculada por el servidor. Repetir la misma clave y los mismos datos devuelve el resultado original sin otro envío. | `400` cuerpo o cabecera inválidos o consentimiento faltante, `404` producto ausente, `409` conflicto de existencias/idempotencia o `QUOTE_CHANGED`, `422` moneda no admitida. |
| `GET /checkouts/status` | Cabecera `Idempotency-Key` original (UUID v4); sin parámetros de consulta ni cuerpo. | `200` solo con `reference`, `paymentStatus` y `fulfillmentStatus` locales, incluso si el navegador perdió la respuesta POST y la referencia. Solo lectura: sin solicitud al proveedor, repetición de POST, actualización de existencias ni creación de entrega. | `400` clave ausente o inválida, `404` clave desconocida. |
| `GET /transactions/:reference` | Referencia de transacción y cabecera `Idempotency-Key` original (UUID v4). | `200` solo con `reference`, `paymentStatus` y `fulfillmentStatus` locales. Esta consulta no llama al proveedor ni modifica estado. | `400` referencia/cabecera inválidas, `404` referencia desconocida o clave no coincidente. |
| `POST /payment/events` | JSON `transaction.updated` firmado con `environment: "test"`, `signature.properties` ordenadas, suma de comprobación, marca temporal e ID de transacción firmado. | `200` solo después de consultar el estado autoritativo del servidor y gestionar el resultado local de forma duradera, incluso ante repetición segura de eventos duplicados o antiguos. | `400` evento inválido o no admitido, `401` suma de comprobación inválida, `404` checkout local desconocido, `409` conflicto de vinculación o estado, `503` estado autoritativo no disponible. Un fallo inesperado de almacenamiento devuelve un código distinto de `200` para permitir el reintento. |

El cuerpo JSON del checkout tiene `productId` (UUID v4), `quantity` (entero positivo), `expectedTotalCents` (entero positivo seguro de la última cotización del servidor), `installments` (entero positivo seguro elegido por el comprador para el pago CARD), `customerEmail`, `delivery` (`recipientName`, `addressLine`, `city`), `cardToken`, `acceptanceToken` y `personalDataToken` transitorios, y ambos booleanos explícitos `acceptsEndUserPolicy: true` y `acceptsPersonalDataAuthorization: true`. No se ha verificado un máximo de cuotas definido por el proveedor; este podría rechazar una selección no admitida. Los dos tokens de consentimiento provienen de los documentos vigentes. Se rechazan los campos desconocidos del cuerpo, incluidos precios o estados alternativos aportados por el cliente; la respuesta HTTP omite correo electrónico, detalles de entrega, tokens, ID del proveedor y clave de idempotencia. Persista la clave original antes del envío para recuperar una respuesta perdida mediante `GET /checkouts/status`, nunca creando otro intento de pago. Ambas rutas de estado utilizan la clave de idempotencia como secreto compartido, pero **no** constituyen un diseño completo de autorización para el despliegue público; agregue autenticación del comprador, autorización por objeto y límites de solicitudes antes de exponerlas. Mantenga la clave fuera de URL y registros.

La [colección Postman](../docs/product-payment.postman_collection.json) del repositorio reproduce estas rutas para compradores. Su script de respuesta de cotización copia solo `totalCents` a la variable de colección `expectedTotalCents`; ejecute esa solicitud justo antes del checkout, ya que un total modificado se rechaza con `409 QUOTE_CHANGED`. El POST de tokenización acepta únicamente un JWE compacto nuevo generado en el navegador; su ejemplo no incluye deliberadamente datos de tarjeta sin cifrar. El JWE y los tokens de tarjeta y consentimiento son transitorios: introdúzcalos solo en una sesión local, nunca los guarde en un entorno compartido y bórrelos antes de exportar o sincronizar la colección. El evento firmado no tiene una solicitud ejecutable manualmente en la colección porque un evento fabricado no es una autoridad de pago.

`PENDING` significa acuse de recibo del envío, **no** aprobación. `SUBMISSION_UNKNOWN` significa que el resultado externo es incierto y no debe provocar un reintento a ciegas. `SUBMISSION_REJECTED` es un rechazo local de autenticación del envío. `paymentStatus: APPROVED` con `fulfillmentStatus: STOCK_UNAVAILABLE` significa que el cobro tuvo éxito, pero no se creó una entrega y se requiere atención del operador. Una respuesta 201 nunca demuestra una compra completada, reducción de existencias o entrega. Se observaron localmente aprobaciones controladas del entorno de prueba y entrega solo tras éxito; no se verificó ningún endpoint alojado públicamente.

### Recuperación acotada de pagos pendientes

El evento de pago firmado por HTTPS sigue siendo el mecanismo principal de confirmación. Un proceso opcional del backend puede recuperar checkouts `PENDING` antiguos que ya tengan un ID de transacción del proveedor vinculado localmente. Nunca envía un POST de pago ni convierte el GET público de estado del comprador en una consulta al proveedor. Usa el mismo lector de estado autoritativo y finalizador idempotente que la conciliación del operador. PostgreSQL toma como máximo cinco filas vencidas por ciclo mediante `FOR UPDATE SKIP LOCKED`; los bloqueos breves caducan después de una caída y cada intento completado recibe una demora de reintento exponencial acotada. **No** se mantiene una transacción de base de datos durante la llamada al proveedor. Se excluyen deliberadamente los ID de proveedor ausentes y los envíos inciertos: requieren un evento verificado o investigación separada del operador.

El proceso está **desactivado por defecto**. Configure `PAYMENT_RECONCILIATION_ENABLED=true` únicamente en un entorno donde se hayan verificado las credenciales de prueba correspondientes, las migraciones y el GET de estado del proveedor. Límites opcionales: intervalo de 5–300 segundos (predeterminado 15), lote de 1–5 (predeterminado 5), antigüedad mínima del envío de 15–3600 segundos (predeterminado 30), bloqueo de 90–300 segundos (predeterminado 120). Una URL pública HTTPS de eventos configurada para el entorno correcto del proveedor, un evento firmado válido observado y una recuperación acotada observada son **condiciones para el despliegue de producción**; las pruebas locales no demuestran ninguna de ellas en AWS. El proceso es un respaldo, no sustituye al webhook ni a un esquema de autorización por objeto.

### Conciliación explícita

Un operador con acceso al entorno de ejecución del backend y credenciales del servidor puede recuperar **un** checkout cuyo ID de transacción del proveedor ya esté persistido. No es un endpoint HTTP y nunca envía un nuevo cobro:

```bash
npm run build
npm run payment:reconcile -- txn_<local-uuid-v4>
```

Proporcione la referencia local real sin corchetes angulares. El comando consulta exactamente ese checkout en el servidor confiable y rechaza registros sin un envío registrado y un ID del proveedor vinculado. No requiere ni expone la clave de idempotencia del comprador en el historial de shell ni en los argumentos del proceso. Consulta únicamente el ID vinculado localmente mediante el lector de estado con clave privada y utiliza el mismo finalizador atómico e idempotente que los eventos firmados. Imprime solo la referencia, los estados de pago y entrega y si se aplicó una transición; un código de salida distinto de cero significa que no hubo conciliación exitosa. Ejecutalo en un entorno confiable de servidor u operador, no en un navegador ni en un registro público de CI. Un envío **sin** ID de proveedor almacenado necesita un evento verificado o una consulta documentada del proveedor, no repetir el cobro a ciegas.

## Datos y arquitectura

La primera migración crea `products`: clave primaria UUID, nombre, descripción, moneda de tres letras mayúsculas, `price_cents` entero positivo y existencias enteras no negativas. Se insertan diez productos de demostración deterministas mediante el comando explícito de carga inicial. Una segunda migración versionada agrega `customers` y `transactions`. Esta última guarda estado PENDING, referencia de transacción y clave de idempotencia únicas, huella de solicitud canónica, cantidad, instantánea de producto/tarifas/total en centavos COP enteros y marca temporal de inicio del envío al proveedor e ID de transacción del proveedor, ambos opcionales. Una tercera migración agrega `fulfillment_status` y `deliveries` con ID de transacción único. El correo del cliente y los datos de entrega se guardan con el checkout; no existe registro de entrega antes de un éxito confirmado.

La entrada interna de `FinalizeVerifiedPayment` acepta una instantánea de transacción **ya verificada y autoritativa**; no es un analizador de cargas HTTP y no debe llamarse con JSON de eventos no confiable. El adaptador HTTP comprueba estructura del evento y entorno de prueba, calcula SHA256 con los campos dinámicos ordenados de su firma más la marca temporal y el secreto independiente de eventos, y exige que el ID de transacción figure entre las propiedades firmadas. Un evento válido solo inicia el proceso: la aplicación consulta la transacción vigente por ID en la API de prueba configurada mediante un GET acotado con clave privada. Si llega un estado terminal **firmado** mientras la consulta autoritativa aún indica `PENDING`, el endpoint devuelve `503` reintentable sin finalizar; no se confía en un estado sin firma como indicación de reintento. La política pura de finalización del núcleo decide la vinculación de referencia, ID del proveedor, importe y moneda; las transiciones monótonas del estado de pago; y los resultados de aprobación y entrega a partir de los hechos locales bloqueados. El adaptador TypeORM bloquea la fila y realiza la actualización condicional de existencias y la inserción de entrega única en la misma transacción PostgreSQL. Si las existencias no alcanzan, registra `APPROVED` con `STOCK_UNAVAILABLE` y sin entrega; esto no es un fallo de pago. Los resultados pendientes y rechazados no cambian existencias ni entregas. Un resultado tardío o duplicado no puede repetir la entrega. Una caída del proveedor o de la base de datos produce un código distinto de `200` para que el evento pueda reintentarse; existe el comando de conciliación de ID conocido, exclusivo del operador; el proceso opcional examina solo intentos pendientes antiguos con un ID del proveedor almacenado.

La **política actual de tarifas de demostración**, no un importe prescrito por la prueba, cobra COP 2,000 de base más COP 5,000 de entrega. Otra política de demostración limita cada checkout a COP 20,000,000; es una regla de aplicación, no de base de datos. `QuoteCheckout` valida un UUID v4 antes de consultar el producto y calcula `(unit price × quantity) + both fees`, con límites de importe y comprobación de existencias. En un checkout nuevo, `StartCheckout` recalcula la cotización a partir del producto y las tarifas actuales del servidor y rechaza un `expectedTotalCents` no coincidente con `409 QUOTE_CHANGED` **antes** de crear una transacción o invocar el pago. El importe aportado por el cliente es una condición de confirmación, nunca autoridad de pago. Repetir la misma clave devuelve la instantánea original cuando coinciden los datos de negocio canónicos y el total esperado original, incluso si después cambiaron precio o existencias del catálogo; modificar el total esperado causa conflicto. La huella excluye los tokens de pago y el precio por compatibilidad anterior, pero incluye una selección de cuotas no predeterminada; una cuota conserva la huella original. Las nuevas filas de cliente y transacción se insertan atómicamente; la unicidad de PostgreSQL resuelve primeros envíos concurrentes y revierte el cliente del intento perdedor. Una actualización condicional independiente puede registrar de forma duradera una única solicitud al proveedor antes del I/O de red. La ruta `POST /checkouts` invoca ahora este flujo. Al crear un checkout PENDING no se reservan ni se reducen existencias.

El caso de uso interno `InitiatePayment` comprueba los tres tokens transitorios de pago y consentimiento antes de crear un checkout PENDING; luego marca atómicamente su referencia como `SUBMISSION_UNKNOWN` y registra un único envío antes de invocar un puerto `PaymentGateway`. Un adaptador de salida exclusivo del entorno de prueba admite tanto el entorno oficial de prueba como el UAT de la prueba técnica, con familias de claves coincidentes; construye la solicitud al proveedor con el total calculado por el servidor y la referencia almacenada, la firma con el secreto privado de integridad y acepta únicamente una respuesta `201`/`PENDING` coincidente como acuse de recibo. El acuse **no** aprueba el pago. Un rechazo de autenticación se convierte en `SUBMISSION_REJECTED` local; tiempo de espera, respuesta de validación, error del servidor o respuesta inválida mantienen `SUBMISSION_UNKNOWN` porque no se demostró que el envío no ocurriera. Los resultados y el ID del proveedor se persisten condicionalmente sin guardar tokens de tarjeta o consentimiento. Reintentar con la misma clave de idempotencia lee la instantánea original y no puede hacer un segundo envío. Una caída del proceso después del registro duradero deja `SUBMISSION_UNKNOWN` sin ID de proveedor; debe conciliarse, no reenviarse. Una prueba controlada UAT en vivo verificó un inicio `201`/`PENDING` y una consulta de estado coincidente al proveedor; las pruebas con transporte simulado cubren rechazo y resultados inciertos.

Los valores simples de producto/cotización, estado de pago y reglas de precios residen en `src/domain/`; los comandos, resultados, `GetProduct`, `QuoteCheckout`, `StartCheckout` y puertos de capacidad de los casos de uso residen en `src/application/`. Ninguno de los directorios internos importa NestJS ni TypeORM. Los controladores Nest de `src/adapters/inbound/http/` transforman entradas y salidas HTTP; los adaptadores TypeORM de `src/adapters/outbound/persistence/` transforman registros de almacenamiento en valores simples. Los módulos Nest de aplicación en `src/` vinculan adaptadores a puertos; `src/adapters/outbound/persistence/database.module.ts` agrupa la configuración de proveedor/exportación de Nest para `DatabaseConnection` con ese adaptador de salida. Una `DatabaseConnection` inicializada de forma diferida administra una conexión compartida y su cierre. Esta organización hace visible la dirección de dependencias, pero son las pruebas aisladas del núcleo y de los adaptadores —no solo los nombres de directorios— las que la verifican. Los [diagramas de arquitectura](../README.md#1-arquitectura-de-la-aplicación-implementada-localmente) de la raíz describen el flujo local implementado y una propuesta de nube identificada por separado.

## Verificar

Ejecute desde `backend/`:

```bash
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:cov -- --runInBand --coverageReporters=text-summary
```

La mayoría de las pruebas unitarias y E2E HTTP utilizan puertos simulados y no necesitan PostgreSQL. Las pruebas de integración condicionales ejercitan migraciones y ciclo de carga inicial, carreras de idempotencia, repetición con precio original, registro único de envío, finalización duplicada/concurrente, agotamiento de existencias y reversión ante fallo al insertar la entrega frente a PostgreSQL real cuando `CHECKOUT_TEST_DATABASE_URL` apunta a una base cuyo nombre termina en `_test`. La prueba de migración y carga inicial crea y elimina otra base aislada de prueba, por lo que el usuario de prueba necesita permiso `CREATEDB`. Para la configuración Compose, cree una base de prueba desechable desde la raíz y use la contraseña del contenedor **en ejecución**; la contraseña ilustrativa `local-only` anterior corresponde solo a la alternativa ejecutada en el equipo y podría fallar contra un volumen Compose existente:

```bash
docker compose exec -T db psql -U checkout -d postgres -c 'CREATE DATABASE checkout_hito3_test'
DB_PASSWORD="$(docker compose exec -T db printenv POSTGRES_PASSWORD)"
export CHECKOUT_TEST_DATABASE_URL="postgresql://checkout:${DB_PASSWORD}@127.0.0.1:5433/checkout_hito3_test"
unset DB_PASSWORD
(cd backend && npm test -- --runInBand)
(cd backend && npm run test:e2e -- --runInBand)
(cd backend && npm run test:cov -- --runInBand --coverageReporters=text-summary)
unset CHECKOUT_TEST_DATABASE_URL
docker compose exec -T db psql -U checkout -d postgres -c 'DROP DATABASE checkout_hito3_test WITH (FORCE)'
```

Use una contraseña local apta para URL, como se indica en la configuración raíz; nunca la imprima ni la confirme en Git. Sin esta variable, las suites PostgreSQL se omiten en lugar de reemplazarse por simulaciones. La cobertura se mide solo para este backend; la cobertura Jest del frontend se comprueba aparte. Las pruebas E2E HTTP del checkout usan adaptadores simulados de pago y consentimiento, y la suite HTTP con PostgreSQL utiliza persistencia real con I/O de pago externo simulado, no credenciales reales del entorno de prueba.

El flujo de PR ejecuta compilación y lint del backend, cobertura Jest y suites E2E HTTP frente a un servicio PostgreSQL 17 efímero. Su usuario de prueba puede crear la base temporal necesaria para la suite de migración y carga inicial. El flujo establece `CHECKOUT_TEST_DATABASE_URL` en una base `_test` desechable, de modo que las suites PostgreSQL no se omiten silenciosamente en CI. Jest rechaza la cobertura del backend salvo que **cada** métrica de sentencias, ramas, funciones y líneas supere estrictamente el 80% (`80.01` como mínimo en `jest.config.ts`). Esta base aislada y exclusiva de CI acepta conexiones confiables de su ejecutor en lugar de almacenar una credencial en el flujo; nunca use esa configuración en un despliegue. No se publica la base ni un archivo de cobertura. La CI del frontend ejecuta por separado compilación, lint y cobertura Jest con el mismo umbral estricto de cuatro métricas en `frontend/jest.config.cjs`.

El 2026-09-28, en este árbol de trabajo local y con una base PostgreSQL de prueba aislada, `CHECKOUT_TEST_DATABASE_URL=... npm run test:cov -- --runInBand --coverageReporters=text-summary` pasó **154 pruebas en 29 suites** y midió **87.33% de sentencias, 83.28% de ramas, 83.23% de funciones y 87.99% de líneas** en `src/`, incluidas las pruebas HTTP, migraciones, carga inicial, finalización y conciliación. Con la misma base, `CHECKOUT_TEST_DATABASE_URL=... npm run test:e2e -- --runInBand` pasó **40 pruebas E2E HTTP en 6 suites**. Estas incluyen comprobaciones PostgreSQL reales de finalización por eventos firmados, carreras de checkout con la misma clave y rechazo de cotización modificada antes de cualquier efecto; el I/O de pago externo permanece simulado. El backend supera el 80% en todas las métricas de cobertura Jest medidas; esto **no** establece la cobertura del frontend ni el comportamiento de eventos desplegados. Sin la variable de base de datos real, las suites PostgreSQL se omiten y las cifras son menores. La medición exitosa usó la contraseña del contenedor Compose en ejecución sin imprimirla; su base desechable se eliminó después.

Por separado, el 2026-09-26 una prueba de humo UAT sintética y controlada utilizó una base PostgreSQL aislada y la configuración autorizada del entorno de prueba. La consulta de consentimientos y la tokenización transitoria de tarjeta tuvieron éxito; se crearon un checkout local y una transacción del proveedor con referencia e importe calculado por el servidor coincidentes. Tanto el envío local como la consulta de estado del proveedor devolvieron `PENDING`. Repetir la misma clave devolvió la referencia original sin otro envío; cambiar los datos de compra con esa clave devolvió `409`; las existencias no cambiaron. Esto verifica solo el **inicio en vivo**, no la aprobación final, reducción de existencias, entrega ni un despliegue público. No se almacenaron credenciales ni datos de tarjeta sin cifrar en el repositorio.
