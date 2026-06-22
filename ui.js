// ============================================================
// RESERVAS — UI: Renderizado del Calendario
// Componente reactivo, mobile-first, con BottomSheet
// Supabase obligatorio como fuente unica de datos
// ============================================================

// ------------------------------------------------------------
// ESTADO GLOBAL DE LA APP
// ------------------------------------------------------------
const AppState = {
  anio: new Date().getFullYear(),
  mes: new Date().getMonth() + 1,  // 1-12
  mesActual: null,                  // MesCalendario generado
  reservas: [],                     // Array de Reserva (mes actual)
  reservasLista: [],                // Array de Reserva (vista lista)
  vistaActiva: 'calendario',
  preciosCustom: new Map(),
  minimosNochesCustom: new Map(),
  cargando: false,                  // Flag de loading
  diaEditando: null,
  guardando: false,
  sincronizando: false,
  canalRealtime: null,
  ultimoErrorCarga: null,
};

// Mapa rápido de reservas por ID para el BottomSheet
const reservasPorId = new Map();

const CLASE_ORIGEN_RESERVA = Object.freeze({
  BOOKING: 'origin-booking',
  AIRBNB:  'origin-airbnb',
  PROPIO:  'origin-propio',
  OTROS:   'origin-otros',
});

function claseOrigenReserva(origen) {
  return CLASE_ORIGEN_RESERVA[normalizarOrigenReserva(origen)];
}

function etiquetaOrigenReserva(origen) {
  return normalizarOrigenReserva(origen);
}

// ------------------------------------------------------------
// CARGA DE DATOS
// ------------------------------------------------------------

/**
 * Obtiene reservas y precios del mes actual desde Supabase.
 */
async function cargarDatosMes() {
  AppState.cargando = true;
  AppState.ultimoErrorCarga = null;
  mostrarLoading(true);

  try {
    const { reservas, precios, minimosNoches } = await obtenerDatosMes(AppState.mes, AppState.anio);
    AppState.reservas = reservas;
    AppState.preciosCustom = precios;
    AppState.minimosNochesCustom = minimosNoches;

    reservasPorId.clear();
    for (const r of AppState.reservas) {
      reservasPorId.set(r.id, r);
    }
  } catch (err) {
    AppState.ultimoErrorCarga = err;
    console.error('Error cargando datos:', err);
    mostrarToast('No se pudo sincronizar el calendario. Revisa la conexion con Supabase.');
    throw err;
  } finally {
    AppState.cargando = false;
    mostrarLoading(false);
  }
}

/**
 * Muestra/oculta indicador de carga en la cuadricula.
 */
function mostrarLoading(visible) {
  if (!DOM.calendarGrid) return;
  if (visible) {
    DOM.calendarGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 0;
                  color: var(--text-muted); font-size: 0.85rem;">
        <div style="margin-bottom: 8px; font-size: 1.2rem;">...</div>
        Cargando...
      </div>`;
  }
}

function mostrarErrorSupabaseInicial(err) {
  console.error('No se pudo inicializar Supabase:', err);
  AppState.ultimoErrorCarga = err;

  if (DOM.calendarGrid) {
    DOM.calendarGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 16px;
                  color: var(--text-muted); font-size: 0.9rem; line-height: 1.5;">
        <strong style="display:block; color: var(--text-main); margin-bottom: 8px;">No se pudo conectar con Supabase</strong>
        La app necesita Supabase para cargar y guardar reservas. Recarga la pagina o revisa la conexion.
      </div>`;
  }

  [DOM.btnPrev, DOM.btnNext, DOM.btnNewReservation].forEach(btn => {
    if (btn) btn.disabled = true;
  });

  if (DOM.btnVerListaReservas) {
    DOM.btnVerListaReservas.disabled = true;
  }

  mostrarToast('Supabase no esta disponible. No se usaran datos locales.');
}

function limpiarSuscripcionTiempoReal() {
  if (!AppState.canalRealtime) return;
  supabaseClient.removeChannel(AppState.canalRealtime);
  AppState.canalRealtime = null;
}

async function sincronizarMesActual({ forzar = false } = {}) {
  if (AppState.guardando && !forzar) return;
  if (AppState.sincronizando) return;

  AppState.sincronizando = true;

  try {
    await renderMes(null, { recargarDatos: true });
  } catch (err) {
    console.error('❌ Error sincronizando calendario:', err);
  } finally {
    AppState.sincronizando = false;
  }
}

function programarSincronizacionTiempoReal() {
  clearTimeout(programarSincronizacionTiempoReal.timeoutId);
  programarSincronizacionTiempoReal.timeoutId = setTimeout(() => {
    sincronizarMesActual();
  }, 150);
}

function iniciarSincronizacionTiempoReal() {
  if (AppState.canalRealtime) return;

  const channelName = `calendario-reservas-${Date.now()}`;
  AppState.canalRealtime = supabaseClient
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
      programarSincronizacionTiempoReal();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'precios_disponibles' }, () => {
      programarSincronizacionTiempoReal();
    })
    .subscribe((status) => {
      console.log('🔄 Estado sincronización realtime:', status);
    });
}

function inicializarAutoRecarga() {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) sincronizarMesActual({ forzar: true });
  });

  window.addEventListener('focus', () => {
    sincronizarMesActual({ forzar: true });
  });

  window.addEventListener('online', () => {
    sincronizarMesActual({ forzar: true });
  });
}

// ------------------------------------------------------------
// REFS AL DOM
// ------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const DOM = {};

function cachearDOM() {
  DOM.monthName    = $('#month-name');
  DOM.yearLabel    = $('#year-label');
  DOM.btnPrev      = $('#btn-prev');
  DOM.btnNext      = $('#btn-next');
  DOM.btnNewReservation = $('#btn-new-reservation');
  DOM.btnVerListaReservas = $('#btn-ver-lista-reservas');
  DOM.btnVolverCalendario = $('#btn-volver-calendario');
  DOM.monthHeader = $('#month-header');
  DOM.summaryBar = $('#summary-bar');
  DOM.toast        = $('#toast');
  DOM.ocupacion    = $('#val-ocupacion');
  DOM.ingresos     = $('#val-ingresos');
  DOM.calendarGrid = $('#calendar-grid');
  DOM.vistaCalendario = $('#vista-calendario');
  DOM.vistaLista = $('#vista-lista');
  DOM.listaReservas = $('#lista-reservas');
  DOM.overlay      = $('#overlay');
  DOM.bottomSheet  = $('#bottom-sheet');
  DOM.sheetResId   = $('#sheet-res-id');
  DOM.sheetClient  = $('#sheet-client');
  DOM.sheetDates   = $('#sheet-dates');
  DOM.sheetDatesSub = $('#sheet-dates-sub');
  DOM.sheetGuests  = $('#sheet-guests');
  DOM.sheetPrice   = $('#sheet-price');
  DOM.sheetPriceSub = $('#sheet-price-sub');
  DOM.sheetNotes   = $('#sheet-notes');
  DOM.sheetNotesRow = $('#sheet-notes-row');
}

// ------------------------------------------------------------
// RENDERIZADO
// ------------------------------------------------------------

/**
 * Actualiza toda la vista del mes actual.
 * @param {'left'|'right'|null} direction — dirección de la animación
 */
async function renderMes(direction = null, { recargarDatos = true } = {}) {
  // Cargar datos solo cuando hace falta consultar Supabase.
  // Tras borrar una reserva ya tenemos AppState.reservas limpio, así que podemos
  // regenerar el mes desde ese estado sin pisarlo con una lectura antigua.
  if (recargarDatos) {
    await cargarDatosMes();
  }

  // Generar estructura del mes con los datos cargados
  AppState.mesActual = generarMes(
    AppState.anio,
    AppState.mes,
    AppState.reservas,
    AppState.preciosCustom,
    AppState.minimosNochesCustom,
  );

  const m = AppState.mesActual;

  // Cabecera
  DOM.monthName.textContent = m.nombreMes;
  DOM.yearLabel.textContent = m.anio;

  // Resumen
  DOM.ocupacion.textContent = m.resumen.ocupacion + '%';
  DOM.ingresos.textContent  = m.resumen.ingresosMes.toLocaleString('es-ES') + '€';

  // Animación de transición
  if (direction) {
    const outClass = direction === 'left' ? 'slide-out-left' : 'slide-out-right';
    const inClass  = direction === 'left' ? 'slide-in-right' : 'slide-in-left';

    DOM.calendarGrid.classList.add(outClass);

    setTimeout(() => {
      renderCeldas(m.dias);
      DOM.calendarGrid.classList.remove(outClass);
      DOM.calendarGrid.classList.add(inClass);

      setTimeout(() => DOM.calendarGrid.classList.remove(inClass), 260);
    }, 200);
  } else {
    renderCeldas(m.dias);
  }
}

/**
 * Genera el HTML de las celdas del calendario.
 */
function renderCeldas(dias) {
  const hoy = new Date();
  const hoyStr = formatoFecha(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate());

  let html = '';
  let idx = 0;

  for (const d of dias) {
    const delay = Math.min(idx * 12, 350);

    if (d.esPadding) {
      html += `<div class="day-cell padding" style="--delay:${delay}ms"></div>`;
    } else if (d.estado === EstadoDia.ALQUILADO) {
      const todayClass = d.fecha === hoyStr ? ' today' : '';
      const originClass = claseOrigenReserva(d.origen);
      const precioTotal = Number(d.precioTotal || 0).toLocaleString('es-ES');
      html += `
        <div class="day-cell rented ${originClass}${todayClass}"
             style="--delay:${delay}ms"
             data-reserva-id="${d.reservaId}"
             data-origen="${etiquetaOrigenReserva(d.origen)}"
             onclick="abrirDetalle('${d.reservaId}')">
          <span class="duration-badge" title="Duración total">${d.duracionEstancia}</span>
          <span class="day-number">${d.dia}</span>
          <span class="guest-badge">👥${d.huespedes}</span>
          ${d.esCheckIn ? `<span class="total-price-badge" title="Precio total">${precioTotal}€</span>` : ''}
        </div>`;
    } else {
      const todayClass = d.fecha === hoyStr ? ' today' : '';
      html += `
        <div class="day-cell available${todayClass}"
             style="--delay:${delay}ms"
             onclick="abrirEditarDia('${d.fecha}', ${d.precioBase})">
          <span class="min-nights-badge" title="Mínimo de noches">${d.minimoNoches}</span>
          <span class="day-number">${d.dia}</span>
          <span class="day-price">${d.precioBase}€</span>
        </div>`;
    }
    idx++;
  }

  DOM.calendarGrid.innerHTML = html;
}

// ------------------------------------------------------------
// BOTTOM SHEET — Detalle de Reserva
// ------------------------------------------------------------

function abrirDetalle(reservaId) {
  const r = reservasPorId.get(reservaId);
  if (!r) return;

  // Vibración háptica suave (si disponible)
  if (navigator.vibrate) navigator.vibrate(15);

  DOM.sheetResId.textContent   = r.id;
  DOM.sheetClient.textContent  = r.nombreCliente || 'Sin nombre';
  DOM.sheetDates.textContent   = `${formatearFechaCorta(r.fechaInicio)} → ${formatearFechaCorta(r.fechaFin)}`;
  DOM.sheetDatesSub.textContent = `${r.noches} noche${r.noches !== 1 ? 's' : ''}`;
  DOM.sheetGuests.textContent  = `${r.huespedes} huésped${r.huespedes !== 1 ? 'es' : ''}`;
  DOM.sheetPrice.textContent   = `${r.precioTotal.toLocaleString('es-ES')}€`;
  DOM.sheetPriceSub.textContent = `${r.precioNoche}€ / noche`;

  // Notas (mostrar/ocultar)
  if (r.notas) {
    DOM.sheetNotes.textContent = r.notas;
    DOM.sheetNotesRow.style.display = 'flex';
  } else {
    DOM.sheetNotesRow.style.display = 'none';
  }

  DOM.overlay.classList.add('active');
  DOM.bottomSheet.classList.add('active');
}

function cerrarDetalle() {
  DOM.overlay.classList.remove('active');
  DOM.bottomSheet.classList.remove('active');
}

/**
 * Formatea 'YYYY-MM-DD' → '3 May'
 */
function formatearFechaCorta(fechaStr) {
  const mesesCortos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const [, m, d] = fechaStr.split('-');
  return `${parseInt(d)} ${mesesCortos[parseInt(m) - 1]}`;
}

function escaparHtml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatearFechaLarga(fechaStr) {
  const fecha = new Date(`${fechaStr}T00:00:00`);
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(fecha);
}

function cambiarVista(vista) {
  AppState.vistaActiva = vista;

  if (vista === 'lista') {
    if (DOM.monthHeader) DOM.monthHeader.classList.add('is-hidden');
    if (DOM.summaryBar) DOM.summaryBar.classList.add('is-hidden');
    if (DOM.btnNewReservation) DOM.btnNewReservation.classList.add('is-hidden');
    DOM.vistaCalendario.classList.add('is-hidden');
    DOM.vistaLista.classList.remove('is-hidden');
  } else {
    DOM.vistaLista.classList.add('is-hidden');
    DOM.vistaCalendario.classList.remove('is-hidden');
    if (DOM.monthHeader) DOM.monthHeader.classList.remove('is-hidden');
    if (DOM.summaryBar) DOM.summaryBar.classList.remove('is-hidden');
    if (DOM.btnNewReservation) DOM.btnNewReservation.classList.remove('is-hidden');
  }
}

async function abrirVistaListaReservas() {
  cambiarVista('lista');

  if (!AppState.reservasLista.length) {
    DOM.listaReservas.innerHTML = '<div class="list-loading">Cargando reservas...</div>';

    try {
      AppState.reservasLista = await obtenerTodasLasReservas();
    } catch (err) {
      DOM.listaReservas.innerHTML = '<div class="list-empty">No se pudieron cargar las reservas.</div>';
      mostrarToast('No se pudo cargar la lista de reservas.');
      return;
    }
  }

  renderListaReservas();
}

function volverAlCalendario() {
  cambiarVista('calendario');
}

function renderListaReservas() {
  if (!DOM.listaReservas) return;

  if (!AppState.reservasLista.length) {
    DOM.listaReservas.innerHTML = '<div class="list-empty">No hay reservas para mostrar.</div>';
    return;
  }

  DOM.listaReservas.innerHTML = AppState.reservasLista.map((r) => `
    <article class="reserva-row" data-reserva-id="${r.id}">
      <div class="reserva-row__top">
        <div>
          <div class="reserva-row__fecha">${escaparHtml(formatearFechaLarga(r.fechaInicio))}</div>
          <div class="reserva-row__duracion">${r.noches} noche${r.noches !== 1 ? 's' : ''} · ${escaparHtml(formatearFechaCorta(r.fechaInicio))} → ${escaparHtml(formatearFechaCorta(r.fechaFin))}</div>
        </div>
        <div class="reserva-row__meta">${escaparHtml(r.nombreCliente || 'Sin nombre')}</div>
      </div>

      <div class="reserva-row__checks">
        <label class="task-check">
          <input type="checkbox" data-reserva-id="${r.id}" data-campo="llaves_entregadas" ${r.llavesEntregadas ? 'checked' : ''}>
          <span>Llaves</span>
        </label>

        <label class="task-check">
          <input type="checkbox" data-reserva-id="${r.id}" data-campo="limpieza_hecha" ${r.limpiezaHecha ? 'checked' : ''}>
          <span>Limpieza</span>
        </label>
      </div>
    </article>
  `).join('');
}

function actualizarReservaEnLista(reservaId, campo, valor) {
  AppState.reservasLista = AppState.reservasLista.map((reserva) => {
    if (reserva.id !== reservaId) return reserva;

    return {
      ...reserva,
      [campo === 'llaves_entregadas' ? 'llavesEntregadas' : 'limpiezaHecha']: valor,
    };
  });
}

function inicializarListaReservas() {
  if (DOM.btnVerListaReservas) {
    DOM.btnVerListaReservas.addEventListener('click', abrirVistaListaReservas);
  }

  if (DOM.btnVolverCalendario) {
    DOM.btnVolverCalendario.addEventListener('click', volverAlCalendario);
  }

  if (!DOM.listaReservas) return;

  DOM.listaReservas.addEventListener('change', async (event) => {
    const input = event.target;
    if (!input.matches('input[type="checkbox"][data-reserva-id][data-campo]')) return;

    const reservaId = input.dataset.reservaId;
    const campo = input.dataset.campo;
    const valor = input.checked;

    input.disabled = true;

    try {
      await actualizarEstadoTareaReserva(reservaId, campo, valor);
      actualizarReservaEnLista(reservaId, campo, valor);
    } catch (err) {
      input.checked = !valor;
      mostrarToast('No se pudo guardar el cambio.');
    } finally {
      input.disabled = false;
    }
  });
}

// ------------------------------------------------------------
// NAVEGACIÓN
// ------------------------------------------------------------

function abrirBottomSheet() {
  DOM.overlay.classList.add('active');
  DOM.bottomSheet.classList.add('active');
}

function cerrarDetalle() {
  DOM.overlay.classList.remove('active');
  DOM.bottomSheet.classList.remove('active');
  AppState.diaEditando = null;
}

function abrirDetalle(reservaId) {
  const r = reservasPorId.get(reservaId);
  if (!r) return;

  if (navigator.vibrate) navigator.vibrate(15);

  DOM.bottomSheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">
      Reserva
      <span class="res-id">${r.id}</span>
    </div>

    <div class="sheet-details">
      <div class="detail-row">
        <div class="detail-icon client">👤</div>
        <div class="detail-info">
          <span class="detail-label">Huésped</span>
          <span class="detail-value">${r.nombreCliente || 'Sin nombre'}</span>
        </div>
      </div>

      <div class="detail-row">
        <div class="detail-icon dates">📅</div>
        <div class="detail-info">
          <span class="detail-label">Estancia</span>
          <span class="detail-value">${formatearFechaCorta(r.fechaInicio)} → ${formatearFechaCorta(r.fechaFin)}</span>
          <span class="detail-sub">${r.noches} noche${r.noches !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div class="detail-row">
        <div class="detail-icon guests">👥</div>
        <div class="detail-info">
          <span class="detail-label">Huéspedes</span>
          <span class="detail-value">${r.huespedes} huésped${r.huespedes !== 1 ? 'es' : ''}</span>
        </div>
      </div>

      <div class="detail-row">
        <div class="detail-icon origin ${claseOrigenReserva(r.origen)}"></div>
        <div class="detail-info">
          <span class="detail-label">Origen</span>
          <span class="detail-value">${etiquetaOrigenReserva(r.origen)}</span>
        </div>
      </div>

      <div class="detail-row">
        <div class="detail-icon price">€</div>
        <div class="detail-info">
          <span class="detail-label">Precio total</span>
          <span class="detail-value">${r.precioTotal.toLocaleString('es-ES')}€</span>
          <span class="detail-sub">${r.precioNoche}€ / noche</span>
        </div>
      </div>

      ${r.notas ? `
        <div class="detail-row">
          <div class="detail-icon client">✎</div>
          <div class="detail-info">
            <span class="detail-label">Notas</span>
            <span class="detail-value">${r.notas}</span>
          </div>
        </div>
      ` : ''}
    </div>

    <div class="sheet-actions">
      <button class="secondary-action" type="button" onclick="abrirEditarReserva('${r.id}')">
        Editar Reserva
      </button>
      <button class="danger-action" type="button" onclick="confirmarEliminarReserva('${r.id}')">
        Borrar Reserva
      </button>
    </div>`;

  abrirBottomSheet();
}

function quitarReservaDelEstado(reservaId) {
  AppState.reservas = AppState.reservas.filter(r => r.id !== reservaId);
  reservasPorId.delete(reservaId);
  AppState.mesActual = null;
}

async function confirmarEliminarReserva(reservaId) {
  if (AppState.guardando) return;

  const confirmado = confirm('¿Estás seguro de que deseas eliminar esta reserva? Esta acción no se puede deshacer');
  if (!confirmado) return;

  AppState.guardando = true;
  const deleteButton = DOM.bottomSheet.querySelector('.danger-action');
  if (deleteButton) {
    deleteButton.disabled = true;
    deleteButton.textContent = 'Borrando...';
  }

  try {
    const ok = await eliminarReserva(reservaId);
    if (!ok) throw new Error('No se pudo eliminar la reserva.');

    // Actualizar la memoria de la vista para una respuesta visual inmediata.
    quitarReservaDelEstado(reservaId);

    cerrarDetalle();
    mostrarToast('Reserva eliminada correctamente');
    
    // Volver a renderizar el mes actual (redibujando el calendario)
    await renderMes(null, { recargarDatos: false });
  } catch (err) {
    mostrarToast(err.message || 'No se pudo eliminar la reserva');
    if (deleteButton) {
      deleteButton.disabled = false;
      deleteButton.textContent = 'Borrar Reserva';
    }
  } finally {
    AppState.guardando = false;
  }
}

function abrirEditarReserva(reservaId) {
  const r = reservasPorId.get(reservaId);
  if (!r) return;

  const origen = normalizarOrigenReserva(r.origen);

  DOM.bottomSheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">Editar reserva</div>
    <form class="sheet-form" id="edit-reservation-form">
      <div class="form-field">
        <label for="booking-client">Huésped</label>
        <input id="booking-client" type="text" value="${escaparHtml(r.nombreCliente || '')}">
      </div>

      <div class="form-grid">
        <div class="form-field">
          <label for="booking-start">Check-in</label>
          <input id="booking-start" type="date" value="${escaparHtml(r.fechaInicio)}" required>
        </div>
        <div class="form-field">
          <label for="booking-end">Check-out</label>
          <input id="booking-end" type="date" value="${escaparHtml(r.fechaFin)}" required>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-field">
          <label for="booking-guests">Huéspedes</label>
          <input id="booking-guests" type="number" min="1" max="20" step="1" inputmode="numeric" value="${r.huespedes}" required>
        </div>
        <div class="form-field">
          <label for="booking-price">Precio total</label>
          <div class="input-with-suffix">
            <input id="booking-price" type="number" min="0" step="1" inputmode="decimal" value="${r.precioTotal}" required>
            <span>€</span>
          </div>
        </div>
      </div>

      <div class="form-field">
        <label for="booking-origin">Origen</label>
        <select id="booking-origin" required>
          <option value="BOOKING" ${origen === 'BOOKING' ? 'selected' : ''}>BOOKING</option>
          <option value="AIRBNB" ${origen === 'AIRBNB' ? 'selected' : ''}>AIRBNB</option>
          <option value="PROPIO" ${origen === 'PROPIO' ? 'selected' : ''}>PROPIO</option>
          <option value="OTROS" ${origen === 'OTROS' ? 'selected' : ''}>OTROS</option>
        </select>
      </div>

      <p class="form-error" id="reservation-form-error" aria-live="polite"></p>

      <button class="primary-action" type="submit">Guardar cambios</button>
    </form>`;

  abrirBottomSheet();
  $('#edit-reservation-form').addEventListener('submit', (event) => confirmarEditarReserva(event, reservaId));
  $('#booking-start').addEventListener('change', prepararFechaSalida);
  prepararFechaSalida();
  $('#booking-client').focus();
}

async function confirmarEditarReserva(event, reservaId) {
  event.preventDefault();
  if (AppState.guardando) return;

  const errorEl = $('#reservation-form-error');
  const datos = {
    nombreCliente: $('#booking-client').value,
    fechaInicio: $('#booking-start').value,
    fechaFin: $('#booking-end').value,
    huespedes: parseInt($('#booking-guests').value, 10),
    precioTotal: Number($('#booking-price').value),
    origen: $('#booking-origin').value,
  };

  const errorValidacion = validarReserva(datos);
  if (errorValidacion) {
    errorEl.textContent = errorValidacion;
    return;
  }

  AppState.guardando = true;
  setFormBusy('#edit-reservation-form', true);

  try {
    const reservaActualizada = await actualizarReserva(reservaId, datos);

    AppState.reservas = AppState.reservas.map(r =>
      r.id === reservaId ? reservaActualizada : r
    );
    reservasPorId.set(reservaId, reservaActualizada);
    AppState.mesActual = null;

    cerrarDetalle();
    mostrarToast('Reserva actualizada');
    await renderMes(null, { recargarDatos: false });
  } catch (err) {
    errorEl.textContent = err.code === '23P01'
      ? 'Las fechas seleccionadas ya están ocupadas'
      : 'No se pudo actualizar la reserva. Inténtalo de nuevo.';
  } finally {
    AppState.guardando = false;
    setFormBusy('#edit-reservation-form', false);
  }
}

function abrirEditarDia(fecha, precioActual) {
  const minimoActual = AppState.minimosNochesCustom.get(fecha) ?? 1;
  const fechaFinal = sumarDias(fecha, 1);

  AppState.diaEditando = { fecha, precioActual, minimoActual };
  if (navigator.vibrate) navigator.vibrate(10);

  DOM.bottomSheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">Editar día</div>
    <form class="sheet-form" id="price-form">
      <div class="form-grid">
        <div class="form-field">
          <label for="day-start">Fecha inicial</label>
          <input id="day-start" type="date" value="${fecha}" required>
        </div>

        <div class="form-field">
          <label for="day-end">Fecha final</label>
          <input id="day-end" type="date" value="${fechaFinal}" required>
        </div>
      </div>

      <div class="form-field">
        <label for="day-price">Precio por noche</label>
        <div class="input-with-suffix">
          <input id="day-price" type="number" min="0" step="1" inputmode="decimal" value="${precioActual}" required>
          <span>€</span>
        </div>
      </div>

      <div class="form-field">
        <label for="day-min-nights">Mínimo de noches</label>
        <input id="day-min-nights" type="number" min="1" step="1" inputmode="numeric" value="${minimoActual}" required>
      </div>

      <p class="form-error" id="price-form-error" aria-live="polite"></p>

      <button class="primary-action" type="submit">Guardar cambios</button>
    </form>`;

  abrirBottomSheet();
  $('#price-form').addEventListener('submit', guardarCambiosRangoSeleccionado);
  $('#day-start').addEventListener('change', prepararFechaFinalPrecio);
  prepararFechaFinalPrecio();
  $('#day-price').focus();
}

function prepararFechaFinalPrecio() {
  const start = $('#day-start');
  const end = $('#day-end');
  if (!start || !end || !start.value) return;

  end.min = start.value;
  if (!end.value || end.value < start.value) end.value = start.value;
}

async function guardarCambiosRangoSeleccionado(event) {
  event.preventDefault();
  if (AppState.guardando || !AppState.diaEditando) return;

  const fechaInicio = $('#day-start').value;
  const fechaFin = $('#day-end').value;
  const precio = Number($('#day-price').value);
  const minimoNoches = parseInt($('#day-min-nights').value, 10);
  const errorEl = $('#price-form-error');

  if (!fechaInicio || !fechaFin) {
    errorEl.textContent = 'Selecciona fecha inicial y fecha final.';
    return;
  }

  if (fechaFin < fechaInicio) {
    errorEl.textContent = 'La fecha final no puede ser anterior a la fecha inicial.';
    return;
  }

  if (!Number.isFinite(precio) || precio < 0) {
    errorEl.textContent = 'Introduce un precio válido.';
    return;
  }

  if (!Number.isInteger(minimoNoches) || minimoNoches < 1) {
    errorEl.textContent = 'Introduce un mínimo de noches válido.';
    return;
  }

  const fechas = obtenerFechasRango(fechaInicio, fechaFin);

  AppState.guardando = true;
  setFormBusy('#price-form', true);

  try {
    const ok = await actualizarConfiguracionDias(fechas, precio, minimoNoches);
    if (!ok) throw new Error('No se pudieron guardar los cambios.');

    for (const fecha of fechas) {
      AppState.preciosCustom.set(fecha, precio);
      AppState.minimosNochesCustom.set(fecha, minimoNoches);
    }
    AppState.mesActual = null;

    cerrarDetalle();
    mostrarToast('Cambios actualizados');
    await renderMes(null, { recargarDatos: false });
  } catch (err) {
    errorEl.textContent = err.message || 'No se pudieron guardar los cambios.';
  } finally {
    AppState.guardando = false;
    setFormBusy('#price-form', false);
  }
}

function abrirNuevaReserva() {
  if (navigator.vibrate) navigator.vibrate(10);
  const ultimoDiaMes = new Date(AppState.anio, AppState.mes, 0).getDate();
  const diaSugerido = Math.min(new Date().getDate(), ultimoDiaMes);
  const fechaSugerida = formatoFecha(AppState.anio, AppState.mes, diaSugerido);

  DOM.bottomSheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">Nueva reserva</div>
    <form class="sheet-form" id="reservation-form">
      <div class="form-grid">
        <div class="form-field">
          <label for="booking-start">Check-in</label>
          <input id="booking-start" type="date" value="${fechaSugerida}" required>
        </div>
        <div class="form-field">
          <label for="booking-end">Check-out</label>
          <input id="booking-end" type="date" required>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-field">
          <label for="booking-guests">Huéspedes</label>
          <input id="booking-guests" type="number" min="1" max="20" step="1" inputmode="numeric" value="2" required>
        </div>
        <div class="form-field">
          <label for="booking-price">Precio total</label>
          <div class="input-with-suffix">
            <input id="booking-price" type="number" min="0" step="1" inputmode="decimal" required>
            <span>€</span>
          </div>
        </div>
      </div>

      <div class="form-field">
        <label for="booking-origin">Origen</label>
        <select id="booking-origin" required>
          <option value="BOOKING">BOOKING</option>
          <option value="AIRBNB">AIRBNB</option>
          <option value="PROPIO" selected>PROPIO</option>
          <option value="OTROS">OTROS</option>
        </select>
      </div>

      <p class="form-error" id="reservation-form-error" aria-live="polite"></p>

      <button class="primary-action" type="submit">Confirmar reserva</button>
    </form>`;

  abrirBottomSheet();
  $('#reservation-form').addEventListener('submit', confirmarNuevaReserva);
  $('#booking-start').addEventListener('change', prepararFechaSalida);
  prepararFechaSalida();
}

function prepararFechaSalida() {
  const start = $('#booking-start');
  const end = $('#booking-end');
  if (!start || !end || !start.value) return;

  const minEnd = sumarDias(start.value, 1);
  end.min = minEnd;
  if (!end.value || end.value <= start.value) end.value = minEnd;
}

async function confirmarNuevaReserva(event) {
  event.preventDefault();
  if (AppState.guardando) return;

  const form = event.currentTarget;
  const errorEl = $('#reservation-form-error');
  const datos = {
    fechaInicio: $('#booking-start').value,
    fechaFin: $('#booking-end').value,
    huespedes: parseInt($('#booking-guests').value, 10),
    precioTotal: Number($('#booking-price').value),
    origen: $('#booking-origin').value,
  };

  const errorValidacion = validarReserva(datos);
  if (errorValidacion) {
    errorEl.textContent = errorValidacion;
    return;
  }

  AppState.guardando = true;
  setFormBusy('#reservation-form', true);

  try {
    const nuevaRes = await guardarReserva(datos);

    AppState.reservas.push(nuevaRes);
    reservasPorId.set(nuevaRes.id, nuevaRes);
    AppState.mesActual = null;

    form.reset();
    cerrarDetalle();
    mostrarToast('Reserva creada');
    await renderMes(null, { recargarDatos: false });
  } catch (err) {
    errorEl.textContent = err.code === '23P01'
      ? 'Las fechas seleccionadas ya están ocupadas'
      : 'No se pudo crear la reserva. Inténtalo de nuevo.';
  } finally {
    AppState.guardando = false;
    setFormBusy('#reservation-form', false);
  }
}

function validarReserva(datos) {
  if (!datos.fechaInicio || !datos.fechaFin) return 'Selecciona las fechas de entrada y salida.';
  if (datos.fechaFin <= datos.fechaInicio) return 'La fecha de salida debe ser posterior a la entrada.';
  if (!Number.isInteger(datos.huespedes) || datos.huespedes < 1) return 'Indica al menos 1 huésped.';
  if (datos.huespedes > 20) return 'Indica un máximo de 20 huéspedes.';
  if (!Number.isFinite(datos.precioTotal) || datos.precioTotal < 0) return 'Introduce un precio total válido.';
  if (!Object.values(OrigenReserva).includes(datos.origen)) return 'Selecciona un origen valido.';
  return '';
}


function sumarDias(fecha, dias) {
  const date = new Date(fecha + 'T00:00:00');
  date.setDate(date.getDate() + dias);
  return formatoFecha(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function setFormBusy(formSelector, busy) {
  const form = $(formSelector);
  if (!form) return;
  form.querySelectorAll('input, select, button').forEach(el => {
    el.disabled = busy;
  });
}

let toastTimeout = null;
function mostrarToast(mensaje) {
  if (!DOM.toast) return;
  DOM.toast.textContent = mensaje;
  DOM.toast.classList.add('active');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    DOM.toast.classList.remove('active');
  }, 2200);
}

async function irMesAnterior() {
  if (AppState.cargando) return; // Evitar doble-tap
  const prev = mesAnterior(AppState.anio, AppState.mes);
  AppState.anio = prev.anio;
  AppState.mes  = prev.mes;
  await renderMes('right');
}

async function irMesSiguiente() {
  if (AppState.cargando) return; // Evitar doble-tap
  const next = mesSiguiente(AppState.anio, AppState.mes);
  AppState.anio = next.anio;
  AppState.mes  = next.mes;
  await renderMes('left');
}

// Soporte de swipe táctil
let touchStartX = 0;
let touchStartY = 0;

function initSwipe() {
  const grid = DOM.calendarGrid;

  grid.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  grid.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;

    // Solo swipe horizontal si dx > dy
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) irMesSiguiente();
      else        irMesAnterior();
    }
  }, { passive: true });
}

// ------------------------------------------------------------
// INICIALIZACIÓN
// ------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  cachearDOM();

  try {
    await inicializarClienteSupabase();
    await renderMes();
    iniciarSincronizacionTiempoReal();
    inicializarAutoRecarga();
    initSwipe();
  } catch (err) {
    mostrarErrorSupabaseInicial(err);
    return;
  }

  // Eventos
  DOM.btnPrev.addEventListener('click', irMesAnterior);
  DOM.btnNext.addEventListener('click', irMesSiguiente);
  DOM.btnNewReservation.addEventListener('click', abrirNuevaReserva);
  DOM.overlay.addEventListener('click', cerrarDetalle);
  inicializarListaReservas();
});

window.addEventListener('beforeunload', limpiarSuscripcionTiempoReal);
