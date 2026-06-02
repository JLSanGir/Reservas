// ============================================================
// RESERVAS — Lógica del Calendario Mensual
// Genera la cuadrícula de 7 columnas (Lun → Dom) para un mes
// ============================================================

// ------------------------------------------------------------
// UTILIDADES DE FECHA
// ------------------------------------------------------------

/**
 * Convierte el día de la semana de JS (0=Dom … 6=Sáb)
 * al formato ISO (0=Lun … 6=Dom).
 * @param {number} jsDow — Date.getDay()
 * @returns {number} 0-6 donde 0=Lunes
 */
function jsAIso(jsDow) {
  return jsDow === 0 ? 6 : jsDow - 1;
}

/**
 * Formatea una fecha como 'YYYY-MM-DD'.
 * @param {number} anio
 * @param {number} mes  — 1-12
 * @param {number} dia  — 1-31
 * @returns {string}
 */
function formatoFecha(anio, mes, dia) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function formatoFechaLocal(date) {
  return formatoFecha(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function obtenerFechasRango(fechaInicio, fechaFin) {
  const fechas = [];
  const cursor = new Date(fechaInicio + 'T00:00:00');
  const fin = new Date(fechaFin + 'T00:00:00');

  while (cursor <= fin) {
    fechas.push(formatoFechaLocal(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return fechas;
}

// ------------------------------------------------------------
// ÍNDICE RÁPIDO DE RESERVAS
// ------------------------------------------------------------

/**
 * Construye un Map<fecha, Reserva> para búsqueda O(1) al generar el mes.
 * Expande cada reserva en todas las fechas que cubre.
 *
 * @param {Array} reservas — Array de objetos Reserva
 * @returns {Map<string, Object>} mapa fecha → reserva
 */
function indexarReservasPorFecha(reservas) {
  const mapa = new Map();

  for (const r of reservas) {
    const inicio = new Date(r.fechaInicio + 'T00:00:00');
    const fin    = new Date(r.fechaFin + 'T00:00:00');
    const cursor = new Date(inicio);

    while (cursor < fin) {
      const clave = formatoFechaLocal(cursor);
      mapa.set(clave, r);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return mapa;
}

// ------------------------------------------------------------
// GENERADOR DEL MES
// ------------------------------------------------------------

/**
 * Genera un MesCalendario completo, listo para renderizar
 * en una cuadrícula de 7 columnas (Lun–Dom).
 *
 * Incluye celdas de "padding" al inicio y al final para que
 * la primera fila comience en Lunes y la última termine en Domingo.
 *
 * @param {number} anio        — Año (e.g. 2026)
 * @param {number} mes         — Mes 1-12
 * @param {Array}  reservas    — Reservas activas (pueden abarcar varios meses)
 * @param {Map}    [preciosDia] — Map<'YYYY-MM-DD', number> precios custom por día
 * @returns {Object} MesCalendario
 *
 * @example
 *   const mayo2026 = generarMes(2026, 5, misReservas);
 *   // mayo2026.dias → array de 35 DiaCalendario (5 semanas × 7 días)
 *   // Renderizar en grid de 7 columnas directamente
 */
function generarMes(anio, mes, reservas = [], preciosDia = new Map()) {
  const totalDias      = new Date(anio, mes, 0).getDate();
  const primerDiaSemana = jsAIso(new Date(anio, mes - 1, 1).getDay()); // 0=Lun
  const precioDefecto  = precioTemporada(mes);

  // Índice rápido de reservas para este mes
  const indiceReservas = indexarReservasPorFecha(reservas);

  const dias = [];

  // ── Padding inicial (días vacíos antes del día 1) ──
  for (let p = 0; p < primerDiaSemana; p++) {
    dias.push(crearDiaCalendario({ esPadding: true, diaSemana: p }));
  }

  // ── Días reales del mes ──
  let diasAlquilados  = 0;
  let diasDisponibles = 0;
  let ingresosMes     = 0;

  for (let d = 1; d <= totalDias; d++) {
    const fecha     = formatoFecha(anio, mes, d);
    const diaSemana = jsAIso(new Date(anio, mes - 1, d).getDay());
    const reserva   = indiceReservas.get(fecha) || null;

    if (reserva) {
      // — DÍA ALQUILADO —
      diasAlquilados++;
      ingresosMes += reserva.precioNoche;

      dias.push(crearDiaCalendario({
        dia:         d,
        fecha,
        diaSemana,
        estado:      EstadoDia.ALQUILADO,
        reservaId:   reserva.id,
        huespedes:   reserva.huespedes,
        precioNoche: reserva.precioNoche,
        origen:      reserva.origen,
      }));
    } else {
      // — DÍA DISPONIBLE —
      diasDisponibles++;
      const precio = preciosDia.get(fecha) ?? precioDefecto;

      dias.push(crearDiaCalendario({
        dia:        d,
        fecha,
        diaSemana,
        estado:     EstadoDia.DISPONIBLE,
        precioBase: precio,
      }));
    }
  }

  // ── Padding final (completar última semana hasta Domingo) ──
  const resto = dias.length % 7;
  if (resto > 0) {
    for (let p = 0; p < 7 - resto; p++) {
      dias.push(crearDiaCalendario({
        esPadding: true,
        diaSemana: (primerDiaSemana + totalDias + p) % 7,
      }));
    }
  }

  // ── Resumen del mes ──
  const resumen = {
    diasAlquilados,
    diasDisponibles,
    ocupacion: totalDias > 0 ? +((diasAlquilados / totalDias) * 100).toFixed(1) : 0,
    ingresosMes: +ingresosMes.toFixed(2),
  };

  return crearMesCalendario({ anio, mes, dias, resumen });
}

// ------------------------------------------------------------
// NAVEGACIÓN ENTRE MESES
// ------------------------------------------------------------

/**
 * Devuelve { anio, mes } del mes anterior.
 */
function mesAnterior(anio, mes) {
  return mes === 1
    ? { anio: anio - 1, mes: 12 }
    : { anio, mes: mes - 1 };
}

/**
 * Devuelve { anio, mes } del mes siguiente.
 */
function mesSiguiente(anio, mes) {
  return mes === 12
    ? { anio: anio + 1, mes: 1 }
    : { anio, mes: mes + 1 };
}

// ------------------------------------------------------------
// DEMO: Generar Mayo 2026 con reservas de ejemplo
// ------------------------------------------------------------

function demo() {
  // Reservas de ejemplo
  const reservas = [
    crearReserva({
      id: 'res-001',
      fechaInicio: '2026-05-03',
      fechaFin:    '2026-05-07',
      huespedes:   4,
      precioTotal: 400,
      nombreCliente: 'García López',
    }),
    crearReserva({
      id: 'res-002',
      fechaInicio: '2026-05-15',
      fechaFin:    '2026-05-20',
      huespedes:   2,
      precioTotal: 500,
      nombreCliente: 'Martín Ruiz',
    }),
    crearReserva({
      id: 'res-003',
      fechaInicio: '2026-05-28',
      fechaFin:    '2026-06-02',
      huespedes:   3,
      precioTotal: 600,
      nombreCliente: 'Fernández Díaz',
    }),
  ];

  // Precios custom para ciertos días (e.g. puente o evento)
  const preciosCustom = new Map([
    ['2026-05-01', 95],  // Día del Trabajador
    ['2026-05-02', 95],
  ]);

  const mayo = generarMes(2026, 5, reservas, preciosCustom);

  console.log(`\n📅 ${mayo.nombreMes} ${mayo.anio}`);
  console.log(`   Total días: ${mayo.totalDias}`);
  console.log(`   Ocupación:  ${mayo.resumen.ocupacion}%`);
  console.log(`   Ingresos:   ${mayo.resumen.ingresosMes}€`);
  console.log(`   Alquilados: ${mayo.resumen.diasAlquilados} | Disponibles: ${mayo.resumen.diasDisponibles}`);

  // Imprimir cuadrícula
  console.log('\n   ' + NOMBRES_DIA_CORTO.join('  '));
  let fila = '   ';
  for (const d of mayo.dias) {
    if (d.esPadding) {
      fila += '  ·  ';
    } else if (d.estado === EstadoDia.ALQUILADO) {
      fila += ` [${String(d.dia).padStart(2, '0')}]`;
    } else {
      fila += `  ${String(d.dia).padStart(2, '0')} `;
    }
    if (fila.length > 38) {
      console.log(fila);
      fila = '   ';
    }
  }
  if (fila.trim()) console.log(fila);

  console.log('\n   [XX] = Alquilado');

  // Detalle de reservas
  console.log('\n📋 Reservas:');
  for (const r of reservas) {
    console.log(`   ${r.id}: ${r.nombreCliente} | ${r.fechaInicio} → ${r.fechaFin} (${r.noches}n) | ${r.huespedes}👥 | ${r.precioTotal}€ (${r.precioNoche}€/n)`);
  }

  return mayo;
}
