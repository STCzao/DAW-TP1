'use strict';

/* =====================================================
   A. CONSTANTS
   ===================================================== */
const STORAGE_KEY = 'turnos_app';

const ESTADOS = {
  PENDIENTE:  'Pendiente',
  CONFIRMADO: 'Confirmado',
  ATENDIDO:   'Atendido',
  AUSENTE:    'Ausente',
  CANCELADO:  'Cancelado'
};

const ESTADO_BADGE = {
  Pendiente:  'pendiente',
  Confirmado: 'confirmado',
  Atendido:   'atendido',
  Ausente:    'ausente',
  Cancelado:  'cancelado'
};

const ESTADO_ICON = {
  Pendiente:  '⏳',
  Confirmado: '✅',
  Atendido:   '🩺',
  Ausente:    '⚠️',
  Cancelado:  '❌'
};

// Transiciones de estado válidas
const TRANSICIONES = {
  Pendiente:  [ESTADOS.CONFIRMADO, ESTADOS.ATENDIDO, ESTADOS.AUSENTE, ESTADOS.CANCELADO],
  Confirmado: [ESTADOS.ATENDIDO, ESTADOS.AUSENTE, ESTADOS.CANCELADO],
  Atendido:   [],
  Ausente:    [ESTADOS.CANCELADO],
  Cancelado:  []
};

const ESPECIALIDADES_SEED = [
  'Cardiología', 'Clínica Médica', 'Dermatología', 'Ginecología',
  'Neurología', 'Oftalmología', 'Ortopedia', 'Pediatría',
  'Psicología', 'Traumatología'
];

const DOCTORES_SEED = [
  { nombre: 'Dr. Alejandro García',  especialidad: 'Cardiología' },
  { nombre: 'Dra. María López',      especialidad: 'Pediatría' },
  { nombre: 'Dr. Carlos Fernández',  especialidad: 'Clínica Médica' },
  { nombre: 'Dra. Laura Martínez',   especialidad: 'Ginecología' },
  { nombre: 'Dr. Roberto Sánchez',   especialidad: 'Neurología' },
  { nombre: 'Dra. Ana Torres',       especialidad: 'Dermatología' },
  { nombre: 'Dr. Javier Romero',     especialidad: 'Traumatología' },
  { nombre: 'Dra. Sofía Díaz',       especialidad: 'Psicología' },
  { nombre: 'Dr. Pablo Vega',        especialidad: 'Oftalmología' },
  { nombre: 'Dra. Valeria Cruz',     especialidad: 'Ortopedia' }
];

/* =====================================================
   B. UTILS
   ===================================================== */
const Utils = {
  todayISO() {
    return new Date().toISOString().split('T')[0];
  },

  formatDate(isoDate) {
    if (!isoDate) return '—';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  },

  formatRelative(isoDate) {
    if (!isoDate) return '—';
    const today = this.todayISO();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString().split('T')[0];

    if (isoDate === today) return 'Hoy';
    if (isoDate === tomorrowISO) return 'Mañana';
    if (isoDate === yesterdayISO) return 'Ayer';
    return this.formatDate(isoDate);
  },

  sanitizeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  },

  debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }
};

/* =====================================================
   C. STORAGE SERVICE
   ===================================================== */
const StorageService = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Error leyendo localStorage:', e);
    }
    return this._buildDefaultStore();
  },

  save(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      console.warn('Error escribiendo localStorage:', e);
    }
  },

  _buildDefaultStore() {
    return {
      turnos: [],
      doctores: DOCTORES_SEED,
      especialidades: ESPECIALIDADES_SEED
    };
  }
};

/* =====================================================
   D. APP STATE
   ===================================================== */
const AppState = {
  store: null,
  filters: { texto: '', estado: '', fecha: '' },

  init() {
    this.store = StorageService.load();
  },

  getTurnos()         { return this.store.turnos; },
  getDoctores()       { return this.store.doctores; },
  getEspecialidades() { return this.store.especialidades; },

  getTurnoById(id) {
    return this.store.turnos.find(t => t.id === id) || null;
  },

  getTurnosFiltrados() {
    let lista = [...this.store.turnos];
    const { texto, estado, fecha } = this.filters;

    if (texto) {
      const q = texto.toLowerCase();
      lista = lista.filter(t =>
        t.pacienteNombre.toLowerCase().includes(q) ||
        (t.pacienteDni || '').includes(q) ||
        (t.doctorNombre || '').toLowerCase().includes(q) ||
        t.especialidad.toLowerCase().includes(q) ||
        (t.motivo || '').toLowerCase().includes(q)
      );
    }

    if (estado) {
      lista = lista.filter(t => t.estado === estado);
    }

    if (fecha) {
      lista = lista.filter(t => t.fecha === fecha);
    }

    // Ordenar: por fecha+hora, cancelados al final
    lista.sort((a, b) => {
      const aCanc = a.estado === ESTADOS.CANCELADO ? 1 : 0;
      const bCanc = b.estado === ESTADOS.CANCELADO ? 1 : 0;
      if (aCanc !== bCanc) return aCanc - bCanc;
      const aKey = `${a.fecha}T${a.hora}`;
      const bKey = `${b.fecha}T${b.hora}`;
      return aKey.localeCompare(bKey);
    });

    return lista;
  },

  getStats() {
    const t = this.store.turnos;
    return {
      total:      t.length,
      pendiente:  t.filter(x => x.estado === ESTADOS.PENDIENTE).length,
      confirmado: t.filter(x => x.estado === ESTADOS.CONFIRMADO).length,
      atendido:   t.filter(x => x.estado === ESTADOS.ATENDIDO).length,
      ausente:    t.filter(x => x.estado === ESTADOS.AUSENTE).length,
      cancelado:  t.filter(x => x.estado === ESTADOS.CANCELADO).length
    };
  },

  getProximosTurnos(n = 5) {
    const hoy = Utils.todayISO();
    return this.store.turnos
      .filter(t => t.estado !== ESTADOS.CANCELADO && t.fecha >= hoy)
      .sort((a, b) => `${a.fecha}T${a.hora}`.localeCompare(`${b.fecha}T${b.hora}`))
      .slice(0, n);
  },

  agregarTurno(data) {
    const turno = {
      id: Utils.generateId(),
      pacienteNombre: data.pacienteNombre.trim(),
      pacienteDni:    (data.pacienteDni || '').trim(),
      especialidad:   data.especialidad,
      doctorNombre:   data.doctorNombre || '',
      fecha:          data.fecha,
      hora:           data.hora,
      motivo:         (data.motivo || '').trim(),
      estado:         ESTADOS.PENDIENTE,
      creadoEn:       new Date().toISOString(),
      motivoCancelacion: '',
      notas:          ''
    };
    this.store.turnos.push(turno);
    this._persist();
    return turno;
  },

  actualizarEstado(id, nuevoEstado, extra = {}) {
    const turno = this.getTurnoById(id);
    if (!turno) return false;
    const permitidos = TRANSICIONES[turno.estado] || [];
    if (!permitidos.includes(nuevoEstado)) return false;
    turno.estado = nuevoEstado;
    Object.assign(turno, extra);
    this._persist();
    return true;
  },

  eliminarTurno(id) {
    this.store.turnos = this.store.turnos.filter(t => t.id !== id);
    this._persist();
  },

  setFilter(key, value) { this.filters[key] = value; },
  clearFilters()        { this.filters = { texto: '', estado: '', fecha: '' }; },

  _persist() { StorageService.save(this.store); }
};

/* =====================================================
   E. TOAST
   ===================================================== */
const Toast = {
  show(message, type = 'info', duration = 3200) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${Utils.sanitizeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
  }
};

/* =====================================================
   F. MODAL
   ===================================================== */
const Modal = {
  _resolve: null,

  confirm(options = {}) {
    const { title = 'Confirmar', message = '¿Estás seguro?', confirmLabel = 'Confirmar', confirmClass = 'btn-danger' } = options;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = `<p>${Utils.sanitizeHTML(message)}</p>`;
    const btn = document.getElementById('modal-confirm');
    btn.textContent = confirmLabel;
    btn.className = `btn ${confirmClass}`;
    document.getElementById('modal-overlay').classList.remove('hidden');

    return new Promise(resolve => {
      this._resolve = resolve;
    });
  },

  close(result) {
    document.getElementById('modal-overlay').classList.add('hidden');
    if (this._resolve) {
      this._resolve(result);
      this._resolve = null;
    }
  },

  bindEvents() {
    document.getElementById('modal-confirm').addEventListener('click', () => this.close(true));
    document.getElementById('modal-cancel').addEventListener('click',  () => this.close(false));
    document.getElementById('modal-close').addEventListener('click',   () => this.close(false));
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) this.close(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !document.getElementById('modal-overlay').classList.contains('hidden')) {
        this.close(false);
      }
    });
  }
};

/* =====================================================
   G. HELPERS DE RENDERIZADO
   ===================================================== */
function renderBadge(estado) {
  const cls  = ESTADO_BADGE[estado] || 'pendiente';
  const icon = ESTADO_ICON[estado]  || '';
  return `<span class="badge badge-${cls}">${icon} ${Utils.sanitizeHTML(estado)}</span>`;
}

function renderStatCard(label, value, colorClass, icon) {
  return `
    <div class="stat-card ${colorClass}">
      <div class="stat-icon">${icon}</div>
      <div class="stat-info">
        <div class="stat-number">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>
  `;
}

function renderEmptyState(text, hint = '') {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">📭</div>
      <div class="empty-state-title">${Utils.sanitizeHTML(text)}</div>
      ${hint ? `<p>${Utils.sanitizeHTML(hint)}</p>` : ''}
    </div>
  `;
}

function renderAccionesTurno(turno) {
  const btns = [];
  const s = Utils.sanitizeHTML;

  if (turno.estado === ESTADOS.PENDIENTE) {
    btns.push(`<button class="btn btn-info btn-sm" data-action="confirmar" data-id="${s(turno.id)}" title="Confirmar">Confirmar</button>`);
  }
  if ([ESTADOS.PENDIENTE, ESTADOS.CONFIRMADO].includes(turno.estado)) {
    btns.push(`<button class="btn btn-success btn-sm" data-action="atender" data-id="${s(turno.id)}" title="Marcar como atendido">Atendido</button>`);
    btns.push(`<button class="btn btn-warning btn-sm" data-action="ausente" data-id="${s(turno.id)}" title="Marcar ausente">Ausente</button>`);
    btns.push(`<button class="btn btn-secondary btn-sm" data-action="cancelar" data-id="${s(turno.id)}" title="Cancelar turno">Cancelar</button>`);
  }
  if (turno.estado === ESTADOS.AUSENTE) {
    btns.push(`<button class="btn btn-secondary btn-sm" data-action="cancelar" data-id="${s(turno.id)}">Cancelar</button>`);
  }
  btns.push(`<button class="btn btn-danger btn-sm btn-icon" data-action="eliminar" data-id="${s(turno.id)}" title="Eliminar">🗑</button>`);

  return `<div class="td-actions">${btns.join('')}</div>`;
}

function renderTablaCompleta(turnos) {
  const s = Utils.sanitizeHTML;
  const rows = turnos.map(t => `
    <tr>
      <td class="td-patient">
        <strong>${s(t.pacienteNombre)}</strong>
        ${t.pacienteDni ? `<small>DNI: ${s(t.pacienteDni)}</small>` : ''}
      </td>
      <td class="td-doctor">
        <div>${s(t.especialidad)}</div>
        ${t.doctorNombre ? `<small>${s(t.doctorNombre)}</small>` : ''}
      </td>
      <td class="td-datetime">
        ${Utils.formatRelative(t.fecha)}
        <span class="time">${s(t.hora)}</span>
      </td>
      <td>${renderBadge(t.estado)}</td>
      <td class="td-motivo" title="${s(t.motivo)}">${s(t.motivo) || '—'}</td>
      <td>${renderAccionesTurno(t)}</td>
    </tr>
  `).join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Paciente</th>
          <th>Especialidad / Doctor</th>
          <th>Fecha / Hora</th>
          <th>Estado</th>
          <th>Motivo</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* =====================================================
   H. VIEWS
   ===================================================== */
const Views = {};

/* --- Dashboard --- */
Views.dashboard = {
  render() {
    const stats    = AppState.getStats();
    const proximos = AppState.getProximosTurnos(6);
    const s = Utils.sanitizeHTML;

    const miniTabla = proximos.length
      ? `<table class="mini-table">
          <tbody>
            ${proximos.map(t => `
              <tr>
                <td><strong>${s(t.pacienteNombre)}</strong></td>
                <td>${s(t.especialidad)}</td>
                <td>${Utils.formatRelative(t.fecha)} — ${s(t.hora)}</td>
                <td>${renderBadge(t.estado)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`
      : renderEmptyState('No hay turnos próximos', 'Registrá un nuevo turno para comenzar.');

    return `
      <div class="view-container">
        <div class="stat-grid">
          ${renderStatCard('Total de Turnos',  stats.total,      'primary',   '📋')}
          ${renderStatCard('Pendientes',        stats.pendiente,  'warning',   '⏳')}
          ${renderStatCard('Confirmados',       stats.confirmado, 'info',      '✅')}
          ${renderStatCard('Atendidos',         stats.atendido,   'success',   '🩺')}
          ${renderStatCard('Ausentes',          stats.ausente,    'secondary', '⚠️')}
          ${renderStatCard('Cancelados',        stats.cancelado,  'danger',    '❌')}
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Próximos Turnos</h2>
            <a data-view="lista-turnos" class="btn btn-primary btn-sm" href="#">Ver todos →</a>
          </div>
          <div class="card-body" style="padding:0;">
            ${miniTabla}
          </div>
        </div>
      </div>
    `;
  },

  bindEvents() {
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        Router.navigate(el.dataset.view);
      });
    });
  }
};

/* --- Nuevo Turno --- */
Views['nuevo-turno'] = {
  render() {
    const especialidades = AppState.getEspecialidades();
    const hoy = Utils.todayISO();

    return `
      <div class="view-container" style="max-width:700px;">
        <div class="card">
          <div class="card-header">
            <h2>Registrar Nuevo Turno</h2>
          </div>
          <div class="card-body">
            <form id="form-nuevo-turno" novalidate autocomplete="off">

              <div class="form-row">
                <div class="form-group">
                  <label for="paciente-nombre">Nombre del Paciente *</label>
                  <input type="text" id="paciente-nombre" name="pacienteNombre"
                         placeholder="Ej: Juan Pérez" required minlength="3">
                  <span class="field-error" id="err-nombre"></span>
                </div>
                <div class="form-group">
                  <label for="paciente-dni">DNI</label>
                  <input type="text" id="paciente-dni" name="pacienteDni"
                         placeholder="Ej: 32111222" pattern="[0-9]{7,8}">
                  <span class="field-error" id="err-dni"></span>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="especialidad">Especialidad *</label>
                  <select id="especialidad" name="especialidad" required>
                    <option value="">Seleccionar especialidad...</option>
                    ${especialidades.map(e => `<option value="${Utils.sanitizeHTML(e)}">${Utils.sanitizeHTML(e)}</option>`).join('')}
                  </select>
                  <span class="field-error" id="err-especialidad"></span>
                </div>
                <div class="form-group">
                  <label for="doctor">Doctor / Profesional</label>
                  <select id="doctor" name="doctorNombre">
                    <option value="">Seleccionar especialidad primero...</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="fecha">Fecha *</label>
                  <input type="date" id="fecha" name="fecha" required min="${hoy}">
                  <span class="field-error" id="err-fecha"></span>
                </div>
                <div class="form-group">
                  <label for="hora">Hora *</label>
                  <input type="time" id="hora" name="hora" required min="07:00" max="20:00">
                  <span class="field-error" id="err-hora"></span>
                </div>
              </div>

              <div class="form-group">
                <label for="motivo">Motivo de la Consulta</label>
                <textarea id="motivo" name="motivo" rows="3"
                          placeholder="Descripción breve del motivo de consulta..." maxlength="500"></textarea>
              </div>

              <div class="form-actions">
                <button type="submit" class="btn btn-primary">📅 Registrar Turno</button>
                <button type="reset"  class="btn btn-secondary">Limpiar</button>
              </div>

            </form>
          </div>
        </div>
      </div>
    `;
  },

  bindEvents() {
    const form         = document.getElementById('form-nuevo-turno');
    const selEsp       = document.getElementById('especialidad');
    const selDoc       = document.getElementById('doctor');

    // Filtrar doctores por especialidad
    selEsp.addEventListener('change', () => {
      const esp = selEsp.value;
      const doctores = AppState.getDoctores().filter(d => d.especialidad === esp);
      selDoc.innerHTML = doctores.length
        ? `<option value="">Seleccionar doctor...</option>` +
          doctores.map(d => `<option value="${Utils.sanitizeHTML(d.nombre)}">${Utils.sanitizeHTML(d.nombre)}</option>`).join('')
        : `<option value="">No hay doctores disponibles</option>`;
    });

    // Validación y envío
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!this._validate(form)) return;

      const data = Object.fromEntries(new FormData(form));
      AppState.agregarTurno(data);
      Toast.show('Turno registrado exitosamente', 'success');
      form.reset();
      selDoc.innerHTML = '<option value="">Seleccionar especialidad primero...</option>';
      this._clearErrors(form);
      Router.navigate('lista-turnos');
    });

    // Limpiar errores al resetear
    form.addEventListener('reset', () => {
      setTimeout(() => {
        this._clearErrors(form);
        selDoc.innerHTML = '<option value="">Seleccionar especialidad primero...</option>';
      }, 0);
    });
  },

  _validate(form) {
    let valid = true;
    this._clearErrors(form);

    const nombre = document.getElementById('paciente-nombre');
    const esp    = document.getElementById('especialidad');
    const fecha  = document.getElementById('fecha');
    const hora   = document.getElementById('hora');
    const dni    = document.getElementById('paciente-dni');

    if (!nombre.value.trim() || nombre.value.trim().length < 3) {
      this._setError(nombre, 'err-nombre', 'El nombre debe tener al menos 3 caracteres.');
      valid = false;
    }

    if (dni.value && !/^[0-9]{7,8}$/.test(dni.value.trim())) {
      this._setError(dni, 'err-dni', 'DNI inválido (7 u 8 dígitos numéricos).');
      valid = false;
    }

    if (!esp.value) {
      this._setError(esp, 'err-especialidad', 'Seleccioná una especialidad.');
      valid = false;
    }

    if (!fecha.value) {
      this._setError(fecha, 'err-fecha', 'Seleccioná una fecha.');
      valid = false;
    } else if (fecha.value < Utils.todayISO()) {
      this._setError(fecha, 'err-fecha', 'La fecha no puede ser en el pasado.');
      valid = false;
    }

    if (!hora.value) {
      this._setError(hora, 'err-hora', 'Seleccioná un horario.');
      valid = false;
    }

    return valid;
  },

  _setError(input, errId, msg) {
    input.classList.add('invalid');
    const el = document.getElementById(errId);
    if (el) el.textContent = msg;
  },

  _clearErrors(form) {
    form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
    form.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  }
};

/* --- Lista de Turnos --- */
Views['lista-turnos'] = {
  render() {
    const turnos  = AppState.getTurnosFiltrados();
    const filters = AppState.filters;

    const estadoOptions = Object.values(ESTADOS).map(e =>
      `<option value="${Utils.sanitizeHTML(e)}" ${filters.estado === e ? 'selected' : ''}>${Utils.sanitizeHTML(e)}</option>`
    ).join('');

    return `
      <div class="view-container">

        <div class="filter-bar card">
          <div class="filter-group">
            <input type="search" id="search-input"
                   placeholder="🔍  Buscar paciente, doctor, especialidad..."
                   value="${Utils.sanitizeHTML(filters.texto)}"
                   style="min-width:260px;">
          </div>
          <div class="filter-group">
            <select id="filter-estado">
              <option value="">Todos los estados</option>
              ${estadoOptions}
            </select>
          </div>
          <div class="filter-group">
            <input type="date" id="filter-fecha" value="${Utils.sanitizeHTML(filters.fecha)}" title="Filtrar por fecha">
          </div>
          <div class="filter-group">
            <button id="btn-clear-filters" class="btn btn-secondary btn-sm">✕ Limpiar</button>
          </div>
          <div class="filter-results">
            ${turnos.length} turno${turnos.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div class="card">
          <div class="table-wrapper">
            ${turnos.length
              ? renderTablaCompleta(turnos)
              : renderEmptyState(
                  'No se encontraron turnos',
                  filters.texto || filters.estado || filters.fecha
                    ? 'Intentá cambiar los filtros de búsqueda.'
                    : 'Registrá el primer turno desde "Nuevo Turno".'
                )
            }
          </div>
        </div>

      </div>
    `;
  },

  bindEvents() {
    const rerender = () => {
      const root = document.getElementById('app-root');
      root.innerHTML = this.render();
      this.bindEvents();
    };

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce(e => {
        AppState.setFilter('texto', e.target.value);
        rerender();
        // Restaurar foco en el input
        const el = document.getElementById('search-input');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      }, 280));
    }

    const filterEstado = document.getElementById('filter-estado');
    if (filterEstado) {
      filterEstado.addEventListener('change', e => {
        AppState.setFilter('estado', e.target.value);
        rerender();
      });
    }

    const filterFecha = document.getElementById('filter-fecha');
    if (filterFecha) {
      filterFecha.addEventListener('change', e => {
        AppState.setFilter('fecha', e.target.value);
        rerender();
      });
    }

    const btnClear = document.getElementById('btn-clear-filters');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        AppState.clearFilters();
        rerender();
      });
    }

    // Delegación de eventos en la tabla
    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) {
      tableWrapper.addEventListener('click', async e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, id } = btn.dataset;
        await this._handleAccion(action, id, rerender);
      });
    }
  },

  async _handleAccion(action, id, rerender) {
    const turno = AppState.getTurnoById(id);
    if (!turno) return;

    if (action === 'confirmar') {
      AppState.actualizarEstado(id, ESTADOS.CONFIRMADO);
      Toast.show(`Turno de ${turno.pacienteNombre} confirmado`, 'success');
      rerender();
    }

    else if (action === 'atender') {
      const ok = await Modal.confirm({
        title: 'Marcar como Atendido',
        message: `¿Confirmar que ${turno.pacienteNombre} fue atendido el ${Utils.formatDate(turno.fecha)} a las ${turno.hora}?`,
        confirmLabel: 'Sí, atendido',
        confirmClass: 'btn-success'
      });
      if (ok) {
        AppState.actualizarEstado(id, ESTADOS.ATENDIDO);
        Toast.show(`Turno marcado como atendido`, 'success');
        rerender();
      }
    }

    else if (action === 'ausente') {
      const ok = await Modal.confirm({
        title: 'Marcar como Ausente',
        message: `¿Confirmar que ${turno.pacienteNombre} no se presentó al turno del ${Utils.formatDate(turno.fecha)}?`,
        confirmLabel: 'Marcar ausente',
        confirmClass: 'btn-warning'
      });
      if (ok) {
        AppState.actualizarEstado(id, ESTADOS.AUSENTE);
        Toast.show(`Turno marcado como ausente`, 'warning');
        rerender();
      }
    }

    else if (action === 'cancelar') {
      const ok = await Modal.confirm({
        title: 'Cancelar Turno',
        message: `¿Cancelar el turno de ${turno.pacienteNombre} del ${Utils.formatDate(turno.fecha)} a las ${turno.hora}?`,
        confirmLabel: 'Sí, cancelar',
        confirmClass: 'btn-danger'
      });
      if (ok) {
        AppState.actualizarEstado(id, ESTADOS.CANCELADO, { motivoCancelacion: 'Cancelado manualmente' });
        Toast.show(`Turno de ${turno.pacienteNombre} cancelado`, 'info');
        rerender();
      }
    }

    else if (action === 'eliminar') {
      const ok = await Modal.confirm({
        title: 'Eliminar Turno',
        message: `¿Eliminar permanentemente el turno de ${turno.pacienteNombre}? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        confirmClass: 'btn-danger'
      });
      if (ok) {
        AppState.eliminarTurno(id);
        Toast.show(`Turno eliminado`, 'error');
        rerender();
      }
    }
  }
};

/* =====================================================
   I. ROUTER
   ===================================================== */
const Router = {
  currentView: 'dashboard',
  _views: {},

  register(name, view) {
    this._views[name] = view;
  },

  navigate(viewName) {
    if (!this._views[viewName]) return;
    this.currentView = viewName;

    // Actualizar nav activo
    document.querySelectorAll('#main-nav .nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === viewName);
    });

    // Actualizar título
    const titles = {
      'dashboard':    'Dashboard',
      'nuevo-turno':  'Nuevo Turno',
      'lista-turnos': 'Lista de Turnos'
    };
    document.getElementById('page-title').textContent = titles[viewName] || 'TurnoMed';

    // Renderizar
    const root = document.getElementById('app-root');
    root.innerHTML = this._views[viewName].render();
    this._views[viewName].bindEvents?.();

    // Cerrar sidebar en mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('visible');

    window.scrollTo(0, 0);
  }
};

/* =====================================================
   J. INICIALIZACIÓN
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Cargar datos
  AppState.init();

  // 2. Registrar vistas
  Router.register('dashboard',    Views.dashboard);
  Router.register('nuevo-turno',  Views['nuevo-turno']);
  Router.register('lista-turnos', Views['lista-turnos']);

  // 3. Eventos del modal (una sola vez)
  Modal.bindEvents();

  // 4. Navegación por sidebar
  document.getElementById('main-nav').addEventListener('click', e => {
    const link = e.target.closest('[data-view]');
    if (link) {
      e.preventDefault();
      Router.navigate(link.dataset.view);
    }
  });

  // 5. Toggle sidebar mobile
  const sidebarEl  = document.getElementById('sidebar');
  const overlayEl  = document.getElementById('sidebar-overlay');
  const toggleBtn  = document.getElementById('sidebar-toggle');

  toggleBtn.addEventListener('click', () => {
    sidebarEl.classList.toggle('open');
    overlayEl.classList.toggle('visible');
  });

  overlayEl.addEventListener('click', () => {
    sidebarEl.classList.remove('open');
    overlayEl.classList.remove('visible');
  });

  // 6. Reloj en tiempo real
  function updateClock() {
    const el = document.getElementById('header-clock');
    if (el) {
      const now = new Date();
      el.textContent = now.toLocaleString('es-AR', {
        weekday: 'short', day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit'
      });
    }
  }
  updateClock();
  setInterval(updateClock, 30000);

  // 7. Vista inicial
  Router.navigate('dashboard');
});
