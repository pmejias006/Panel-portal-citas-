// Configuración del panel. Edita solo este archivo.
window.ECR_CONFIG = {
  // URL de la aplicación web de Apps Script (termina en /exec). Pasos en README.md.
  // Si la dejas vacía, el panel muestra datos de ejemplo.
  api: 'https://script.google.com/macros/s/AKfycbwk2DlH3feIgcnbNXx4Oft8GbmH6nmZYTVoHcGaIJKFOpt0IiAI2Ttdp4kOJUbaFEIxXw/exec',

  refrescarMin: 2,                  // cada cuántos minutos se recargan los datos
  horario: { abre: 0, cierra: 24 }, // el formulario recibe solicitudes las 24 horas

  // Mensaje de la cita para WhatsApp. Variables: {placa} {nombre} {taller} {fecha} {hora} {trabajos} {observacion}
  mensajeCita: `Saludos, el vehículo {placa} tiene cita en Taller ECR {taller}, fecha {fecha}, hora {hora}, para realizar:

{trabajos}

{observacion}*Con este mensaje puede dirigirse al taller indicado. Confirme la lectura de este mensaje y cuando reciba el correo. Recuerde llegar puntual o 15 min antes para evitar penalizaciones. Es FUNDAMENTAL que NO reporte fallas o requerimientos que el vehículo no presente actualmente.*

¡Tu opinión nos ayuda a crecer! Una vez que salgas del taller, por favor tómate un minuto para llenar esta breve encuesta. Queremos escucharte para seguir mejorando nuestro servicio: https://forms.gle/qtDJiuEBokLMmehS6`,

  // Fecha sugerida de la cita (misma fórmula del Sheet):
  // (REDONDEAR(odómetro / intervalo) × intervalo − odómetro) / kmDia + fecha de la solicitud
  formulaCita: { intervalo: 5000, kmDia: 250 },

  talleres: {
    Caracas: ['La Boyera', 'San Bernardino'],
    Valencia: ['Valencia'],
    Maracay: ['Maracay'],
    Maracaibo: ['Maracaibo']
  },

  // Capacidad de cada taller (documento TALLERES.xlsx). Horas en formato 24 h.
  // Cada cita ocupa una bahía y un técnico o ayudante durante la duración del servicio (catálogo), en bloques de 1 hora.
  // Gestor de Disponibilidad de Centros (Drive). El script lo lee en vivo; aquí solo va el enlace y los nombres cortos.
  disponibilidadId: '12sbYaSCeaI5ZG0E_8mCLoICaJMNVSwP8j-SjmS0O7ac',
  centros: { 'CCS-BOY-OPE': 'La Boyera', 'CCS-SB-CEMAEX': 'San Bernardino', 'CCS-GUA-LYP': 'Guaicay', 'VLN-OPE-V': 'Valencia', 'MCY-OPE-M': 'Maracay', 'MAR-ALI-M': 'Maracaibo' },
  descansoDesde: '12:00',  // inicio del descanso; su duración sale de la columna "Descanso" del Drive
  // Bloques del plano y duración del mantenimiento por centro, en minutos (los demás usan bloques de 60)
  pasoMin: { 'San Bernardino': 30 },
  duracionMant: { 'San Bernardino': 30 },
  // Bahías aptas para montar Changan por centro, y placas Changan (además de las que el formulario marque como Changan)
  bahiasMoto: { 'San Bernardino': [9] },
  bahiasChangan: { 'San Bernardino': [2, 4] },
  placasChangan: ['AP650NB', 'AP628NB', 'AD361TF', 'AD372TF', 'AD676NF', 'AD681NF', 'AD690NF', 'AD707NF', 'AD711NF', 'AD725NF', 'AD733NF', 'AE159HR', 'AE171HR', 'AE180HR', 'AE184HR', 'AE189HR', 'AP370EB', 'AP617NB', 'AP624BN', 'AP629NB', 'AP635NB', 'AP641NB', 'AP647NB', 'AD204NF', 'AD380TF', 'AE264CR', 'AD679NF'],

  horasPorServicio: 2,
  capacidad: {
    'La Boyera':      { id: 'CCS-BOY', bahias: 23, tecnicos: 9, ayudantes: 3, nombre: 'Centro de Operaciones ECR La Boyera', apertura: '08:00', recepcion: '16:00', cierre: '17:00', unidades: 9, reserva: 0.15, motos: true, preventivos: true, correctivos: true,
                        sabado: { cupos: 15, hasta: '15:00', servicio: 'solo cambios de aceite' } },
    'San Bernardino': { id: 'CCS-SB', bahias: 8, tecnicos: 2, ayudantes: 3, nombre: 'SEMAEX San Bernardino', apertura: '08:00', recepcion: '16:00', cierre: '17:00', unidades: 4, reserva: 0.01, motos: true, preventivos: true, correctivos: true },
    'Maracay':        { id: 'MCY-01', bahias: 11, tecnicos: 4, ayudantes: 2, nombre: 'Centro / Taller Maracay', apertura: '08:00', recepcion: '17:00', cierre: '17:00', unidades: 2, reserva: 0.10, motos: false, preventivos: true, correctivos: true },
    'Valencia':       { id: 'VLN-01', bahias: 8, tecnicos: 2, ayudantes: 2, nombre: 'Centro / Taller Valencia', apertura: '08:30', recepcion: '16:30', cierre: '17:00', unidades: 4, reserva: 0.10, motos: false, preventivos: true, correctivos: true },
    'Maracaibo':      { id: 'MCBO-01', bahias: 1, tecnicos: 1, ayudantes: 1, nombre: 'Centro / Taller Maracaibo', apertura: '08:30', recepcion: '16:30', cierre: '17:00', unidades: 1, reserva: 0.03, motos: false, preventivos: true, correctivos: true }
  },

  // Documento de validaciones de mantenimiento preventivo ECR.
  // int: intervalo de servicio. ant: anticipación requerida.
  // sal: km restantes desde los que es "Saludable". rie: desde los que es "En riesgo".
  parametros: {
    carro: { int: 5000, ant: 1200, sal: 601, rie: 301 },
    moto:  { int: 1000, ant: 500,  sal: 251, rie: 101 }
  }
};
