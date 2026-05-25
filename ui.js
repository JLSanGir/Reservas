// ============================================================
// RESERVAS — UI: Renderizado del Calendario
// Componente reactivo, mobile-first, con BottomSheet
// Soporta Supabase (producción) y datos demo (desarrollo)
// ============================================================

// ------------------------------------------------------------
// ESTADO GLOBAL DE LA APP
// ------------------------------------------------------------
const AppState = {
  anio: new Date().getFullYear(),
  mes: new Date().getMonth() + 1,  // 1-12
  mesActual: null,                  // MesCalendario generado
  reservas: [],                     // Array de Reserva (mes actual)
  preciosCustom: new Map(),
  cargando: false,                  // Flag de loading
  diaEditando: null,
  guardando: false,
  usarSupabase: false,              // Se activa si la config es válida
  realtimeChannel: null,            // Canal de Supabase Realtime
  ultimaRecarga: 0,                 // Timestamp de la última recarga
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
// DATOS DE DEMO
// ------------------------------------------------------------
// ------------------------------------------------------------
// DETECCIÓN DE MODO: Supabase vs Demo
// ------------------------------------------------------------
function detectarModo() {
  // Comprobar si supabaseClient.js cargó y tiene URL real
  if (typeof SUPABASE_URL !== 'undefined' &&
      !SUPABASE_URL.includes('TU_PROYECTO')) {
    AppState.usarSupabase = true;
    console.log('🔗 Modo: Supabase (producción)');
  } else {
    AppState.usarSupabase = false;
    console.log('🧪 Modo: Demo (datos locales)');
  }
}

// ------------------------------------------------------------
// CARGA DE DATOS: Supabase o Demo
// ------------------------------------------------------------

/**
 * Obtiene reservas y precios del mes actual.
 * Si Supabase está configurado, consulta la BD.
 * Si no, usa datos demo locales.
 */
async function cargarDatosMes() {
  AppState.cargando = true;
  mostrarLoading(true);

  try {
    if (AppState.usarSupabase) {
      // ── Supabase ──
      const { reservas, precios } = await obtenerDatosMes(AppState.mes, AppState.anio);
      AppState.reservas      = reservas;
      AppState.preciosCustom = precios;
    } else {
      // ── Demo ──
      cargarDatosDemo();
    }

    // Indexar reservas por ID para BottomSheet
    reservasPorId.clear();
    for (const r of AppState.reservas) {
      reservasPorId.set(r.id, r);
    }
  } catch (err) {
    console.error('❌ Error cargando datos:', err);
  } finally {
    AppState.cargando = false;
    mostrarLoading(false);
  }
}

/**
 * Muestra/oculta indicador de carga en la cuadrícula.
 */
function mostrarLoading(visible) {
  if (!DOM.calendarGrid) return;
  if (visible) {
    DOM.calendarGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 0;
                  color: var(--text-muted); font-size: 0.85rem;">
        <div style="margin-bottom: 8px; font-size: 1.2rem;">⏳</div>
        Cargando...
      </div>`;
  }
}

// ------------------------------------------------------------
// DATOS DE DEMO (fallback cuando no hay Supabase)
// ------------------------------------------------------------
let demoReservas = null;
let demoPreciosCustom = null;

function cargarDatosDemo() {
  // Reservas globales (todos los meses) — se inicializan una única vez
  // Intentar cargar reservas desde localStorage
  if (!demoReservas) {
    demoReservas = [
      crearReserva({
        id: 'res-001',
        fechaInicio: '2026-05-03',
        fechaFin:    '2026-05-07',
        huespedes:   4,
        precioTotal: 400,
        nombreCliente: 'García López',
        telefono: '+34 612 345 678',
        notas: 'Check-in tardío (22:00)',
      }),
      crearReserva({
        id: 'res-002',
        fechaInicio: '2026-05-15',
        fechaFin:    '2026-05-20',
        huespedes:   2,
        precioTotal: 500,
        nombreCliente: 'Martín Ruiz',
        telefono: '+34 698 765 432',
      }),
      crearReserva({
        id: 'res-003',
        fechaInicio: '2026-05-28',
        fechaFin:    '2026-06-02',
        huespedes:   3,
        precioTotal: 600,
        nombreCliente: 'Fernández Díaz',
        telefono: '+34 654 321 987',
        notas: 'Necesitan cuna',
      }),
      crearReserva({
        id: 'res-004',
        fechaInicio: '2026-06-10',
        fechaFin:    '2026-06-15',
        huespedes:   5,
        precioTotal: 750,
        nombreCliente: 'Rodríguez Sanz',
      }),
      crearReserva({
        id: 'res-005',
        fechaInicio: '2026-06-22',
        fechaFin:    '2026-06-28',
        huespedes:   2,
        precioTotal: 680,
        nombreCliente: 'López Herrera',
        telefono: '+34 611 222 333',
      }),
      crearReserva({
        id: 'res-006',
        fechaInicio: '2026-04-18',
        fechaFin:    '2026-04-23',
        huespedes:   4,
        precioTotal: 450,
        nombreCliente: 'Navarro Gil',
      }),
    ];
    const cachedReservas = localStorage.getItem('demo_reservas');
    if (cachedReservas) {
      try {
        const parsed = JSON.parse(cachedReservas);
        demoReservas = parsed.map(r => crearReserva(r));
      } catch (e) {
        console.error('Error parseando demo_reservas de localStorage:', e);
      }
    }

    if (!demoReservas) {
      demoReservas = [
        crearReserva({
          id: 'res-001',
          fechaInicio: '2026-05-03',
          fechaFin:    '2026-05-07',
          huespedes:   4,
          precioTotal: 400,
          nombreCliente: 'García López',
          telefono: '+34 612 345 678',
          notas: 'Check-in tardío (22:00)',
        }),
        crearReserva({
          id: 'res-002',
          fechaInicio: '2026-05-15',
          fechaFin:    '2026-05-20',
          huespedes:   2,
          precioTotal: 500,
          nombreCliente: 'Martín Ruiz',
          telefono: '+34 698 765 432',
        }),
        crearReserva({
          id: 'res-003',
          fechaInicio: '2026-05-28',
          fechaFin:    '2026-06-02',
          huespedes:   3,
          precioTotal: 600,
          nombreCliente: 'Fernández Díaz',
          telefono: '+34 654 321 987',
          notas: 'Necesitan cuna',
        }),
        crearReserva({
          id: 'res-004',
          fechaInicio: '2026-06-10',
          fechaFin:    '2026-06-15',
          huespedes:   5,
          precioTotal: 750,
          nombreCliente: 'Rodríguez Sanz',
        }),
        crearReserva({
          id: 'res-005',
          fechaInicio: '2026-06-22',
          fechaFin:    '2026-06-28',
          huespedes:   2,
          precioTotal: 680,
          nombreCliente: 'López Herrera',
          telefono: '+34 611 222 333',
        }),
        crearReserva({
          id: 'res-006',
          fechaInicio: '2026-04-18',
          fechaFin:    '2026-04-23',
          huespedes:   4,
          precioTotal: 450,
          nombreCliente: 'Navarro Gil',
        }),
      ];
      localStorage.setItem('demo_reservas', JSON.stringify(demoReservas));
    }
  }

  // Intentar cargar precios desde localStorage
  if (!demoPreciosCustom) {
    demoPreciosCustom = new Map([
      ['2026-05-01', 95],
      ['2026-05-02', 95],
    ]);
    const cachedPrecios = localStorage.getItem('demo_precios_custom');
    if (cachedPrecios) {
      try {
        const parsed = JSON.parse(cachedPrecios);
        demoPreciosCustom = new Map(parsed);
      } catch (e) {
        console.error('Error parseando demo_precios_custom de localStorage:', e);
      }
    }

    if (!demoPreciosCustom) {
      demoPreciosCustom = new Map([
        ['2026-05-01', 95],
        ['2026-05-02', 95],
      ]);
      localStorage.setItem('demo_precios_custom', JSON.stringify(Array.from(demoPreciosCustom.entries())));
    }
  }

  // Hacer una copia del array para que modificaciones directas no alteren la base
  AppState.reservas = [...demoReservas];
  AppState.preciosCustom = demoPreciosCustom;
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
  DOM.toast        = $('#toast');
  DOM.ocupacion    = $('#val-ocupacion');
  DOM.ingresos     = $('#val-ingresos');
  DOM.calendarGrid = $('#calendar-grid');
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
  // Cargar datos solo cuando hace falta consultar Supabase/demo.
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
      html += `
        <div class="day-cell rented ${originClass}${todayClass}"
             style="--delay:${delay}ms"
             data-reserva-id="${d.reservaId}"
             data-origen="${etiquetaOrigenReserva(d.origen)}"
             onclick="abrirDetalle('${d.reservaId}')">
          <span class="day-number">${d.dia}</span>
          <span class="guest-badge">👥${d.huespedes}</span>
        </div>`;
    } else {
      const todayClass = d.fecha === hoyStr ? ' today' : '';
      html += `
        <div class="day-cell available${todayClass}"
             style="--delay:${delay}ms"
             onclick="abrirEditarDia('${d.fecha}', ${d.precioBase})">
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

    <button class="danger-action" type="button" onclick="confirmarEliminarReserva('${r.id}')">
      Borrar Reserva
    </button>`;

  abrirBottomSheet();
}

function quitarReservaDelEstadoLocal(reservaId) {
  AppState.reservas = AppState.reservas.filter(r => r.id !== reservaId);
  if (!AppState.usarSupabase && demoReservas) {
    demoReservas = demoReservas.filter(r => r.id !== reservaId);
    localStorage.setItem('demo_reservas', JSON.stringify(demoReservas));
  }
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
    let ok = true;
    if (AppState.usarSupabase) {
      ok = await eliminarReserva(reservaId);
    }

    if (!ok) throw new Error('No se pudo eliminar la reserva.');

    // Limpiar localmente la reserva de la memoria para una actualización visual reactiva e instantánea
    quitarReservaDelEstadoLocal(reservaId);

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

function abrirEditarDia(fecha, precioActual) {
  AppState.diaEditando = { fecha, precioActual };
  if (navigator.vibrate) navigator.vibrate(10);

  DOM.bottomSheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">Editar día</div>
    <form class="sheet-form" id="price-form">
      <div class="form-field">
        <label for="day-date">Fecha seleccionada</label>
        <input id="day-date" type="text" value="${formatearFechaCorta(fecha)}" disabled>
      </div>

      <div class="form-field">
        <label for="day-price">Precio por noche</label>
        <div class="input-with-suffix">
          <input id="day-price" type="number" min="0" step="1" inputmode="decimal" value="${precioActual}" required>
          <span>€</span>
        </div>
      </div>

      <p class="form-error" id="price-form-error" aria-live="polite"></p>

      <button class="primary-action" type="submit">Guardar precio</button>
    </form>`;

  abrirBottomSheet();
  $('#price-form').addEventListener('submit', guardarPrecioDiaSeleccionado);
  $('#day-price').focus();
}

async function guardarPrecioDiaSeleccionado(event) {
  event.preventDefault();
  if (AppState.guardando || !AppState.diaEditando) return;

  const precio = Number($('#day-price').value);
  const errorEl = $('#price-form-error');

  if (!Number.isFinite(precio) || precio < 0) {
    errorEl.textContent = 'Introduce un precio válido.';
    return;
  }

  AppState.guardando = true;
  setFormBusy('#price-form', true);

  try {
    if (AppState.usarSupabase) {
      const ok = await actualizarPrecioDia(AppState.diaEditando.fecha, precio);
      if (!ok) throw new Error('No se pudo guardar el precio.');
    }
    AppState.preciosCustom.set(AppState.diaEditando.fecha, precio);
    if (!AppState.usarSupabase && demoPreciosCustom) {
      localStorage.setItem('demo_precios_custom', JSON.stringify(Array.from(demoPreciosCustom.entries())));
    }

    cerrarDetalle();
    mostrarToast('Precio actualizado');
    await renderMes();
  } catch (err) {
    errorEl.textContent = err.message || 'No se pudo guardar el precio.';
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
          <input id="booking-guests" type="number" min="1" step="1" inputmode="numeric" value="2" required>
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
    huespedes: Number($('#booking-guests').value),
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
    let nuevaRes = null;

    if (AppState.usarSupabase) {
      nuevaRes = await guardarReserva(datos);
    } else {
      if (haySolapamientoLocal(datos.fechaInicio, datos.fechaFin)) {
        const conflicto = new Error('Las fechas seleccionadas ya están ocupadas');
        conflicto.code = '23P01';
        throw conflicto;
      }
      nuevaRes = crearReserva({
        id: `demo-${Date.now()}`,
        ...datos,
      });
      if (demoReservas) {
        demoReservas.push(nuevaRes);
        localStorage.setItem('demo_reservas', JSON.stringify(demoReservas));
      }
    }

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
  if (!Number.isFinite(datos.precioTotal) || datos.precioTotal < 0) return 'Introduce un precio total válido.';
  if (!Object.values(OrigenReserva).includes(datos.origen)) return 'Selecciona un origen valido.';
  return '';
}

function haySolapamientoLocal(fechaInicio, fechaFin) {
  return AppState.reservas.some(r => fechaInicio < r.fechaFin && fechaFin > r.fechaInicio);
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
// SINCRONIZACIÓN EN TIEMPO REAL (Supabase Realtime)
// Asegura que todos los dispositivos ven los mismos datos
// ------------------------------------------------------------

/**
 * Suscribe a cambios en tiempo real de la tabla 'reservas'.
 * Cuando otro dispositivo inserta, actualiza o elimina una reserva,
 * este dispositivo recarga automáticamente el calendario.
 */
function iniciarRealtimeSync() {
  if (!AppState.usarSupabase || !supabase) return;

  // Eliminar suscripción previa si existe
  if (AppState.realtimeChannel) {
    supabase.removeChannel(AppState.realtimeChannel);
  }

  AppState.realtimeChannel = supabase
    .channel('reservas-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reservas' },
      (payload) => {
        console.log('🔄 Cambio detectado en reservas:', payload.eventType);
        // Recargar el calendario completo desde Supabase
        recargarDatosSiNecesario(true);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'precios_disponibles' },
      (payload) => {
        console.log('🔄 Cambio detectado en precios:', payload.eventType);
        recargarDatosSiNecesario(true);
      }
    )
    .subscribe((status) => {
      console.log('📡 Realtime status:', status);
    });
}

/**
 * Recarga los datos del mes actual desde Supabase.
 * Usa un debounce para evitar múltiples recargas seguidas.
 * @param {boolean} forzar — si true, ignora el debounce
 */
async function recargarDatosSiNecesario(forzar = false) {
  const ahora = Date.now();
  const MIN_INTERVALO_MS = 2000; // Mínimo 2 segundos entre recargas

  if (!forzar && (ahora - AppState.ultimaRecarga) < MIN_INTERVALO_MS) {
    return; // Demasiado pronto, saltar
  }

  if (AppState.cargando || AppState.guardando) return;

  AppState.ultimaRecarga = ahora;
  console.log('🔄 Recargando datos del mes...');
  await renderMes();
}

/**
 * Maneja el evento visibilitychange para recargar datos
 * cuando el usuario vuelve a la app (ej: cambia de pestaña,
 * desbloquea el móvil, vuelve desde otra app).
 */
function iniciarRecargaAlVolver() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('👁️ App visible de nuevo, recargando datos...');
      recargarDatosSiNecesario();
    }
  });

  // También recargar al recuperar el foco (navegadores de escritorio)
  window.addEventListener('focus', () => {
    recargarDatosSiNecesario();
  });

  // Recarga periódica cada 60s si la app está visible
  // (por si Realtime pierde la conexión temporalmente)
  setInterval(() => {
    if (document.visibilityState === 'visible' && AppState.usarSupabase) {
      recargarDatosSiNecesario();
    }
  }, 60_000);
}

// ------------------------------------------------------------
// INICIALIZACIÓN
// ------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  cachearDOM();
  detectarModo();
  await renderMes();
  initSwipe();

  // Sincronización en tiempo real entre dispositivos
  iniciarRealtimeSync();
  iniciarRecargaAlVolver();

  // Eventos
  DOM.btnPrev.addEventListener('click', irMesAnterior);
  DOM.btnNext.addEventListener('click', irMesSiguiente);
  DOM.btnNewReservation.addEventListener('click', abrirNuevaReserva);
  DOM.overlay.addEventListener('click', cerrarDetalle);
});
