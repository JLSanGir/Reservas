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
    const { data, error } = await supabase
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
    }));
  } catch (err) {
    console.error('❌ Error al obtener reservas:', err.message);
    return [];
  }
}

/**
 * Obtiene los precios custom para los días de un mes.
 *
 * @param {number} mes  — 1-12
 * @param {number} anio — e.g. 2026
 * @returns {Promise<Map<string, number>>} Map<'YYYY-MM-DD', precio>
 */
async function obtenerPreciosMes(mes, anio) {
  const totalDias = new Date(anio, mes, 0).getDate();
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(totalDias).padStart(2, '0')}`;

  try {
    const { data, error } = await supabase
      .from('precios_disponibles')
      .select('fecha, precio')
      .gte('fecha', desde)
      .lte('fecha', hasta);

    if (error) throw error;

    const mapa = new Map();
    for (const row of (data || [])) {
      mapa.set(row.fecha, parseFloat(row.precio));
    }
    return mapa;
  } catch (err) {
    console.error('❌ Error al obtener precios:', err.message);
    return new Map();
  }
}

/**
 * Función principal: obtiene TODOS los datos del mes de una sola vez.
 * Ejecuta las dos consultas en paralelo para mínima latencia.
 *
 * @param {number} mes  — 1-12
 * @param {number} anio — e.g. 2026
 * @returns {Promise<{reservas: Array, precios: Map}>}
 */
async function obtenerDatosMes(mes, anio) {
  const [reservas, precios] = await Promise.all([
    obtenerReservasMes(mes, anio),
    obtenerPreciosMes(mes, anio),
  ]);

  return { reservas, precios };
}

// ────────────────────────────────────────────────────────────
// ESCRITURA: Insertar / Actualizar
// ────────────────────────────────────────────────────────────

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
 * @returns {Promise<Object|null>} Reserva creada (modelo local) o null si error
 */
async function guardarReserva(datos) {
  try {
    const { data, error } = await supabase
      .from('reservas')
      .insert({
        fecha_inicio:    datos.fechaInicio,
        fecha_fin:       datos.fechaFin,
        huespedes:       datos.huespedes,
        precio_total:    datos.precioTotal,
        nombre_cliente:  datos.nombreCliente || '',
        telefono:        datos.telefono || '',
        notas:           datos.notas || '',
      })
      .select()
      .single();

    if (error) {
      // Detectar error de solapamiento (exclusion constraint)
      if (error.code === '23P01') {
        console.warn('⚠️ Conflicto: ya existe una reserva en esas fechas.');
        throw new Error('SOLAPAMIENTO: Ya existe una reserva que cubre parte de esas fechas.');
      }
      throw error;
    }

    console.log('✅ Reserva guardada:', data.id);

    // Retornar como modelo local
    return crearReserva({
      id:            data.id,
      fechaInicio:   data.fecha_inicio,
      fechaFin:      data.fecha_fin,
      huespedes:     data.huespedes,
      precioTotal:   parseFloat(data.precio_total),
      nombreCliente: data.nombre_cliente,
      telefono:      data.telefono,
      notas:         data.notas,
    });
  } catch (err) {
    console.error('❌ Error al guardar reserva:', err.message);
    return null;
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
    const { error } = await supabase
      .from('reservas')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log('🗑️ Reserva eliminada:', id);
    return true;
  } catch (err) {
    console.error('❌ Error al eliminar reserva:', err.message);
    return false;
  }
}

/**
 * Inserta o actualiza el precio de un día disponible (UPSERT).
 *
 * @param {string} fecha       — 'YYYY-MM-DD'
 * @param {number} nuevoPrecio — Precio en €
 * @returns {Promise<boolean>} true si se guardó correctamente
 */
async function actualizarPrecioDia(fecha, nuevoPrecio) {
  try {
    const { error } = await supabase
      .from('precios_disponibles')
      .upsert(
        { fecha, precio: nuevoPrecio },
        { onConflict: 'fecha' }
      );

    if (error) throw error;

    console.log(`💰 Precio actualizado: ${fecha} → ${nuevoPrecio}€`);
    return true;
  } catch (err) {
    console.error('❌ Error al actualizar precio:', err.message);
    return false;
  }
}
