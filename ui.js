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
  
  // Rango de selección táctil y estancia mínima
  seleccionRango: { inicio: null, fin: null },
  minNoches: 2,
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
// DETECCIÓN DE MODO: Supabase vs Demo
// ------------------------------------------------------------
function detectarModo() {
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
      const [ { reservas, precios }, minNoches ] = await Promise.all([
        obtenerDatosMes(AppState.mes, AppState.anio),
        obtenerMinNoches()
      ]);
      AppState.reservas      = reservas;
      AppState.preciosCustom = precios;
      AppState.minNoches     = minNoches;
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
  // Intentar cargar reservas desde localStorage
  if (!demoReservas) {
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

  // Intentar cargar estancia mínima de localStorage
  const cachedMinNoches = localStorage.getItem('demo_min_noches');
  AppState.minNoches = cachedMinNoches ? parseInt(cachedMinNoches, 10) : 2;

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
  
  // Nuevos DOM Cached Elements
  DOM.btnMinNights = $('#btn-min-nights');
  DOM.valMinNights = $('#val-min-nights');
  DOM.selectionHelper = $('#selection-helper');
  DOM.selectionHelperText = $('#selection-helper-text');
  DOM.btnCancelSelection = $('#btn-cancel-selection');
}

// ------------------------------------------------------------
// RENDERIZADO
// ------------------------------------------------------------

/**
 * Actualiza toda la vista del mes actual.
 * @param {'left'|'right'|null} direction — dirección de la animación
 */
async function renderMes(direction = null, { recargarDatos = true } = {}) {
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
  
  // Mostrar Estancia Mínima
  if (DOM.valMinNights) {
    DOM.valMinNights.textContent = AppState.minNoches + (AppState.minNoches === 1 ? ' noche' : ' noches');
  }

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

  // Rango de fechas seleccionado en la UI
  const selInicio = AppState.seleccionRango.inicio;
  const selFin = AppState.seleccionRango.fin;

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
             onclick="manejarClickDiaRenta('${d.reservaId}')">
          <span class="day-number">${d.dia}</span>
          <span class="guest-badge">👥${d.huespedes}</span>
        </div>`;
    } else {
      const todayClass = d.fecha === hoyStr ? ' today' : '';
      
      // Clasificación de rango
      let rangeClass = '';
      if (selInicio && d.fecha === selInicio) {
        rangeClass = ' selection-start';
      } else if (selFin && d.fecha === selFin) {
        rangeClass = ' selection-end';
      } else if (selInicio && selFin) {
        const f = d.fecha;
        const minF = selInicio < selFin ? selInicio : selFin;
        const maxF = selInicio < selFin ? selFin : selInicio;
        if (f > minF && f < maxF) {
          rangeClass = ' in-range';
        }
      }

      html += `
        <div class="day-cell available${todayClass}${rangeClass}"
             style="--delay:${delay}ms"
             onclick="manejarClickDiaDisponible('${d.fecha}', ${d.precioBase})">
          <span class="day-number">${d.dia}</span>
          <span class="day-price">${d.precioBase}€</span>
        </div>`;
    }
    idx++;
  }

  DOM.calendarGrid.innerHTML = html;
}

// ------------------------------------------------------------
// INTERACCIÓN DE DÍAS Y SELECCIÓN DE RANGO
// ------------------------------------------------------------

function manejarClickDiaRenta(reservaId) {
  // Cancelar selección en curso si la hay
  if (AppState.seleccionRango.inicio) {
    cancelarSeleccionRango();
  }
  abrirDetalle(reservaId);
}

function manejarClickDiaDisponible(fecha, precioBase) {
  const sel = AppState.seleccionRango;

  // Vibración suave
  if (navigator.vibrate) navigator.vibrate(10);

  if (!sel.inicio) {
    // Primer click: Marcar inicio
    sel.inicio = fecha;
    sel.fin = null;

    if (DOM.selectionHelper) {
      DOM.selectionHelperText.textContent = `Inicio: ${formatearFechaCorta(fecha)}. Selecciona el día final...`;
      DOM.selectionHelper.classList.add('active');
    }

    renderCeldas(AppState.mesActual.dias);
  } else {
    // Segundo click: Mismo día → abre un solo día. Otro día → abre rango
    if (sel.inicio === fecha) {
      const precioActual = AppState.preciosCustom.get(fecha) ?? precioBase;
      cancelarSeleccionRango();
      abrirEditarDia(fecha, precioActual);
    } else {
      sel.fin = fecha;

      // Ordenar cronológicamente
      if (sel.inicio > sel.fin) {
        const temp = sel.inicio;
        sel.inicio = sel.fin;
        sel.fin = temp;
      }

      renderCeldas(AppState.mesActual.dias);

      if (DOM.selectionHelper) {
        DOM.selectionHelper.classList.remove('active');
      }

      // Abrir Bottom Sheet
      setTimeout(() => {
        abrirEditarRango(sel.inicio, sel.fin);
      }, 150);
    }
  }
}

function cancelarSeleccionRango() {
  AppState.seleccionRango.inicio = null;
  AppState.seleccionRango.fin = null;
  if (DOM.selectionHelper) {
    DOM.selectionHelper.classList.remove('active');
  }
  if (AppState.mesActual) {
    renderCeldas(AppState.mesActual.dias);
  }
}

// ------------------------------------------------------------
// BOTTOM SHEET — Edición y Detalles
// ------------------------------------------------------------

function abrirBottomSheet() {
  DOM.overlay.classList.add('active');
  DOM.bottomSheet.classList.add('active');
}

function cerrarDetalle() {
  DOM.overlay.classList.remove('active');
  DOM.bottomSheet.classList.remove('active');
  AppState.diaEditando = null;
  cancelarSeleccionRango();
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

    quitarReservaDelEstadoLocal(reservaId);
    cerrarDetalle();
    mostrarToast('Reserva eliminada correctamente');
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

// ------------------------------------------------------------
// EDICIÓN DE PRECIO (DÍA ÚNICO)
// ------------------------------------------------------------

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
    await renderMes({ recargarDatos: false });
  } catch (err) {
    errorEl.textContent = err.message || 'No se pudo guardar el precio.';
  } finally {
    AppState.guardando = false;
    setFormBusy('#price-form', false);
  }
}

// ------------------------------------------------------------
// EDICIÓN DE PRECIO (RANGO DE DÍAS)
// ------------------------------------------------------------

function abrirEditarRango(inicio, fin) {
  if (navigator.vibrate) navigator.vibrate(12);

  // Calcular total de días en el rango
  const dInicio = new Date(inicio + 'T00:00:00');
  const dFin = new Date(fin + 'T00:00:00');
  const totalDias = Math.round((dFin - dInicio) / 86_400_000) + 1;

  DOM.bottomSheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">Editar precios en rango</div>
    <form class="sheet-form" id="range-price-form">
      <div class="form-field">
        <label for="range-dates">Rango seleccionado</label>
        <input id="range-dates" type="text" value="${formatearFechaCorta(inicio)} → ${formatearFechaCorta(fin)} (${totalDias} días)" disabled>
      </div>

      <div class="form-field">
        <label for="range-price">Precio por noche para el rango</label>
        <div class="input-with-suffix">
          <input id="range-price" type="number" min="0" step="1" inputmode="decimal" placeholder="Ej: 95" required>
          <span>€</span>
        </div>
      </div>

      <p class="form-error" id="range-price-form-error" aria-live="polite"></p>

      <button class="primary-action" type="submit">Guardar precios en rango</button>
    </form>`;

  abrirBottomSheet();
  $('#range-price-form').addEventListener('submit', (e) => guardarPreciosRangoSeleccionado(e, inicio, fin));
  $('#range-price').focus();
}

async function guardarPreciosRangoSeleccionado(event, inicio, fin) {
  event.preventDefault();
  if (AppState.guardando) return;

  const precio = Number($('#range-price').value);
  const errorEl = $('#range-price-form-error');

  if (!Number.isFinite(precio) || precio < 0) {
    errorEl.textContent = 'Introduce un precio válido.';
    return;
  }

  AppState.guardando = true;
  setFormBusy('#range-price-form', true);

  try {
    if (AppState.usarSupabase) {
      const ok = await actualizarPreciosRango(inicio, fin, precio);
      if (!ok) throw new Error('No se pudieron guardar los precios del rango.');
    }

    // Actualizar en el estado local de memoria
    const dInicio = new Date(inicio + 'T00:00:00');
    const dFin = new Date(fin + 'T00:00:00');
    const actual = new Date(dInicio);

    while (actual <= dFin) {
      const anio = actual.getFullYear();
      const mes = String(actual.getMonth() + 1).padStart(2, '0');
      const dia = String(actual.getDate()).padStart(2, '0');
      const fechaStr = `${anio}-${mes}-${dia}`;

      AppState.preciosCustom.set(fechaStr, precio);
      actual.setDate(actual.getDate() + 1);
    }

    if (!AppState.usarSupabase && demoPreciosCustom) {
      localStorage.setItem('demo_precios_custom', JSON.stringify(Array.from(demoPreciosCustom.entries())));
    }

    cancelarSeleccionRango();
    cerrarDetalle();
    mostrarToast('Precios actualizados en rango');
    await renderMes({ recargarDatos: false });
  } catch (err) {
    errorEl.textContent = err.message || 'No se pudieron guardar los precios.';
  } finally {
    AppState.guardando = false;
    setFormBusy('#range-price-form', false);
  }
}

// ------------------------------------------------------------
// CONFIGURACIÓN DE ESTANCIA MÍNIMA
// ------------------------------------------------------------

function abrirEditarMinNoches() {
  if (navigator.vibrate) navigator.vibrate(10);

  DOM.bottomSheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">Configurar Estancia Mínima</div>
    <form class="sheet-form" id="min-nights-form">
      <div class="form-field">
        <label for="min-nights-input">Noches mínimas por reserva</label>
        <input id="min-nights-input" type="number" min="1" max="30" step="1" inputmode="numeric" value="${AppState.minNoches}" required>
      </div>

      <p class="form-error" id="min-nights-form-error" aria-live="polite"></p>

      <button class="primary-action" type="submit">Guardar configuración</button>
    </form>`;

  abrirBottomSheet();
  $('#min-nights-form').addEventListener('submit', guardarMinNochesSeleccionado);
  $('#min-nights-input').focus();
}

async function guardarMinNochesSeleccionado(event) {
  event.preventDefault();
  if (AppState.guardando) return;

  const noches = parseInt($('#min-nights-input').value, 10);
  const errorEl = $('#min-nights-form-error');

  if (isNaN(noches) || noches < 1 || noches > 30) {
    errorEl.textContent = 'Introduce un número de noches válido (entre 1 y 30).';
    return;
  }

  AppState.guardando = true;
  setFormBusy('#min-nights-form', true);

  try {
    let ok = true;
    if (AppState.usarSupabase) {
      ok = await actualizarMinNoches(noches);
    }

    if (!ok) throw new Error('No se pudo guardar la configuración.');

    AppState.minNoches = noches;
    localStorage.setItem('demo_min_noches', noches.toString());

    cerrarDetalle();
    mostrarToast(`Estancia mínima: ${noches} noches`);
    await renderMes({ recargarDatos: false });
  } catch (err) {
    errorEl.textContent = err.message || 'No se pudo guardar la configuración.';
  } finally {
    AppState.guardando = false;
    setFormBusy('#min-nights-form', false);
  }
}

// ------------------------------------------------------------
// CREACIÓN DE NUEVA RESERVA
// ------------------------------------------------------------

function abrirNuevaReserva() {
  if (navigator.vibrate) navigator.vibrate(10);
  const ultimoDiaMes = new Date(AppState.anio, AppState.mes, 0).getDate();
  const diaSugerido = Math.min(new Date().getDate(), ultimoDiaMes);
  const fechaSugerida = formatoFecha(AppState.anio, AppState.mes, diaSugerido);

  DOM.bottomSheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">Nueva reserva</div>
    <div class="indicator-min-noches">🌙 Estancia mínima: ${AppState.minNoches} noches</div>
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

  // Sugerir la salida sumando el mínimo de noches configurado
  const minEnd = sumarDias(start.value, AppState.minNoches);
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
  
  // Validar mínimo de noches
  const inicio = new Date(datos.fechaInicio + 'T00:00:00');
  const fin = new Date(datos.fechaFin + 'T00:00:00');
  const noches = Math.round((fin - inicio) / 86_400_000);
  if (noches < AppState.minNoches) {
    return `Estancia mínima de ${AppState.minNoches} noches. Has seleccionado ${noches} ${noches === 1 ? 'noche' : 'noches'}.`;
  }

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
// ------------------------------------------------------------

function iniciarRealtimeSync() {
  if (!AppState.usarSupabase || !supabase) return;

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
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'configuracion' },
      (payload) => {
        console.log('🔄 Cambio detectado en configuracion:', payload.eventType);
        recargarDatosSiNecesario(true);
      }
    )
    .subscribe((status) => {
      console.log('📡 Realtime status:', status);
    });
}

async function recargarDatosSiNecesario(forzar = false) {
  const ahora = Date.now();
  const MIN_INTERVALO_MS = 2000;

  if (!forzar && (ahora - AppState.ultimaRecarga) < MIN_INTERVALO_MS) {
    return;
  }

  if (AppState.cargando || AppState.guardando) return;

  AppState.ultimaRecarga = ahora;
  console.log('🔄 Recargando datos del mes...');
  await renderMes();
}

function iniciarRecargaAlVolver() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('👁️ App visible de nuevo, recargando datos...');
      recargarDatosSiNecesario();
    }
  });

  window.addEventListener('focus', () => {
    recargarDatosSiNecesario();
  });

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

  iniciarRealtimeSync();
  iniciarRecargaAlVolver();

  // Eventos
  DOM.btnPrev.addEventListener('click', irMesAnterior);
  DOM.btnNext.addEventListener('click', irMesSiguiente);
  DOM.btnNewReservation.addEventListener('click', abrirNuevaReserva);
  DOM.overlay.addEventListener('click', cerrarDetalle);
  
  // Eventos nuevos para Rango y Estancia Mínima
  DOM.btnMinNights.addEventListener('click', abrirEditarMinNoches);
  DOM.btnCancelSelection.addEventListener('click', (e) => {
    e.stopPropagation();
    cancelarSeleccionRango();
  });
});
