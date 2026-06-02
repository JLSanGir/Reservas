// ============================================================
// RESERVAS — Capa de Servicios / Datos
// Funciones asíncronas para comunicarse con Supabase
// Depende de: supabaseClient.js, models.js
// ============================================================

/**
 * Obtiene todas las reservas que intersectan un mes dado.
 * Incluye reservas que empiezan antes o terminan después del mes.
 *
 * @param {number} mes  — 1-12
 * @param {number} anio — e.g. 2026
 * @returns {Promise<Array>} Array de objetos Reserva (modelos locales)
 */
async function obtenerReservasMes(mes, anio) {
  // Rango del mes: primer día → primer día del mes siguiente
  const primerDia = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const mesSig    = mes === 12 ? 1 : mes + 1;
  const anioSig   = mes === 12 ? anio + 1 : anio;
  const ultimoDia = `${anioSig}-${String(mesSig).padStart(2, '0')}-01`;

  try {
    // Reservas que se solapan con el rango del mes:
    //   fecha_inicio < ultimoDia AND fecha_fin > primerDia
    const { data, error } = await supabaseClient
      .from('reservas')
      .select('*')
      .lt('fecha_inicio', ultimoDia)
      .gt('fecha_fin', primerDia)
      .order('fecha_inicio', { ascending: true });

    if (error) throw error;

    // Convertir filas de Supabase → modelo local Reserva
    return (data || []).map(row => crearReserva({
      id:             row.id,
      fechaInicio:    row.fecha_inicio,
      fechaFin:       row.fecha_fin,
      huespedes:      row.huespedes,
      precioTotal:    parseFloat(row.precio_total),
      nombreCliente:  row.nombre_cliente || '',
      telefono:       row.telefono || '',
      notas:          row.notas || '',
      origen:         row.origen || OrigenReserva.PROPIO,
    }));
  } catch (err) {
    console.error('❌ Error al obtener reservas:', err.message);
    throw err;
  }
}

/**
 * Obtiene la configuracion custom para los dias de un mes.
 *
 * @param {number} mes  — 1-12
 * @param {number} anio — e.g. 2026
 * @returns {Promise<{precios: Map<string, number>, minimosNoches: Map<string, number>}>}
 */
async function obtenerPreciosMes(mes, anio) {
  const totalDias = new Date(anio, mes, 0).getDate();
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(totalDias).padStart(2, '0')}`;

  try {
    const { data, error } = await supabaseClient
      .from('precios_disponibles')
      .select('fecha, precio, minimo_noches')
      .gte('fecha', desde)
      .lte('fecha', hasta);

    if (error) throw error;

    const precios = new Map();
    const minimosNoches = new Map();
    for (const row of (data || [])) {
      precios.set(row.fecha, parseFloat(row.precio));
      minimosNoches.set(row.fecha, Number(row.minimo_noches || 1));
    }
    return { precios, minimosNoches };
  } catch (err) {
    console.error('❌ Error al obtener precios:', err.message);
    throw err;
  }
}

/**
 * Función principal: obtiene TODOS los datos del mes de una sola vez.
 * Ejecuta las dos consultas en paralelo para mínima latencia.
 *
 * @param {number} mes  — 1-12
 * @param {number} anio — e.g. 2026
 * @returns {Promise<{reservas: Array, precios: Map, minimosNoches: Map}>}
 */
async function obtenerDatosMes(mes, anio) {
  const [reservas, configuracionDias] = await Promise.all([
    obtenerReservasMes(mes, anio),
    obtenerPreciosMes(mes, anio),
  ]);

  return {
    reservas,
    precios: configuracionDias.precios,
    minimosNoches: configuracionDias.minimosNoches,
  };
}

// ────────────────────────────────────────────────────────────
// ESCRITURA: Insertar / Actualizar
// ────────────────────────────────────────────────────────────

const FORMATO_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function normalizarTextoParaSupabase(valor) {
  return valor == null ? '' : String(valor).trim();
}

function normalizarFechaParaSupabase(valor, nombreCampo) {
  const fecha = normalizarTextoParaSupabase(valor);
  if (!FORMATO_FECHA_ISO.test(fecha)) {
    throw new Error(`${nombreCampo} debe tener formato YYYY-MM-DD.`);
  }
  return fecha;
}

function normalizarOrigenParaSupabase(origen) {
  const origenNormalizado = normalizarTextoParaSupabase(origen || OrigenReserva.PROPIO).toUpperCase();
  if (!Object.values(OrigenReserva).includes(origenNormalizado)) {
    throw new Error(`Origen de reserva invalido: ${origen}`);
  }
  return origenNormalizado;
}

function construirPayloadReserva(datos) {
  return {
    fecha_inicio:   normalizarFechaParaSupabase(datos.fechaInicio, 'fechaInicio'),
    fecha_fin:      normalizarFechaParaSupabase(datos.fechaFin, 'fechaFin'),
    huespedes:      datos.huespedes,
    precio_total:   datos.precioTotal,
    nombre_cliente: normalizarTextoParaSupabase(datos.nombreCliente),
    telefono:       normalizarTextoParaSupabase(datos.telefono),
    notas:          normalizarTextoParaSupabase(datos.notas),
    origen:         normalizarOrigenParaSupabase(datos.origen),
  };
}

function crearReservaDesdeFila(data) {
  return crearReserva({
    id:            data.id,
    fechaInicio:   data.fecha_inicio,
    fechaFin:      data.fecha_fin,
    huespedes:     data.huespedes,
    precioTotal:   parseFloat(data.precio_total),
    nombreCliente: data.nombre_cliente,
    telefono:      data.telefono,
    notas:         data.notas,
    origen:        data.origen || OrigenReserva.PROPIO,
  });
}

function manejarErrorReserva(error) {
  console.error("Error de Supabase:", error);

  if (error.code === '23P01') {
    console.warn('⚠️ Conflicto: ya existe una reserva en esas fechas.');
    const conflicto = new Error('Las fechas seleccionadas ya están ocupadas.');
    conflicto.code = '23P01';
    conflicto.supabaseError = error;
    throw conflicto;
  }

  console.error('❌ Error al guardar reserva:', error.message);
  throw error;
}

/**
 * Inserta una nueva reserva en Supabase.
 *
 * @param {Object} datos — Campos de la reserva
 * @param {string} datos.fechaInicio   — 'YYYY-MM-DD'
 * @param {string} datos.fechaFin      — 'YYYY-MM-DD'
 * @param {number} datos.huespedes
 * @param {number} datos.precioTotal
 * @param {string} [datos.nombreCliente]
 * @param {string} [datos.telefono]
 * @param {string} [datos.notas]
 * @returns {Promise<Object>} Reserva creada (modelo local)
 */
async function guardarReserva(datos) {
  try {
    const { data, error } = await supabaseClient
      .from('reservas')
      .insert(construirPayloadReserva(datos))
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data || !data.id) {
      throw new Error('Supabase no devolvió la reserva creada.');
    }

    console.log('✅ Reserva guardada:', data.id);

    return crearReservaDesdeFila(data);
  } catch (error) {
    manejarErrorReserva(error);
  }
}

/**
 * Actualiza una reserva existente en Supabase.
 *
 * @param {string} id — UUID de la reserva
 * @param {Object} datos — Campos actualizados de la reserva
 * @returns {Promise<Object>} Reserva actualizada (modelo local)
 */
async function actualizarReserva(id, datos) {
  try {
    const { data, error } = await supabaseClient
      .from('reservas')
      .update(construirPayloadReserva(datos))
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data || !data.id) {
      throw new Error('Supabase no devolvió la reserva actualizada.');
    }

    console.log('✅ Reserva actualizada:', data.id);
    return crearReservaDesdeFila(data);
  } catch (error) {
    manejarErrorReserva(error);
  }
}

/**
 * Elimina una reserva por su ID.
 *
 * @param {string} id — UUID de la reserva
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
async function eliminarReserva(id) {
  try {
    const { data, error } = await supabaseClient
      .from('reservas')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw error;

    if (!data || data.length === 0) {
      console.warn('⚠️ No se eliminó ninguna reserva:', id);
      return false;
    }

    console.log('🗑️ Reserva eliminada:', id);
    return true;
  } catch (err) {
    console.error('❌ Error al eliminar reserva:', err.message);
    return false;
  }
}

/**
 * Inserta o actualiza el precio y minimo de noches de varios dias disponibles (UPSERT).
 *
 * @param {string[]} fechas     — Array de fechas 'YYYY-MM-DD'
 * @param {number} precio       — Precio en €
 * @param {number} minimoNoches — Estancia minima
 * @returns {Promise<boolean>} true si se guardó correctamente
 */
async function actualizarConfiguracionDias(fechas, precio, minimoNoches) {
  try {
    if (!Array.isArray(fechas) || fechas.length === 0) {
      throw new Error('Debe indicarse al menos una fecha.');
    }

    if (!Number.isFinite(precio) || precio < 0) {
      throw new Error('El precio debe ser un numero valido.');
    }

    if (!Number.isInteger(minimoNoches) || minimoNoches < 1) {
      throw new Error('El minimo de noches debe ser un entero mayor o igual que 1.');
    }

    const filas = fechas.map(fecha => ({
      fecha: normalizarFechaParaSupabase(fecha, 'fecha'),
      precio,
      minimo_noches: minimoNoches,
    }));

    const { error } = await supabaseClient
      .from('precios_disponibles')
      .upsert(filas, { onConflict: 'fecha' });

    if (error) throw error;

    console.log(`💰 Configuracion actualizada: ${fechas.length} dia(s)`);
    return true;
  } catch (err) {
    console.error('❌ Error al actualizar configuracion:', err.message);
    return false;
  }
}

async function actualizarPrecioDia(fecha, nuevoPrecio) {
  return actualizarConfiguracionDias([fecha], nuevoPrecio, 1);
}
