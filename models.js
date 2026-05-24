// ============================================================
// RESERVAS — Modelos de Datos
// Optimizado para rendimiento móvil (objetos planos, sin clases pesadas)
// ============================================================

/**
 * ENUMERACIÓN DE ESTADOS
 * Usar constantes evita errores de tipeo y permite minificación.
 */
const EstadoDia = Object.freeze({
  DISPONIBLE: 0,
  ALQUILADO:  1,
});

const OrigenReserva = Object.freeze({
  BOOKING: 'BOOKING',
  AIRBNB:  'AIRBNB',
  PROPIO:  'PROPIO',
  OTROS:   'OTROS',
});

function normalizarOrigenReserva(origen) {
  return Object.values(OrigenReserva).includes(origen)
    ? origen
    : OrigenReserva.PROPIO;
}

// ------------------------------------------------------------
// FACTORÍA: Reserva
// ------------------------------------------------------------
/**
 * Crea un objeto Reserva inmutable.
 *
 * @param {Object} params
 * @param {string}  params.id            — UUID de la reserva (PK en Supabase)
 * @param {string}  params.fechaInicio   — 'YYYY-MM-DD'
 * @param {string}  params.fechaFin      — 'YYYY-MM-DD' (última noche incluida)
 * @param {number}  params.huespedes     — Número de personas
 * @param {number}  params.precioTotal   — Precio total de la estancia (€)
 * @param {number}  params.precioNoche   — Precio por noche (€) — calculado si no se pasa
 * @param {string}  [params.nombreCliente] — Nombre del huésped principal
 * @param {string}  [params.telefono]    — Teléfono de contacto
 * @param {string}  [params.notas]       — Observaciones libres
 * @returns {Object} Reserva
 */
function crearReserva({
  id,
  fechaInicio,
  fechaFin,
  huespedes,
  precioTotal,
  precioNoche = null,
  nombreCliente = '',
  telefono = '',
  notas = '',
  origen = OrigenReserva.PROPIO,
}) {
  // Cálculo de noches
  const inicio = new Date(fechaInicio + 'T00:00:00');
  const fin    = new Date(fechaFin + 'T00:00:00');
  const noches = Math.round((fin - inicio) / 86_400_000); // ms → días

  return Object.freeze({
    id,
    fechaInicio,
    fechaFin,
    noches,
    huespedes,
    precioTotal,
    precioNoche: precioNoche ?? (noches > 0 ? +(precioTotal / noches).toFixed(2) : 0),
    nombreCliente,
    telefono,
    notas,
    origen: normalizarOrigenReserva(origen),
  });
}

// ------------------------------------------------------------
// FACTORÍA: DiaCalendario
// ------------------------------------------------------------
/**
 * Representa un día dentro del calendario mensual.
 *
 * - Si `estado === DISPONIBLE`: `precioBase` contiene el precio de temporada.
 * - Si `estado === ALQUILADO`:  `reservaId` enlaza con la reserva correspondiente.
 *
 * Los días "vacíos" (padding para completar la cuadrícula) se marcan
 * con `esPadding: true` y no llevan datos de precio ni reserva.
 *
 * @param {Object} params
 * @param {number}  params.dia         — Número del día (1-31)
 * @param {string}  params.fecha       — 'YYYY-MM-DD'
 * @param {number}  params.diaSemana   — 0=Lunes … 6=Domingo (ISO)
 * @param {number}  params.estado      — EstadoDia.DISPONIBLE | EstadoDia.ALQUILADO
 * @param {number}  [params.precioBase]  — Precio base del día (solo si disponible)
 * @param {string}  [params.reservaId]   — ID de la reserva (solo si alquilado)
 * @param {number}  [params.huespedes]   — Huéspedes esa noche (desnormalizado para render rápido)
 * @param {number}  [params.precioNoche] — Precio/noche de la reserva (desnormalizado)
 * @param {boolean} [params.esPadding]   — true si es celda vacía de relleno
 * @returns {Object} DiaCalendario
 */
function crearDiaCalendario({
  dia        = 0,
  fecha      = '',
  diaSemana  = 0,
  estado     = EstadoDia.DISPONIBLE,
  precioBase = 0,
  reservaId  = null,
  huespedes  = 0,
  precioNoche = 0,
  origen     = OrigenReserva.PROPIO,
  esPadding  = false,
}) {
  return Object.freeze({
    dia,
    fecha,
    diaSemana,
    estado,
    precioBase,
    reservaId,
    huespedes,
    precioNoche,
    origen: normalizarOrigenReserva(origen),
    esPadding,
  });
}

// ------------------------------------------------------------
// FACTORÍA: MesCalendario
// ------------------------------------------------------------
/**
 * Contenedor del mes completo, listo para renderizar en una
 * cuadrícula de 7 columnas (Lun–Dom).
 *
 * @param {Object} params
 * @param {number} params.anio   — Año (e.g. 2026)
 * @param {number} params.mes    — Mes 1-12
 * @param {Array}  params.dias   — Array de DiaCalendario (incluye padding)
 * @param {Object} params.resumen — Estadísticas rápidas del mes
 * @returns {Object} MesCalendario
 */
function crearMesCalendario({ anio, mes, dias, resumen }) {
  return Object.freeze({
    anio,
    mes,
    nombreMes: NOMBRES_MES[mes - 1],
    totalDias: new Date(anio, mes, 0).getDate(),
    dias,
    resumen: Object.freeze(resumen),
  });
}

// ------------------------------------------------------------
// CONSTANTES AUXILIARES
// ------------------------------------------------------------
const NOMBRES_MES = Object.freeze([
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]);

const NOMBRES_DIA_CORTO = Object.freeze([
  'Lun','Mar','Mié','Jue','Vie','Sáb','Dom',
]);

// Precios base por defecto según temporada (€/noche)
// Se pueden sobreescribir por día desde la BBDD
const TEMPORADAS = Object.freeze({
  BAJA:  { precio: 60,  meses: [1, 2, 3, 11] },
  MEDIA: { precio: 85,  meses: [4, 5, 6, 10, 12] },
  ALTA:  { precio: 120, meses: [7, 8, 9] },
});

/**
 * Devuelve el precio base de temporada para un mes dado.
 * @param {number} mes — 1-12
 * @returns {number} precio en €
 */
function precioTemporada(mes) {
  for (const t of Object.values(TEMPORADAS)) {
    if (t.meses.includes(mes)) return t.precio;
  }
  return 0;
}
