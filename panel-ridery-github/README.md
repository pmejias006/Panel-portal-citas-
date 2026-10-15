# Panel de postventa | Emprende con Ridery

Dashboard, gestión de solicitudes con resumen para la orden de servicio, mantenimiento por kilometraje según el documento de validaciones ECR y registros completos del formulario.

## Cómo funciona
- `index.html` y `config.js` se publican en GitHub Pages.
- `apps-script/Code.gs` va en un proyecto nuevo de Apps Script, separado del que usa el formulario. Lee las solicitudes y el Gestor de Disponibilidad con tu cuenta, valida la contraseña y guarda la gestión de las citas en el Sheet de solicitudes.
- El Sheet **sigue privado** y las contraseñas no aparecen en la página publicada.

## 1. Crea el script del panel (una sola vez)
**No pegues este código en el Apps Script del formulario**: borrarías el formulario. Va en un proyecto nuevo.
1. Entra a script.google.com con la cuenta que puede editar el Sheet de solicitudes y ver el Gestor de Disponibilidad. Toca **Nuevo proyecto** y llámalo "Panel Postventa ECR".
2. Borra el código de ejemplo de ese proyecto nuevo, pega el contenido de `apps-script/Code.gs` y guarda.
3. Revisa el inicio del archivo: `SHEET_ID` (Sheet de solicitudes), `HOJAS` (pestaña de respuestas, gid 1089612557), `DESDE` (fecha de inicio del programa) y `DISPONIBILIDAD` (Gestor de Disponibilidad). Ya vienen llenos.
4. Arriba, elige la función `doGet` y toca **Ejecutar**. Google pedirá permisos: **Revisar permisos → tu cuenta → Configuración avanzada → Ir a Panel Postventa ECR → Permitir**. El aviso de "app no verificada" es normal en scripts propios.
5. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier usuario**. Toca Implementar y copia la URL que termina en `/exec`.
6. Opcional, para el resumen con IA: **Configuración del proyecto → Propiedades del script → Agregar propiedad** `CLAUDE_API_KEY`.

En el Gestor de Disponibilidad no hay que pegar nada. Solo compártelo como **lector** con la cuenta del paso 1, si es otra cuenta, y no cambies los nombres de las pestañas ni de los encabezados.

Si después cambias `Code.gs`, publica una versión nueva en **Implementar → Administrar implementaciones → Editar → Nueva versión**. La URL se mantiene.

## 2. Publica en GitHub
1. Pega la URL `/exec` en `config.js`, dentro de `api: ''`.
2. Crea un repositorio (o usa el actual) y sube `index.html` y `config.js`.
3. **Settings → Pages → Deploy from a branch → main / (root) → Save**.

## Accesos
| Perfil | Contraseña inicial | Qué puede hacer |
|---|---|---|
| Administrador | 27985695 | Todo: dashboard, gestión de citas, kilometraje, registros y configuración |
| Consultor | Emprende.26 | Solo Citas y Registros, en modo consulta: cuándo se hizo cada solicitud, su estado y la ficha completa |

Las contraseñas se cambian desde **Configuración** y aplican para todos de inmediato. Tras 50 intentos fallidos en 15 minutos, el acceso se bloquea un rato.

## Actualización en vivo
Cada respuesta nueva del formulario aparece sola en el panel: el script lee la pestaña donde caen las respuestas en cada consulta. El panel se refresca cada 2 minutos (`refrescarMin` en `config.js`) y también al tocar el indicador "Sheet actualizado" del dashboard. Solo asegúrate de que `HOJAS` apunte a la pestaña de respuestas del formulario.

La pestaña **Registros** muestra todas las respuestas tal como llegan del formulario, con buscador y descarga en CSV. Al tocar una fila o el nombre de un conductor se abre la ficha completa de la solicitud.

## Resumen con IA para la orden de servicio (opcional)
Al gestionar una solicitud, el panel muestra un resumen breve listo para copiar y pegar en la orden de servicio.
- Sin configurar nada, el resumen se arma automáticamente con las respuestas.
- Para que lo redacte la IA (Claude): crea una clave de API en la consola de Anthropic (console.anthropic.com). Luego, en Apps Script, entra a **Configuración del proyecto → Propiedades del script → Agregar propiedad**, con el nombre `CLAUDE_API_KEY` y la clave como valor. La clave queda guardada en Google, nunca en la página. El uso de la API se cobra en esa cuenta de Anthropic.

Cada resumen se guarda en la columna "Resumen para la orden", así que solo se redacta una vez por solicitud. Puedes editarlo antes de guardarlo.

## Estados de una solicitud
Pendiente, Procesado, Pendiente de cita, Agendada, En taller y Sin efecto. Se cambian desde el botón **Gestionar** y quedan guardados en la columna "Estado de gestión".

## Agenda de citas
La pestaña **Agenda** muestra todas las citas desde hoy hasta la última fecha agendada, agrupadas por día y con filtro por taller (La Boyera, San Bernardino, Valencia, Maracay y Maracaibo). La ven el administrador y los consultores. El botón **Copiar agenda** copia la programación del taller elegido para enviarla por WhatsApp.

## Fecha sugerida y posibles duplicados
- **Fecha sugerida:** con la misma fórmula de tu Sheet, (REDONDEAR(odómetro / 5.000) × 5.000 − odómetro) / 250 + fecha de la solicitud, el panel calcula cuándo le tocaría la cita a cada conductor. Aparece en la lista de citas y en la ficha, y se usa como fecha inicial al agendar. Los valores 5.000 y 250 se cambian en `formulaCita`, dentro de `config.js`.
- **Posibles duplicados:** si la misma placa o la misma cédula ya tiene otra solicitud en curso (pendiente, procesada, pendiente de cita, agendada o en taller), la solicitud se marca como "Posible duplicado". La ficha muestra cuál es la otra solicitud, para revisarla antes de cargarla en Odoo. En Citas, la casilla "Solo posibles duplicados" las filtra.

## Disponibilidad de talleres y nueva cita
- **Disponibilidad:** en Agenda, una tabla muestra por taller y por día los vehículos pautados; el color indica la ocupación de las horas de técnico (verde, ámbar desde el 80 %, rosado si está lleno). Al tocar un día se abre su plano de bahías. Todos los talleres atienden de lunes a viernes; los sábados solo La Boyera, con cambios de aceite, hasta 15 vehículos y hasta las 3:00 p. m. Al agendar, el panel avisa si el cupo está lleno o el taller no atiende motos, y no deja guardar citas en días u horas en que el taller está cerrado. Los datos de cada taller se editan en `capacidad`, dentro de `config.js`.
- **Nueva cita:** el botón **Nueva cita** (en Citas y en Agenda) agenda una cita sin formulario: solo la placa es obligatoria. Si la placa ya existe, completa los datos del conductor y avisa si tiene otra solicitud en curso. Estas citas se guardan en la pestaña "Citas manuales" del Sheet, que el script crea sola.

## Ajustes desde Configuración
- **Capacidad de los talleres:** horario de recepción, cupos por día, cupos y hora límite de los sábados (0 = no atiende) y si atiende motos. "Volver a los valores del documento" deshace los cambios.
- **Particularidades por día:** para un taller o para todos, en una fecha: cerrado, cupos distintos, otro horario o solo una nota (feriado, inventario, poco personal). Con cupos se puede abrir un sábado o un domingo puntual.

Se guardan en Apps Script y aplican para todos los usuarios de inmediato.

## Gestor de Disponibilidad (Google Drive)
El script lee en vivo el archivo "Gestor de Disponibilidad de Centros de Mantenimientos - ECR":
- **Información de Centros ECR:** por centro y día de la semana, si abre, horario (apertura, última recepción, descanso y cierre), bahías operativas, técnicos, ayudantes y qué atiende.
- **Condiciones especiales:** una fila con fecha reemplaza la programación normal de ese centro ese día.

Quien edite el Drive no tiene que hacer nada más: el panel lo refleja en máximo 1 o 2 minutos. La cuenta que publicó el script necesita al menos acceso de lector al archivo; no hace falta hacerlo público. Si cambias el ID o los nombres de las pestañas, ajústalos en `DISPONIBILIDAD`, al inicio de `Code.gs`. El descanso se toma desde las 12:00 (`descansoDesde` en `config.js`), con la duración de la columna "Descanso".

## Plano de bahías
- **Pestaña Bahías (administrador):** elige el taller y el día y verás el plano tipo sala de cine: horas en filas, bahías en columnas. Las bahías ocupadas muestran la placa (azul: mantenimiento, rosado: falla). La columna "Disponible" dice cuántos técnicos, ayudantes y bahías quedan libres en cada hora. Al tocar una bahía libre se crea una cita en ese horario; al tocar una placa se abre su ficha.
- **Al agendar:** el servicio se elige del catálogo (se sugiere solo según el kilometraje y el vehículo) y su duración en minutos se convierte en bloques de 1 hora. El botón **Elegir bahía y hora en el plano** muestra solo los lugares donde caben esos bloques con bahía y personal libres.
- **Capacidad:** bahías operativas, técnicos y ayudantes de cada taller se editan en Configuración, y por día en Particularidades (por ejemplo, un técnico de reposo).

## Mensaje de la cita por WhatsApp
Al marcar una solicitud como **Agendada**, la ficha arma el mensaje para el conductor con tu formato: placa, taller, fecha, hora, trabajos a realizar y una observación opcional. Puedes copiarlo o abrirlo directo en WhatsApp con el número del conductor. Los trabajos y la observación quedan guardados en el Sheet.

Si surge un imprevisto, usa **Editar cita** en una solicitud agendada: cambia taller, fecha u hora, anota el motivo si quieres, envía el mensaje actualizado y guarda. Cada cambio queda registrado en la columna "Historial de la cita" y la solicitud se marca como reprogramada. El texto del mensaje, incluido el enlace de la encuesta, se edita en `mensajeCita` dentro de `config.js`.

## Columnas del Sheet
El script reconoce las columnas por su nombre: marca temporal, nombre, cédula, placa, tipo de vehículo, ciudad, odómetro, último y próximo mantenimiento, descripción de la falla y asistencia inmediata. Si no encuentra alguna, el dashboard del administrador lo avisa; en ese caso escribe el encabezado exacto en `COLUMNAS` dentro de `Code.gs`.

Al final de cada pestaña el script agrega las columnas de gestión: Estado de gestión, Taller asignado, Fecha de la cita, Hora de la cita, Aceptó primera cita, Km al ingreso, Resumen para la orden y Actualizado. No las renombres. Si la pestaña tiene la columna CODIGO_SOLICITUD, ese código es el ID de cada solicitud; si no la tiene, el ID es el número de fila, y en ese caso no ordenes ni borres filas.

## Vista previa
Con `api` vacío, el panel funciona con datos de ejemplo.
