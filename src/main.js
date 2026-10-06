import { createClient } from '@supabase/supabase-js';
import './style.css';

// -------------------------------------------------------------
// SUPABASE CLIENT SETUP (DEFENSIVE & PRODUCTION READY)
// -------------------------------------------------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  typeof supabaseUrl === 'string' &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('tu-proyecto') &&
  !supabaseKey.includes('tu-clave')
);

let supabase = null;
if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.warn('Error inicializando Supabase, usando modo local:', e);
    supabase = null;
  }
}

// -------------------------------------------------------------
// INITIAL & SEED DATA
// -------------------------------------------------------------
const initialData = {
  products: [
    { id: 'p1', name: 'Set de brochas Glow', brand: "L'Bel", category: 'Cosméticos', cost: 180, price: 290, stock: 5 },
    { id: 'p2', name: 'Organizador multiuso', brand: 'Betterware', category: 'Hogar', cost: 125, price: 210, stock: 2 },
    { id: 'p3', name: 'Crema corporal karité', brand: 'Chantal', category: 'Cuidado personal', cost: 95, price: 160, stock: 8 },
    { id: 'p4', name: 'Perfume Floral 50ml', brand: "L'Bel", category: 'Fragancias', cost: 240, price: 390, stock: 3 }
  ],
  customers: [
    { id: 'c1', name: 'María González', phone: '55 1234 9876', note: 'Vecina casa azul', balance: 180 },
    { id: 'c2', name: 'Laura Méndez', phone: '55 8421 2201', note: 'Compañera trabajo', balance: 0 },
    { id: 'c3', name: 'Patricia Ríos', phone: '55 3001 1122', note: 'Familia', balance: 390 }
  ],
  purchases: [
    { id: 'b1', purchase_date: '2026-10-01', reference: "Campaña 14 L'Bel", product_id: 'p1', product_name: 'Set de brochas Glow', quantity: 4, cost: 180, expenses: 50, total: 770 },
    { id: 'b2', purchase_date: '2026-10-03', reference: 'Pedido Betterware', product_id: 'p2', product_name: 'Organizador multiuso', quantity: 3, cost: 125, expenses: 0, total: 375 }
  ],
  sales: [
    { id: 's1', sale_date: '2026-10-02', customer_id: 'c2', customer_name: 'Laura Méndez', product_id: 'p3', product_name: 'Crema corporal karité', quantity: 2, unit_price: 160, unit_cost: 95, total: 320, profit: 130, paid: 320, status: 'Pagada', due_date: '' },
    { id: 's2', sale_date: '2026-10-04', customer_id: 'c1', customer_name: 'María González', product_id: 'p1', product_name: 'Set de brochas Glow', quantity: 1, unit_price: 290, unit_cost: 180, total: 290, profit: 110, paid: 110, status: 'Abono', due_date: '2026-10-15' },
    { id: 's3', sale_date: '2026-10-05', customer_id: 'c3', customer_name: 'Patricia Ríos', product_id: 'p4', product_name: 'Perfume Floral 50ml', quantity: 1, unit_price: 390, unit_cost: 240, total: 390, profit: 150, paid: 0, status: 'Pendiente', due_date: '2026-10-20' }
  ]
};

// Safe localStorage loading
let state = initialData;
try {
  const localData = localStorage.getItem('impulso-data');
  if (localData) {
    const parsed = JSON.parse(localData);
    if (parsed && Array.isArray(parsed.products)) {
      state = parsed;
    }
  }
} catch (e) {
  console.warn('Error al leer datos locales:', e);
}

let view = 'summary'; // 'summary' | 'products' | 'purchases' | 'sales' | 'customers'
let productSearchQuery = '';
let productBrandFilter = '';

// View preferences (Cards vs Table)
const viewModes = {
  products: 'auto', // 'auto' | 'cards' | 'table'
  sales: 'auto',
  purchases: 'auto',
  customers: 'auto'
};

function isCardsMode(viewKey) {
  const m = viewModes[viewKey];
  if (m === 'cards') return true;
  if (m === 'table') return false;
  return window.innerWidth <= 840;
}

// PWA deferred prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  renderApp();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  showToast('¡Impulso se instaló como aplicación!', '📱');
  renderApp();
});

// Network status listeners
window.addEventListener('online', () => {
  showToast('Conexión a internet restablecida', '🟢');
  if (supabase) initSupabaseData();
  renderApp();
});

window.addEventListener('offline', () => {
  showToast('Sin internet. Trabajando en modo local.', '⚠️');
  renderApp();
});

// Service Worker Registration for PWA & Offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('Impulso PWA SW listo:', reg.scope);
    }).catch(err => {
      console.warn('SW advertencia:', err);
    });
  });
}

// Helper formatters
const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(value || 0);
const today = () => new Date().toISOString().slice(0, 10);
const byId = (items, id) => (items || []).find(item => item.id === id);

const saveLocal = () => {
  try {
    localStorage.setItem('impulso-data', JSON.stringify(state));
  } catch (e) {
    console.warn('No se pudo guardar en localStorage:', e);
  }
};

// Toast notification
function showToast(message, icon = '✅') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// -------------------------------------------------------------
// SUPABASE SYNC LAYER
// -------------------------------------------------------------
async function initSupabaseData() {
  if (!supabase) return;
  try {
    const [pRes, cRes, puRes, sRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('customers').select('*').order('name', { ascending: true }),
      supabase.from('purchases').select('*').order('purchase_date', { ascending: false }),
      supabase.from('sales').select('*').order('sale_date', { ascending: false })
    ]);

    if (pRes.error || cRes.error || puRes.error || sRes.error) {
      console.warn('Tablas de Supabase no disponibles o sin permisos RLS:', pRes.error || cRes.error);
      return;
    }

    let updated = false;
    if (pRes.data && pRes.data.length > 0) {
      state.products = pRes.data.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand || '',
        category: p.category || '',
        cost: Number(p.cost) || 0,
        price: Number(p.price) || 0,
        stock: Number(p.stock) || 0
      }));
      updated = true;
    }
    if (cRes.data && cRes.data.length > 0) {
      state.customers = cRes.data.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        note: c.note || '',
        balance: Number(c.balance) || 0
      }));
      updated = true;
    }
    if (puRes.data && puRes.data.length > 0) {
      state.purchases = puRes.data.map(pu => ({
        id: pu.id,
        purchase_date: pu.purchase_date,
        reference: pu.reference || '',
        product_id: pu.product_id,
        product_name: pu.product_name || '',
        quantity: Number(pu.quantity) || 1,
        cost: Number(pu.cost) || 0,
        expenses: Number(pu.expenses) || 0,
        total: Number(pu.total) || 0
      }));
      updated = true;
    }
    if (sRes.data && sRes.data.length > 0) {
      state.sales = sRes.data.map(s => ({
        id: s.id,
        sale_date: s.sale_date,
        customer_id: s.customer_id,
        customer_name: s.customer_name || 'Venta directa',
        product_id: s.product_id,
        product_name: s.product_name || '',
        quantity: Number(s.quantity) || 1,
        unit_price: Number(s.unit_price) || 0,
        unit_cost: Number(s.unit_cost) || 0,
        total: Number(s.total) || 0,
        profit: Number(s.profit) || 0,
        paid: Number(s.paid) || 0,
        status: s.status || 'Pagada',
        due_date: s.due_date || ''
      }));
      updated = true;
    }

    if (updated) {
      saveLocal();
      renderApp();
      showToast('Datos sincronizados con Supabase', '☁️');
    }
  } catch (err) {
    console.warn('Error al conectar con Supabase, usando respaldo local:', err);
  }
}

// -------------------------------------------------------------
// APP RENDERING
// -------------------------------------------------------------
function renderApp() {
  const appEl = document.querySelector('#app');
  if (!appEl) return;

  const lowStockCount = (state.products || []).filter(p => (p.stock || 0) <= 2).length;
  const pendingDebtsCount = (state.customers || []).filter(c => (c.balance || 0) > 0).length;

  appEl.innerHTML = `
    <div class="shell">
      <!-- Barra superior móvil (Fija en pantallas <= 920px) -->
      <header class="mobile-topbar" id="mobile-topbar">
        <div class="mobile-brand" data-view="summary">
          <img src="/icons/icon.svg" alt="Impulso" class="mobile-logo" />
          <div class="mobile-brand-text">
            <span class="mobile-brand-name">Impulso</span>
            <small class="mobile-brand-subtitle">Negocio de Mamá</small>
          </div>
        </div>
        <div class="mobile-topbar-actions">
          <button type="button" class="status-chip ${supabase ? 'online' : 'offline'}" id="topbar-status-chip" title="Ver estado del sistema y respaldos">
            <span class="status-dot ${supabase ? 'online' : 'offline'}"></span>
            <span>${supabase ? 'Nube' : 'Local'}</span>
          </button>
          <button type="button" class="btn-topbar-action" data-action="add-sale" title="Registrar venta rápida">
            <span>+ Venta</span>
          </button>
        </div>
      </header>

      <!-- Sidebar Desktop (Oculto en móvil) -->
      <aside class="desktop-sidebar">
        <div class="brand">
          <small>Tu negocio en orden</small>
          <h1>Impulso</h1>
        </div>
        <nav class="desktop-nav">
          ${navButton('summary', '📊', 'Resumen')}
          ${navButton('products', '📦', 'Productos', lowStockCount)}
          ${navButton('sales', '🛍️', 'Ventas')}
          ${navButton('purchases', '🚚', 'Compras')}
          ${navButton('customers', '👥', 'Clientes', pendingDebtsCount)}
        </nav>

        ${deferredPrompt ? `
          <div class="sidebar-install-card">
            <div class="sidebar-install-head">
              <span class="sidebar-install-icon">📲</span>
              <div class="sidebar-install-text">
                <b>Instalar Impulso</b>
                <small>Úsala como aplicación directa</small>
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-primary" id="btn-install-sidebar">Instalar App</button>
          </div>
        ` : ''}

        <div class="connection ${supabase ? 'online' : 'offline'}" id="sidebar-connection-box" title="Haz clic para ver detalles y respaldos">
          <div>
            <span class="status-dot ${supabase ? 'online' : 'offline'}"></span>
            ${supabase ? 'Supabase conectado' : 'Modo local (Sin Supabase)'}
          </div>
          <small>
            ${supabase
              ? 'Tus datos están protegidos en la nube en tiempo real.'
              : 'Los datos se guardan en este navegador. Toca aquí para respaldar.'}
          </small>
        </div>
      </aside>

      <!-- Contenido Principal -->
      <main>
        ${renderContent()}
      </main>

      <!-- Botón Flotante Móvil (FAB) para registrar ventas rápidas -->
      <div class="mobile-fab-wrap">
        <button type="button" class="mobile-fab" data-action="add-sale" title="Registrar venta rápida">
          <span class="fab-icon">⚡</span>
          <span>+ Venta</span>
        </button>
      </div>

      <!-- Barra de Navegación Inferior Móvil (Fija abajo en móvil) -->
      <nav class="mobile-bottom-nav">
        <button type="button" class="nav-tab ${view === 'summary' ? 'active' : ''}" data-view="summary">
          <span class="nav-tab-icon">📊</span>
          <span class="nav-tab-label">Resumen</span>
        </button>
        <button type="button" class="nav-tab ${view === 'products' ? 'active' : ''}" data-view="products">
          <span class="nav-tab-icon">
            📦
            ${lowStockCount > 0 ? `<span class="nav-badge orange">${lowStockCount}</span>` : ''}
          </span>
          <span class="nav-tab-label">Productos</span>
        </button>
        <button type="button" class="nav-tab ${view === 'sales' ? 'active' : ''}" data-view="sales">
          <span class="nav-tab-icon">🛍️</span>
          <span class="nav-tab-label">Ventas</span>
        </button>
        <button type="button" class="nav-tab ${view === 'purchases' ? 'active' : ''}" data-view="purchases">
          <span class="nav-tab-icon">🚚</span>
          <span class="nav-tab-label">Compras</span>
        </button>
        <button type="button" class="nav-tab ${view === 'customers' ? 'active' : ''}" data-view="customers">
          <span class="nav-tab-icon">
            👥
            ${pendingDebtsCount > 0 ? `<span class="nav-badge red">${pendingDebtsCount}</span>` : ''}
          </span>
          <span class="nav-tab-label">Clientes</span>
        </button>
      </nav>
    </div>
  `;

  // Attach navigation listeners
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      view = btn.dataset.view;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      renderApp();
    });
  });

  // Attach action buttons
  document.querySelectorAll('[data-action="add-sale"]').forEach(b => b.addEventListener('click', openSaleModal));
  document.querySelectorAll('[data-action="add-purchase"]').forEach(b => b.addEventListener('click', () => openPurchaseModal()));
  document.querySelectorAll('[data-action="add-product"]').forEach(b => b.addEventListener('click', openProductModal));
  document.querySelectorAll('[data-action="add-customer"]').forEach(b => b.addEventListener('click', openCustomerModal));

  // Connection info and backup modal
  const statusChips = document.querySelectorAll('#topbar-status-chip, #sidebar-connection-box');
  statusChips.forEach(chip => {
    chip.addEventListener('click', openSyncInfoModal);
  });

  const installSidebar = document.getElementById('btn-install-sidebar');
  if (installSidebar && deferredPrompt) {
    installSidebar.addEventListener('click', async () => {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('¡Instalando Impulso!', '🎉');
      }
      deferredPrompt = null;
      renderApp();
    });
  }

  // View-specific listeners
  attachViewEvents();
}

function navButton(id, icon, label, badgeCount = 0) {
  return `
    <button type="button" class="${view === id ? 'active' : ''}" data-view="${id}">
      <span>${icon} ${label}</span>
      ${badgeCount > 0 ? `<span class="sidebar-badge ${id === 'products' ? 'orange' : ''}">${badgeCount}</span>` : ''}
    </button>
  `;
}

function renderViewSwitcher(viewKey) {
  const active = isCardsMode(viewKey) ? 'cards' : 'table';
  return `
    <div class="view-switch-toggle" data-viewkey="${viewKey}">
      <button type="button" class="view-switch-btn ${active === 'cards' ? 'active' : ''}" data-mode="cards" title="Ver en tarjetas compactas">📱 Tarjetas</button>
      <button type="button" class="view-switch-btn ${active === 'table' ? 'active' : ''}" data-mode="table" title="Ver en tabla completa">📄 Tabla</button>
    </div>
  `;
}

function renderContent() {
  switch (view) {
    case 'summary':
      return renderSummaryView();
    case 'products':
      return renderProductsView();
    case 'sales':
      return renderSalesView();
    case 'purchases':
      return renderPurchasesView();
    case 'customers':
      return renderCustomersView();
    default:
      return renderSummaryView();
  }
}

// -------------------------------------------------------------
// VIEW 1: SUMMARY / DASHBOARD
// -------------------------------------------------------------
function renderSummaryView() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthSales = (state.sales || []).filter(s => (s.sale_date || '').startsWith(currentMonth));
  const monthPurchases = (state.purchases || []).filter(p => (p.purchase_date || '').startsWith(currentMonth));

  const totalSales = monthSales.reduce((acc, s) => acc + (s.total || 0), 0);
  const totalPurchases = monthPurchases.reduce((acc, p) => acc + (p.total || 0), 0);
  const totalProfit = monthSales.reduce((acc, s) => acc + (s.profit || 0), 0);
  const totalReceivable = (state.customers || []).reduce((acc, c) => acc + (c.balance || 0), 0);
  const stockInventoryValue = (state.products || []).reduce((acc, p) => acc + ((p.cost || 0) * (p.stock || 0)), 0);

  const lowStock = (state.products || []).filter(p => (p.stock || 0) <= 2);
  const pendingDebts = (state.customers || []).filter(c => (c.balance || 0) > 0).sort((a, b) => b.balance - a.balance);
  const recentSales = (state.sales || []).slice(-5).reverse();

  return `
    <header>
      <div class="header-content">
        <span class="eyebrow">Panel de control</span>
        <h2>Tu negocio, en una mirada</h2>
        <p>Control de ventas, inversión y dinero pendiente de este mes (${new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}).</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" data-action="add-sale">🛍️ Registrar venta</button>
        <button class="btn btn-secondary" data-action="add-purchase">🚚 Registrar compra</button>
        <button class="btn btn-outline" data-action="add-product">+ Nuevo producto</button>
      </div>
    </header>

    <section class="metrics">
      <article class="metric-card">
        <div class="label">Ventas del mes <span>${monthSales.length} ventas</span></div>
        <strong>${money(totalSales)}</strong>
        <span>Ingresos cobrados y por cobrar</span>
      </article>

      <article class="metric-card">
        <div class="label">Inversión en compras <span>${monthPurchases.length} compras</span></div>
        <strong>${money(totalPurchases)}</strong>
        <span>Mercancía + envíos</span>
      </article>

      <article class="metric-card">
        <div class="label">Ganancia estimada <span>Margen ${totalSales ? Math.round(totalProfit / totalSales * 100) : 0}%</span></div>
        <strong>${money(totalProfit)}</strong>
        <span>Utilidad neta calculada</span>
      </article>

      <article class="metric-card warning">
        <div class="label">Por cobrar a clientes <span>${pendingDebts.length} con saldo</span></div>
        <strong>${money(totalReceivable)}</strong>
        <span>Dinero pendiente de cobro</span>
      </article>

      <article class="metric-card">
        <div class="label">Valor en almacén <span>${(state.products || []).reduce((acc, p) => acc + (p.stock || 0), 0)} piezas</span></div>
        <strong>${money(stockInventoryValue)}</strong>
        <span>Inventario valuado al costo</span>
      </article>
    </section>

    <div class="grid">
      <!-- Columna izquierda: Por cobrar y Alertas -->
      <div class="panel">
        <div class="panel-head">
          <h3>💰 Clientes con saldo pendiente</h3>
          <small>Atención prioritaria para cobrar</small>
        </div>
        <div class="list">
          ${pendingDebts.length > 0
            ? pendingDebts.map(c => `
              <div class="list-row">
                <div style="min-width: 0;">
                  <b>${c.name}</b>
                  <small>${c.phone ? '📱 ' + c.phone : 'Sin teléfono'} ${c.note ? '· ' + c.note : ''}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                  <span class="amount orange">${money(c.balance)}</span>
                  <button class="btn btn-sm btn-secondary" data-abono-id="${c.id}">Abonar</button>
                </div>
              </div>
            `).join('')
            : '<p class="empty">🎉 ¡Excelente! No tienes clientes con saldo pendiente.</p>'
          }
        </div>
      </div>

      <!-- Columna derecha: Inventario bajo y Últimas ventas -->
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div class="panel">
          <div class="panel-head">
            <h3>⚠️ Inventario por agotarse</h3>
            <small>Revisa antes de surtir catálogo</small>
          </div>
          <div class="list">
            ${lowStock.length > 0
              ? lowStock.map(p => `
                <div class="list-row">
                  <div style="min-width: 0;">
                    <b>${p.name}</b>
                    <small>${p.brand} · Costo compra: ${money(p.cost)}</small>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px; flex-shrink: 0;">
                    <span class="pill ${p.stock === 0 ? 'red' : 'orange'}">
                      ${p.stock === 0 ? 'Agotado (0)' : p.stock + ' disp.'}
                    </span>
                    <button class="btn btn-sm btn-outline" data-surtir-id="${p.id}">Surtir</button>
                  </div>
                </div>
              `).join('')
              : '<p class="empty">✅ Todo tu catálogo tiene buen stock.</p>'
            }
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <h3>🛍️ Últimas ventas registradas</h3>
            <small>Movimientos recientes</small>
          </div>
          <div class="list">
            ${recentSales.length > 0
              ? recentSales.map(s => `
                <div class="list-row">
                  <div style="min-width: 0;">
                    <b>${s.product_name}</b>
                    <small>${s.customer_name} · ${s.quantity} pza(s) · ${s.sale_date}</small>
                  </div>
                  <div style="text-align: right; flex-shrink: 0;">
                    <b class="amount">${money(s.total)}</b>
                    <small style="color: var(--primary); font-weight: 700;">+${money(s.profit)} ganancia</small>
                  </div>
                </div>
              `).join('')
              : '<p class="empty">Aún no hay ventas registradas.</p>'
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// VIEW 2: PRODUCTS
// -------------------------------------------------------------
function renderProductsView() {
  const brands = [...new Set((state.products || []).map(p => p.brand).filter(Boolean))];

  // Filtering
  const filtered = (state.products || []).filter(p => {
    const matchesSearch = !productSearchQuery ||
      `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(productSearchQuery.toLowerCase());
    const matchesBrand = !productBrandFilter || p.brand === productBrandFilter;
    return matchesSearch && matchesBrand;
  });

  const totalCatalogCost = (state.products || []).reduce((acc, p) => acc + (p.cost * p.stock), 0);
  const totalCatalogRetail = (state.products || []).reduce((acc, p) => acc + (p.price * p.stock), 0);
  const potentialProfit = totalCatalogRetail - totalCatalogCost;

  return `
    <header>
      <div class="header-content">
        <span class="eyebrow">Catálogo</span>
        <h2>Productos e inventario</h2>
        <p>Consulta tus costos de compra, precios de venta al público y margen de ganancia por artículo.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" data-action="add-product">+ Nuevo producto / Paquete</button>
        <button class="btn btn-secondary" data-action="add-purchase">🚚 Surtir mercancía</button>
      </div>
    </header>

    <!-- Barra de búsqueda, filtros y selector de vista -->
    <div class="toolbar">
      <div class="filters">
        <input
          id="product-search-input"
          type="text"
          placeholder="🔍 Buscar producto, marca o categoría..."
          value="${productSearchQuery}"
          style="min-width: 260px;"
        />
        <select id="product-brand-filter">
          <option value="">Todas las marcas (${brands.length})</option>
          ${brands.map(b => `<option value="${b}" ${productBrandFilter === b ? 'selected' : ''}>${b}</option>`).join('')}
        </select>
        ${(productSearchQuery || productBrandFilter) ? `<button class="btn btn-sm btn-outline" id="clear-product-filters">Limpiar filtros</button>` : ''}
      </div>
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
        ${renderViewSwitcher('products')}
        <small class="subtle"><b>${filtered.length}</b> de ${(state.products || []).length} productos</small>
      </div>
    </div>

    <!-- Contenido: Tarjetas o Tabla según preferencia / tamaño de pantalla -->
    ${isCardsMode('products')
      ? renderProductsCards(filtered)
      : `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Marca</th>
                <th>Categoría</th>
                <th>Costo de compra</th>
                <th>Precio al público</th>
                <th>Ganancia x pieza</th>
                <th>Existencia</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length > 0
                ? filtered.map(p => {
                  const unitProfit = p.price - p.cost;
                  const marginPct = p.price > 0 ? Math.round((unitProfit / p.price) * 100) : 0;
                  const isLowStock = p.stock <= 2;
                  const isOutOfStock = p.stock === 0;

                  return `
                    <tr>
                      <td><b>${p.name}</b></td>
                      <td><span class="pill blue">${p.brand || 'General'}</span></td>
                      <td>${p.category || 'Sin categoría'}</td>
                      <td>
                        <span class="cost-tag" title="Lo que te costó adquirirlo">${money(p.cost)}</span>
                      </td>
                      <td>
                        <span class="price-tag" title="Precio de venta al cliente">${money(p.price)}</span>
                      </td>
                      <td>
                        <span class="profit-badge" title="Ganancia neta por cada unidad vendida">
                          +${money(unitProfit)} <small>(${marginPct}%)</small>
                        </span>
                      </td>
                      <td>
                        <span class="pill ${isOutOfStock ? 'red' : isLowStock ? 'orange' : ''}">
                          ${isOutOfStock ? 'Agotado (0)' : `${p.stock} pza${p.stock === 1 ? '' : 's'}`}
                        </span>
                      </td>
                      <td>
                        <div class="actions-cell">
                          <button class="btn btn-sm btn-outline" data-edit-product="${p.id}" title="Editar producto">✏️ Editar</button>
                          <button class="btn btn-sm btn-danger" data-delete-product="${p.id}" title="Eliminar producto">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')
                : `<tr><td colspan="8" class="empty">No se encontraron productos con los filtros seleccionados.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      `
    }

    <div style="margin-top: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: #fffdf9; padding: 14px 20px; border-radius: 12px; border: 1px solid var(--line);">
      <small style="color: var(--muted); font-size: 13px;">
        💡 <b>Resumen de inventario:</b> <b>${(state.products || []).reduce((acc, p) => acc + p.stock, 0)}</b> piezas en existencia.
      </small>
      <div style="display: flex; gap: 16px; font-size: 13px; flex-wrap: wrap;">
        <span>Inversión: <b>${money(totalCatalogCost)}</b></span>
        <span>Venta potencial: <b>${money(totalCatalogRetail)}</b></span>
        <span style="color: var(--primary); font-weight: 700;">Ganancia potencial: +${money(potentialProfit)}</span>
      </div>
    </div>
  `;
}

function renderProductsCards(productsList) {
  if (!productsList || productsList.length === 0) {
    return `<div class="empty">No se encontraron productos con los filtros seleccionados.</div>`;
  }

  return `
    <div class="cards-grid">
      ${productsList.map(p => {
        const unitProfit = p.price - p.cost;
        const marginPct = p.price > 0 ? Math.round((unitProfit / p.price) * 100) : 0;
        const isLowStock = p.stock <= 2;
        const isOutOfStock = p.stock === 0;

        return `
          <div class="item-card">
            <div class="item-card-head">
              <div>
                <div class="item-card-pills">
                  <span class="pill blue">${p.brand || 'General'}</span>
                  ${p.category ? `<span class="pill" style="background:#efebe2; color:#5c6b63;">${p.category}</span>` : ''}
                </div>
                <h4 class="item-card-title">${p.name}</h4>
              </div>
              <span class="pill ${isOutOfStock ? 'red' : isLowStock ? 'orange' : ''}">
                ${isOutOfStock ? 'Agotado (0)' : `${p.stock} pza${p.stock === 1 ? '' : 's'}`}
              </span>
            </div>

            <div class="item-card-metrics">
              <div class="metric-mini">
                <small>Costo compra</small>
                <span class="cost-tag">${money(p.cost)}</span>
              </div>
              <div class="metric-mini">
                <small>Precio público</small>
                <span class="price-tag">${money(p.price)}</span>
              </div>
              <div class="metric-mini">
                <small>Tu ganancia</small>
                <span class="profit-badge">+${money(unitProfit)} <small>(${marginPct}%)</small></span>
              </div>
            </div>

            <div class="item-card-actions">
              <button class="btn btn-sm btn-secondary" data-surtir-id="${p.id}" title="Surtir más piezas">🚚 Surtir</button>
              <button class="btn btn-sm btn-outline" data-edit-product="${p.id}" title="Editar producto">✏️ Editar</button>
              <button class="btn btn-sm btn-danger" data-delete-product="${p.id}" title="Eliminar producto">🗑️</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// -------------------------------------------------------------
// VIEW 3: SALES
// -------------------------------------------------------------
function renderSalesView() {
  return `
    <header>
      <div class="header-content">
        <span class="eyebrow">Ingresos y ganancias</span>
        <h2>Historial de ventas</h2>
        <p>Registra las ventas a tus clientes y conoce tu ganancia real en cada entrega.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" data-action="add-sale">🛍️ + Registrar venta</button>
      </div>
    </header>

    <div class="toolbar">
      <div style="font-size: 13.5px; color: var(--muted); font-weight: 600;">
        Total de ventas registradas: <b>${(state.sales || []).length}</b>
      </div>
      <div>
        ${renderViewSwitcher('sales')}
      </div>
    </div>

    ${isCardsMode('sales')
      ? renderSalesCards(state.sales || [])
      : `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Total venta</th>
                <th>Ganancia</th>
                <th>Estado de pago</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${(state.sales || []).length > 0
                ? state.sales.slice().reverse().map(s => `
                  <tr>
                    <td><span class="date-chip">📅 ${s.sale_date}</span></td>
                    <td><b>${s.customer_name}</b></td>
                    <td>${s.product_name}</td>
                    <td><b>${s.quantity}</b> pza(s)</td>
                    <td><span class="price-tag">${money(s.total)}</span></td>
                    <td><span class="profit-badge">+${money(s.profit)}</span></td>
                    <td>
                      <span class="pill ${s.status === 'Pagada' ? '' : s.status === 'Abono' ? 'orange' : 'red'}">
                        ${s.status} ${s.paid < s.total ? `(Resta ${money(s.total - s.paid)})` : ''}
                      </span>
                    </td>
                    <td>
                      <div class="actions-cell">
                        <button class="btn btn-sm btn-danger" data-delete-sale="${s.id}" title="Eliminar registro de venta">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `).join('')
                : `<tr><td colspan="8" class="empty">Aún no hay ventas registradas. ¡Haz click en "+ Registrar venta" para comenzar!</td></tr>`
              }
            </tbody>
          </table>
        </div>
      `
    }
  `;
}

function renderSalesCards(salesList) {
  if (!salesList || salesList.length === 0) {
    return `<div class="empty">Aún no hay ventas registradas. ¡Haz click en "+ Registrar venta" para comenzar!</div>`;
  }

  return `
    <div class="cards-grid">
      ${salesList.slice().reverse().map(s => `
        <div class="item-card">
          <div class="item-card-head">
            <div>
              <span class="date-chip">📅 ${s.sale_date}</span>
              <h4 class="item-card-title" style="margin-top: 6px;">👤 ${s.customer_name}</h4>
            </div>
            <span class="pill ${s.status === 'Pagada' ? '' : s.status === 'Abono' ? 'orange' : 'red'}">
              ${s.status} ${s.paid < s.total ? `(Resta ${money(s.total - s.paid)})` : ''}
            </span>
          </div>

          <div class="item-card-body">
            <div style="font-size: 14px;">
              📦 <b>${s.product_name}</b> · <span class="pill" style="font-size: 11px; padding: 2px 7px;">${s.quantity} pza${s.quantity === 1 ? '' : 's'}</span>
            </div>
            <div class="item-card-metrics" style="grid-template-columns: 1fr 1fr;">
              <div class="metric-mini">
                <small>Total venta</small>
                <span class="price-tag">${money(s.total)}</span>
              </div>
              <div class="metric-mini">
                <small>Ganancia neta</small>
                <span class="profit-badge">+${money(s.profit)}</span>
              </div>
            </div>
          </div>

          <div class="item-card-actions">
            <button class="btn btn-sm btn-danger" data-delete-sale="${s.id}" title="Eliminar registro">🗑️ Eliminar</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// -------------------------------------------------------------
// VIEW 4: PURCHASES
// -------------------------------------------------------------
function renderPurchasesView() {
  return `
    <header>
      <div class="header-content">
        <span class="eyebrow">Abastecimiento</span>
        <h2>Historial de compras e inversión</h2>
        <p>Registra pedidos de catálogo o surtido de mercancía para mantener actualizado tu inventario.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" data-action="add-purchase">🚚 + Registrar compra</button>
      </div>
    </header>

    <div class="toolbar">
      <div style="font-size: 13.5px; color: var(--muted); font-weight: 600;">
        Total de compras registradas: <b>${(state.purchases || []).length}</b>
      </div>
      <div>
        ${renderViewSwitcher('purchases')}
      </div>
    </div>

    ${isCardsMode('purchases')
      ? renderPurchasesCards(state.purchases || [])
      : `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Referencia / Pedido</th>
                <th>Producto abastecido</th>
                <th>Cantidad</th>
                <th>Costo unitario</th>
                <th>Envío / Gastos</th>
                <th>Total compra</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${(state.purchases || []).length > 0
                ? state.purchases.slice().reverse().map(p => `
                  <tr>
                    <td><span class="date-chip">📅 ${p.purchase_date}</span></td>
                    <td><b>${p.reference || 'Sin referencia'}</b></td>
                    <td>${p.product_name}</td>
                    <td><b>${p.quantity}</b> pza(s)</td>
                    <td><span class="cost-tag">${money(p.cost)}</span></td>
                    <td>${p.expenses ? money(p.expenses) : '$0.00'}</td>
                    <td><span class="price-tag">${money(p.total)}</span></td>
                    <td>
                      <div class="actions-cell">
                        <button class="btn btn-sm btn-danger" data-delete-purchase="${p.id}" title="Eliminar registro de compra">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `).join('')
                : `<tr><td colspan="8" class="empty">Aún no hay compras registradas. Registra tus pedidos de catálogo para surtir existencias.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      `
    }
  `;
}

function renderPurchasesCards(purchasesList) {
  if (!purchasesList || purchasesList.length === 0) {
    return `<div class="empty">Aún no hay compras registradas. Registra tus pedidos de catálogo para surtir existencias.</div>`;
  }

  return `
    <div class="cards-grid">
      ${purchasesList.slice().reverse().map(p => `
        <div class="item-card">
          <div class="item-card-head">
            <div>
              <span class="date-chip">📅 ${p.purchase_date}</span>
              <h4 class="item-card-title" style="margin-top: 6px;">🚚 ${p.reference || 'Compra / Pedido'}</h4>
            </div>
            <span class="price-tag">${money(p.total)}</span>
          </div>

          <div class="item-card-body">
            <div style="font-size: 14px;">
              📦 <b>${p.product_name}</b> · <span class="pill" style="font-size: 11px; padding: 2px 7px;">${p.quantity} pza${p.quantity === 1 ? '' : 's'}</span>
            </div>
            <div class="item-card-metrics" style="grid-template-columns: 1fr 1fr;">
              <div class="metric-mini">
                <small>Costo unitario</small>
                <span class="cost-tag">${money(p.cost)}</span>
              </div>
              <div class="metric-mini">
                <small>Envío / Gastos</small>
                <span style="font-weight: 600; color: var(--muted);">${p.expenses ? money(p.expenses) : '$0.00'}</span>
              </div>
            </div>
          </div>

          <div class="item-card-actions">
            <button class="btn btn-sm btn-danger" data-delete-purchase="${p.id}" title="Eliminar registro">🗑️ Eliminar</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// -------------------------------------------------------------
// VIEW 5: CUSTOMERS
// -------------------------------------------------------------
function renderCustomersView() {
  return `
    <header>
      <div class="header-content">
        <span class="eyebrow">Relación con clientes</span>
        <h2>Clientes y cuentas por cobrar</h2>
        <p>Lleva el control de los pedidos, teléfonos y pagos pendientes de cada cliente.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" data-action="add-customer">👥 + Nuevo cliente</button>
      </div>
    </header>

    <div class="toolbar">
      <div style="font-size: 13.5px; color: var(--muted); font-weight: 600;">
        Total de clientes registrados: <b>${(state.customers || []).length}</b>
      </div>
      <div>
        ${renderViewSwitcher('customers')}
      </div>
    </div>

    ${isCardsMode('customers')
      ? renderCustomersCards(state.customers || [])
      : `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre del cliente</th>
                <th>Contacto</th>
                <th>Referencia / Notas</th>
                <th>Saldo pendiente</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${(state.customers || []).length > 0
                ? state.customers.map(c => `
                  <tr>
                    <td><b>${c.name}</b></td>
                    <td>
                      ${c.phone
                        ? `<a href="https://wa.me/52${c.phone.replace(/\D/g, '')}" target="_blank" rel="noopener" class="btn btn-sm btn-whatsapp">
                            💬 WhatsApp
                          </a>`
                        : '<span style="color: var(--muted);">Sin teléfono</span>'
                      }
                    </td>
                    <td>${c.note || '<span style="color: var(--muted);">-</span>'}</td>
                    <td>
                      <span class="amount ${c.balance > 0 ? 'orange' : 'green'}">
                        ${c.balance > 0 ? `Por cobrar: ${money(c.balance)}` : '✅ Al corriente'}
                      </span>
                    </td>
                    <td>
                      <div class="actions-cell">
                        ${c.balance > 0
                          ? `<button class="btn btn-sm btn-secondary" data-abono-id="${c.id}" title="Registrar pago o abono">💰 Abonar</button>`
                          : ''
                        }
                        <button class="btn btn-sm btn-outline" data-edit-customer="${c.id}" title="Editar cliente">✏️ Editar</button>
                        <button class="btn btn-sm btn-danger" data-delete-customer="${c.id}" title="Eliminar cliente">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `).join('')
                : `<tr><td colspan="5" class="empty">Aún no tienes clientes registrados.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      `
    }
  `;
}

function renderCustomersCards(customersList) {
  if (!customersList || customersList.length === 0) {
    return `<div class="empty">Aún no tienes clientes registrados.</div>`;
  }

  return `
    <div class="cards-grid">
      ${customersList.map(c => `
        <div class="item-card">
          <div class="item-card-head">
            <div>
              <h4 class="item-card-title" style="font-size: 17px;">👤 ${c.name}</h4>
              ${c.note ? `<p style="font-size: 12.5px; color: var(--muted); margin: 3px 0 0;">📝 ${c.note}</p>` : ''}
            </div>
            <span class="pill ${c.balance > 0 ? 'orange' : ''}">
              ${c.balance > 0 ? `Por cobrar: ${money(c.balance)}` : '✅ Al corriente'}
            </span>
          </div>

          <div class="item-card-actions" style="justify-content: space-between;">
            <div>
              ${c.phone
                ? `<a href="https://wa.me/52${c.phone.replace(/\D/g, '')}" target="_blank" rel="noopener" class="btn btn-sm btn-whatsapp">
                    💬 WhatsApp (${c.phone})
                  </a>`
                : '<span style="font-size: 12px; color: var(--muted);">Sin teléfono</span>'
              }
            </div>
            <div style="display: flex; gap: 6px;">
              ${c.balance > 0
                ? `<button class="btn btn-sm btn-secondary" data-abono-id="${c.id}" title="Registrar abono">💰 Abonar</button>`
                : ''
              }
              <button class="btn btn-sm btn-outline" data-edit-customer="${c.id}" title="Editar cliente">✏️ Editar</button>
              <button class="btn btn-sm btn-danger" data-delete-customer="${c.id}" title="Eliminar cliente">🗑️</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// -------------------------------------------------------------
// ATTACH DOM EVENTS
// -------------------------------------------------------------
function attachViewEvents() {
  // Product Search & Filter
  const searchInput = document.getElementById('product-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      productSearchQuery = e.target.value;
      renderApp();
      const updatedInput = document.getElementById('product-search-input');
      if (updatedInput) {
        updatedInput.focus();
        updatedInput.selectionStart = updatedInput.selectionEnd = updatedInput.value.length;
      }
    });
  }

  const brandFilter = document.getElementById('product-brand-filter');
  if (brandFilter) {
    brandFilter.addEventListener('change', e => {
      productBrandFilter = e.target.value;
      renderApp();
    });
  }

  const clearFilters = document.getElementById('clear-product-filters');
  if (clearFilters) {
    clearFilters.addEventListener('click', () => {
      productSearchQuery = '';
      productBrandFilter = '';
      renderApp();
    });
  }

  // View switch buttons (Cards vs Table)
  document.querySelectorAll('.view-switch-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const container = e.target.closest('.view-switch-toggle');
      if (!container) return;
      const key = container.dataset.viewkey;
      const mode = btn.dataset.mode;
      viewModes[key] = mode;
      renderApp();
    });
  });

  // Edit / Delete Product
  document.querySelectorAll('[data-edit-product]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = byId(state.products, btn.dataset.editProduct);
      if (p) openEditProductModal(p);
    });
  });

  document.querySelectorAll('[data-delete-product]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteProduct;
      const p = byId(state.products, id);
      if (!p) return;
      if (confirm(`¿Eliminar el producto "${p.name}" del catálogo?`)) {
        state.products = state.products.filter(item => item.id !== id);
        saveLocal();
        renderApp();
        showToast(`Producto "${p.name}" eliminado`);
        if (supabase) {
          try {
            await supabase.from('products').delete().eq('id', id);
          } catch (e) {
            console.warn(e);
          }
        }
      }
    });
  });

  // Edit Customer
  document.querySelectorAll('[data-edit-customer]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = byId(state.customers, btn.dataset.editCustomer);
      if (c) openEditCustomerModal(c);
    });
  });

  // Surtir producto directo desde tabla o alerta
  document.querySelectorAll('[data-surtir-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      openPurchaseModal(btn.dataset.surtirId);
    });
  });

  // Abonar cliente
  document.querySelectorAll('[data-abono-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = byId(state.customers, btn.dataset.abonoId);
      if (c) openPaymentModal(c);
    });
  });

  // Delete Customer
  document.querySelectorAll('[data-delete-customer]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteCustomer;
      const c = byId(state.customers, id);
      if (!c) return;
      if (confirm(`¿Eliminar al cliente "${c.name}"?`)) {
        state.customers = state.customers.filter(item => item.id !== id);
        saveLocal();
        renderApp();
        showToast(`Cliente "${c.name}" eliminado`);
        if (supabase) {
          try {
            await supabase.from('customers').delete().eq('id', id);
          } catch (e) {
            console.warn(e);
          }
        }
      }
    });
  });

  // Delete Sale
  document.querySelectorAll('[data-delete-sale]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteSale;
      if (confirm('¿Eliminar este registro de venta?')) {
        state.sales = state.sales.filter(item => item.id !== id);
        saveLocal();
        renderApp();
        showToast('Venta eliminada');
        if (supabase) {
          try {
            await supabase.from('sales').delete().eq('id', id);
          } catch (e) {
            console.warn(e);
          }
        }
      }
    });
  });

  // Delete Purchase
  document.querySelectorAll('[data-delete-purchase]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deletePurchase;
      if (confirm('¿Eliminar este registro de compra?')) {
        state.purchases = state.purchases.filter(item => item.id !== id);
        saveLocal();
        renderApp();
        showToast('Compra eliminada');
        if (supabase) {
          try {
            await supabase.from('purchases').delete().eq('id', id);
          } catch (e) {
            console.warn(e);
          }
        }
      }
    });
  });
}

// -------------------------------------------------------------
// GENERIC MODAL CONTROLLER (WITH BOTTOM SHEET SUPPORT ON MOBILE)
// -------------------------------------------------------------
function showModal({ icon, title, subtitle, formHtml, onOpen, onSubmit }) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-backdrop open" id="active-modal-backdrop">
      <div class="modal-card">
        <div class="modal-drag-handle"></div>
        <div class="modal-header">
          <div class="modal-title-box">
            <span class="modal-icon">${icon}</span>
            <div>
              <h3>${title}</h3>
              <p>${subtitle}</p>
            </div>
          </div>
          <button type="button" class="modal-close" id="modal-close-btn" aria-label="Cerrar">&times;</button>
        </div>
        <form id="active-modal-form">
          <div class="modal-body">
            ${formHtml}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="modal-cancel-btn">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="modal-submit-btn">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const backdrop = document.getElementById('active-modal-backdrop');
  const form = document.getElementById('active-modal-form');
  const closeBtn = document.getElementById('modal-close-btn');
  const cancelBtn = document.getElementById('modal-cancel-btn');

  const closeModal = () => {
    backdrop.classList.remove('open');
    setTimeout(() => {
      container.innerHTML = '';
    }, 220);
    document.removeEventListener('keydown', handleEsc);
  };

  const handleEsc = e => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', handleEsc);

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeModal();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const formData = new FormData(form);
    const submitBtn = document.getElementById('modal-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';

    try {
      await onSubmit(formData, form);
      closeModal();
      saveLocal();
      renderApp();
    } catch (err) {
      alert('Error: ' + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar';
    }
  });

  if (onOpen) onOpen(form);
}

// -------------------------------------------------------------
// MODAL 1: REGISTRAR VENTA
// -------------------------------------------------------------
function openSaleModal() {
  if (!state.products || state.products.length === 0) {
    alert('Primero necesitas registrar al menos un producto en el catálogo.');
    openProductModal();
    return;
  }

  const customerOptions = [
    `<option value="__direct__">🛍️ Venta al mostrador / Sin registrar</option>`,
    ...(state.customers || []).map(c => `<option value="${c.id}">${c.name} ${c.balance > 0 ? `(Debe: ${money(c.balance)})` : ''}</option>`)
  ].join('');

  const productOptions = state.products.map(p =>
    `<option value="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
      ${p.name} · Precio: ${money(p.price)} · Stock: ${p.stock}
    </option>`
  ).join('');

  const formHtml = `
    <div class="form-grid">
      <div class="form-group">
        <label>Fecha de venta</label>
        <input name="sale_date" type="date" value="${today()}" required />
      </div>

      <div class="form-group">
        <label>Cliente</label>
        <select name="customer_id" id="sale-customer-select">
          ${customerOptions}
        </select>
      </div>

      <div class="form-group full">
        <label>Producto a vender</label>
        <select name="product_id" id="sale-product-select" required>
          ${productOptions}
        </select>
      </div>

      <div class="form-group">
        <label>Cantidad (piezas)</label>
        <input name="quantity" id="sale-quantity-input" type="number" inputmode="numeric" min="1" value="1" required />
      </div>

      <div class="form-group">
        <label>Precio unitario al público</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="unit_price" id="sale-price-input" type="number" inputmode="decimal" step="0.01" min="0" required />
        </div>
      </div>

      <div class="form-group">
        <label>Pago recibido de inmediato</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="paid" id="sale-paid-input" type="number" inputmode="decimal" step="0.01" min="0" required />
        </div>
      </div>

      <div class="form-group">
        <label>Fecha límite de cobro (si debe)</label>
        <input name="due_date" id="sale-due-input" type="date" />
      </div>
    </div>

    <!-- Resumen dinámico en vivo -->
    <div class="calc-preview" id="sale-preview-card">
      <div class="calc-preview-row">
        <span>Costo de adquisición para ti:</span>
        <strong id="sale-preview-cost">$0.00</strong>
      </div>
      <div class="calc-preview-row">
        <span>Total de la venta:</span>
        <strong id="sale-preview-total">$0.00</strong>
      </div>
      <div class="calc-preview-row">
        <span>Tu ganancia neta estimada:</span>
        <strong class="green" id="sale-preview-profit">+$0.00</strong>
      </div>
      <div class="calc-preview-row highlight">
        <span id="sale-preview-status-label">Estado de la cuenta:</span>
        <strong id="sale-preview-status-val">Total cubierto</strong>
      </div>
    </div>
  `;

  showModal({
    icon: '🛍️',
    title: 'Registrar nueva venta',
    subtitle: 'Calcula tu ganancia al instante y actualiza el stock automáticamente.',
    formHtml,
    onOpen: form => {
      const prodSelect = form.querySelector('#sale-product-select');
      const qtyInput = form.querySelector('#sale-quantity-input');
      const priceInput = form.querySelector('#sale-price-input');
      const paidInput = form.querySelector('#sale-paid-input');

      const updateCalculations = () => {
        const prod = byId(state.products, prodSelect.value);
        if (!prod) return;

        const qty = Number(qtyInput.value) || 1;
        const unitPrice = Number(priceInput.value) || prod.price;
        const paid = Number(paidInput.value) || 0;
        const total = qty * unitPrice;
        const totalCost = qty * prod.cost;
        const profit = total - totalCost;
        const remaining = total - paid;

        const costEl = document.getElementById('sale-preview-cost');
        const totEl = document.getElementById('sale-preview-total');
        const profEl = document.getElementById('sale-preview-profit');
        const statLab = document.getElementById('sale-preview-status-label');
        const statVal = document.getElementById('sale-preview-status-val');

        if (costEl) costEl.textContent = money(totalCost);
        if (totEl) totEl.textContent = money(total);
        if (profEl) profEl.textContent = `+${money(profit)} (${Math.round((profit / total) * 100 || 0)}% margen)`;

        if (statVal && statLab) {
          if (remaining <= 0) {
            statLab.textContent = 'Estado del pago:';
            statVal.textContent = '✅ Pagada en su totalidad';
            statVal.className = 'green';
          } else if (paid > 0) {
            statLab.textContent = 'Pago parcial (Abono):';
            statVal.textContent = `Abonó ${money(paid)} · Debe ${money(remaining)}`;
            statVal.className = 'orange';
          } else {
            statLab.textContent = 'Venta a crédito:';
            statVal.textContent = `Debe ${money(total)}`;
            statVal.className = 'orange';
          }
        }
      };

      // Set initial values from first selected product
      const initialProd = byId(state.products, prodSelect.value);
      if (initialProd) {
        priceInput.value = initialProd.price;
        paidInput.value = initialProd.price;
      }

      prodSelect.addEventListener('change', () => {
        const p = byId(state.products, prodSelect.value);
        if (p) {
          priceInput.value = p.price;
          paidInput.value = p.price * (Number(qtyInput.value) || 1);
          updateCalculations();
        }
      });

      qtyInput.addEventListener('input', () => {
        const p = byId(state.products, prodSelect.value);
        if (p) {
          paidInput.value = (Number(priceInput.value) || p.price) * (Number(qtyInput.value) || 1);
        }
        updateCalculations();
      });

      priceInput.addEventListener('input', updateCalculations);
      paidInput.addEventListener('input', updateCalculations);

      updateCalculations();
    },
    onSubmit: async formData => {
      const productId = formData.get('product_id');
      const product = byId(state.products, productId);
      if (!product) throw new Error('Producto no encontrado');

      const qty = Number(formData.get('quantity')) || 1;
      if (product.stock < qty) {
        throw new Error(`Existencia insuficiente. Solo quedan ${product.stock} piezas en almacén.`);
      }

      const unitPrice = Number(formData.get('unit_price')) || product.price;
      const total = qty * unitPrice;
      const profit = total - (qty * product.cost);
      const paid = Number(formData.get('paid')) || 0;
      const customerId = formData.get('customer_id');

      let status = 'Pagada';
      if (paid <= 0) {
        status = 'Pendiente';
      } else if (paid < total) {
        status = 'Abono';
      }

      const customer = customerId !== '__direct__' ? byId(state.customers, customerId) : null;
      const customerName = customer ? customer.name : 'Venta directa (Mostrador)';

      // 1. Descontar inventario
      product.stock -= qty;

      // 2. Si quedó saldo a deber, sumarlo al cliente
      const pendingDebt = Math.max(0, total - paid);
      if (customer && pendingDebt > 0) {
        customer.balance = (customer.balance || 0) + pendingDebt;
      }

      // 3. Crear registro de venta
      const newSale = {
        id: crypto.randomUUID(),
        sale_date: formData.get('sale_date') || today(),
        customer_id: customer ? customer.id : null,
        customer_name: customerName,
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        unit_price: unitPrice,
        unit_cost: product.cost,
        total,
        profit,
        paid,
        status,
        due_date: formData.get('due_date') || ''
      };

      state.sales = state.sales || [];
      state.sales.push(newSale);

      showToast(`Venta de "${product.name}" registrada con éxito`, '🛍️');

      // 4. Sincronizar en Supabase si está disponible
      if (supabase) {
        try {
          const promises = [
            supabase.from('sales').insert([newSale]),
            supabase.from('products').update({ stock: product.stock }).eq('id', product.id)
          ];
          if (customer && pendingDebt > 0) {
            promises.push(supabase.from('customers').update({ balance: customer.balance }).eq('id', customer.id));
          }
          await Promise.all(promises);
        } catch (e) {
          console.warn('Error al guardar venta en Supabase:', e);
        }
      }
    }
  });
}

// -------------------------------------------------------------
// MODAL 2: REGISTRAR COMPRA / SURTIDO
// -------------------------------------------------------------
function openPurchaseModal(preselectedProductId = null) {
  if (!state.products || state.products.length === 0) {
    alert('Primero crea un producto para poder registrar compras.');
    openProductModal();
    return;
  }

  const productOptions = state.products.map(p =>
    `<option value="${p.id}" ${p.id === preselectedProductId ? 'selected' : ''}>
      ${p.name} · Costo compra: ${money(p.cost)} · Stock actual: ${p.stock}
    </option>`
  ).join('');

  const formHtml = `
    <div class="form-grid">
      <div class="form-group">
        <label>Fecha de compra</label>
        <input name="purchase_date" type="date" value="${today()}" required />
      </div>

      <div class="form-group">
        <label>Referencia / Pedido</label>
        <input name="reference" placeholder="Ej. Pedido catálogo Campaña 15" required />
      </div>

      <div class="form-group full">
        <label>Producto a abastecer</label>
        <select name="product_id" id="purchase-product-select" required>
          ${productOptions}
        </select>
      </div>

      <div class="form-group">
        <label>Cantidad que ingresa (piezas)</label>
        <input name="quantity" id="purchase-qty-input" type="number" inputmode="numeric" min="1" value="1" required />
      </div>

      <div class="form-group">
        <label>Costo unitario de compra</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="cost" id="purchase-cost-input" type="number" inputmode="decimal" step="0.01" min="0" required />
        </div>
      </div>

      <div class="form-group">
        <label>Gastos adicionales / Envío</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="expenses" id="purchase-expenses-input" type="number" inputmode="decimal" step="0.01" min="0" value="0" />
        </div>
      </div>

      <div class="form-group" style="justify-content: center;">
        <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; margin-top: 18px; text-transform: none; font-size: 13px;">
          <input type="checkbox" name="update_catalog_cost" checked style="width: auto;" />
          Actualizar costo en el catálogo
        </label>
      </div>
    </div>

    <!-- Resumen de inversión -->
    <div class="calc-preview">
      <div class="calc-preview-row">
        <span>Subtotal mercancía:</span>
        <strong id="purchase-subtotal-val">$0.00</strong>
      </div>
      <div class="calc-preview-row">
        <span>Envío / Gastos adicionales:</span>
        <strong id="purchase-expenses-val">$0.00</strong>
      </div>
      <div class="calc-preview-row highlight">
        <span>Total invertido:</span>
        <strong class="green" id="purchase-total-val">$0.00</strong>
      </div>
      <div class="calc-preview-row">
        <span>Nuevo stock resultante:</span>
        <strong id="purchase-new-stock">0 piezas</strong>
      </div>
    </div>
  `;

  showModal({
    icon: '🚚',
    title: 'Registrar compra / surtido',
    subtitle: 'Suma piezas al inventario y registra la inversión realizada.',
    formHtml,
    onOpen: form => {
      const prodSelect = form.querySelector('#purchase-product-select');
      const qtyInput = form.querySelector('#purchase-qty-input');
      const costInput = form.querySelector('#purchase-cost-input');
      const expInput = form.querySelector('#purchase-expenses-input');

      const updateCalculations = () => {
        const prod = byId(state.products, prodSelect.value);
        if (!prod) return;

        const qty = Number(qtyInput.value) || 1;
        const unitCost = Number(costInput.value) || prod.cost;
        const expenses = Number(expInput.value) || 0;
        const subtotal = qty * unitCost;
        const total = subtotal + expenses;

        const subEl = document.getElementById('purchase-subtotal-val');
        const expEl = document.getElementById('purchase-expenses-val');
        const totEl = document.getElementById('purchase-total-val');
        const stkEl = document.getElementById('purchase-new-stock');

        if (subEl) subEl.textContent = money(subtotal);
        if (expEl) expEl.textContent = money(expenses);
        if (totEl) totEl.textContent = money(total);
        if (stkEl) stkEl.textContent = `${prod.stock + qty} piezas (${prod.stock} actuales + ${qty} nuevas)`;
      };

      const initialProd = byId(state.products, prodSelect.value);
      if (initialProd) {
        costInput.value = initialProd.cost;
      }

      prodSelect.addEventListener('change', () => {
        const p = byId(state.products, prodSelect.value);
        if (p) {
          costInput.value = p.cost;
          updateCalculations();
        }
      });

      qtyInput.addEventListener('input', updateCalculations);
      costInput.addEventListener('input', updateCalculations);
      expInput.addEventListener('input', updateCalculations);

      updateCalculations();
    },
    onSubmit: async formData => {
      const productId = formData.get('product_id');
      const product = byId(state.products, productId);
      if (!product) throw new Error('Producto no encontrado');

      const quantity = Number(formData.get('quantity')) || 1;
      const unitCost = Number(formData.get('cost')) || product.cost;
      const expenses = Number(formData.get('expenses')) || 0;
      const total = (quantity * unitCost) + expenses;
      const shouldUpdateCost = formData.get('update_catalog_cost') === 'on';

      // Actualizar producto
      product.stock += quantity;
      if (shouldUpdateCost) {
        product.cost = unitCost;
      }

      const newPurchase = {
        id: crypto.randomUUID(),
        purchase_date: formData.get('purchase_date') || today(),
        reference: formData.get('reference') || 'Surtido',
        product_id: product.id,
        product_name: product.name,
        quantity,
        cost: unitCost,
        expenses,
        total
      };

      state.purchases = state.purchases || [];
      state.purchases.push(newPurchase);

      showToast(`Compra de ${quantity} pzas de "${product.name}" registrada`, '🚚');

      if (supabase) {
        try {
          await Promise.all([
            supabase.from('purchases').insert([newPurchase]),
            supabase.from('products').update({
              stock: product.stock,
              ...(shouldUpdateCost ? { cost: product.cost } : {})
            }).eq('id', product.id)
          ]);
        } catch (e) {
          console.warn('Error al guardar compra en Supabase:', e);
        }
      }
    }
  });
}

// -------------------------------------------------------------
// MODAL 3: NUEVO PRODUCTO (INDIVIDUAL O PAQUETE DE REVISTA)
// -------------------------------------------------------------
function openProductModal() {
  let mode = 'single'; // 'single' | 'package'

  const formHtml = `
    <!-- Selector de modo: Producto individual vs Paquete de revista -->
    <div class="modal-type-toggle">
      <button type="button" class="active" id="mode-single-btn">🟢 Producto individual</button>
      <button type="button" id="mode-package-btn">📦 Paquete / Set de revista</button>
    </div>

    <!-- SECCIÓN A: PRODUCTO INDIVIDUAL -->
    <div id="section-single">
      <div class="form-grid">
        <div class="form-group full">
          <label>Nombre del producto</label>
          <input name="name" id="single-name-input" placeholder="Ej. Crema facial hidratante, Set de brochas..." required />
        </div>

        <div class="form-group">
          <label>Marca</label>
          <input name="brand" id="single-brand-input" placeholder="Ej. L'Bel, Betterware, Natura, Tupperware" required />
        </div>

        <div class="form-group">
          <label>Categoría</label>
          <input name="category" id="single-category-input" placeholder="Ej. Cosméticos, Hogar, Cuidado personal" required />
        </div>

        <div class="form-group">
          <label>Costo de compra (lo que te cuesta a ti)</label>
          <div class="input-addon-wrap">
            <span class="prefix">$</span>
            <input name="cost" id="np-cost-input" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" required />
          </div>
        </div>

        <div class="form-group">
          <label>Costo de venta al público (lo que cobras)</label>
          <div class="input-addon-wrap">
            <span class="prefix">$</span>
            <input name="price" id="np-price-input" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" required />
          </div>
        </div>

        <div class="form-group full">
          <label>Existencia inicial (piezas disponibles)</label>
          <input name="stock" id="np-stock-input" type="number" inputmode="numeric" min="0" value="1" required />
        </div>
      </div>

      <div class="calc-preview">
        <div class="calc-preview-row">
          <span>Ganancia estimada por pieza:</span>
          <strong class="green" id="np-profit-val">+$0.00</strong>
        </div>
        <div class="calc-preview-row">
          <span>Margen de utilidad:</span>
          <strong id="np-margin-val">0%</strong>
        </div>
        <div class="calc-preview-row highlight">
          <span>Inversión en este lote inicial:</span>
          <strong id="np-batch-cost">$0.00</strong>
        </div>
      </div>
    </div>

    <!-- SECCIÓN B: PAQUETE DE REVISTA -->
    <div id="section-package" style="display: none;">
      <div class="form-grid">
        <div class="form-group full">
          <label>Nombre del paquete / Promoción</label>
          <input name="pkg_name" id="pkg-name-input" placeholder="Ej. Kit Bienvenida Campaña 16, Set Rutina Facial..." />
        </div>

        <div class="form-group">
          <label>Marca del paquete</label>
          <input name="pkg_brand" id="pkg-brand-input" placeholder="Ej. L'Bel, Ésika, Natura, Betterware..." />
        </div>

        <div class="form-group">
          <label>Costo total pagado por el paquete</label>
          <div class="input-addon-wrap">
            <span class="prefix">$</span>
            <input name="pkg_total_cost" id="pkg-cost-input" type="number" inputmode="decimal" step="0.01" min="0" value="0" placeholder="0.00" />
          </div>
          <small style="font-size: 11px; color: var(--muted); margin-top: 2px;">
            (Si fue un regalo o incentivo sin costo, déjalo en $0.00).
          </small>
        </div>
      </div>

      <div class="package-section">
        <div class="package-section-title">
          <span>Artículos incluidos en el paquete</span>
          <small style="font-size: 11px; font-weight: 500; text-transform: none; color: var(--muted);">
            Se guardarán individualmente en el catálogo a su precio de revista
          </small>
        </div>

        <div class="package-items-list" id="package-items-list">
          <!-- Tarjetas de artículos agregadas dinámicamente -->
        </div>

        <button type="button" class="btn btn-sm btn-outline btn-add-package-item" id="btn-add-pkg-item">
          + Agregar otro artículo al paquete
        </button>
      </div>

      <div class="calc-preview" style="margin-top: 14px;">
        <div class="calc-preview-row">
          <span>Artículos en el paquete:</span>
          <strong id="pkg-summary-items">0 pieza(s)</strong>
        </div>
        <div class="calc-preview-row">
          <span>Valor total a precio de revista:</span>
          <strong id="pkg-summary-retail">$0.00</strong>
        </div>
        <div class="calc-preview-row">
          <span>Costo total invertido:</span>
          <strong id="pkg-summary-cost">$0.00</strong>
        </div>
        <div class="calc-preview-row highlight">
          <span>Ganancia estimada del paquete:</span>
          <strong class="green" id="pkg-summary-profit">+$0.00</strong>
        </div>
      </div>
    </div>
  `;

  showModal({
    icon: '✨',
    title: 'Agregar producto o paquete',
    subtitle: 'Registra productos individuales o ingresa un set comprado en paquete.',
    formHtml,
    onOpen: form => {
      const modeSingleBtn = form.querySelector('#mode-single-btn');
      const modePackageBtn = form.querySelector('#mode-package-btn');
      const sectionSingle = form.querySelector('#section-single');
      const sectionPackage = form.querySelector('#section-package');
      const submitBtn = document.getElementById('modal-submit-btn');

      // Inputs single
      const singleName = form.querySelector('#single-name-input');
      const singleBrand = form.querySelector('#single-brand-input');
      const singleCategory = form.querySelector('#single-category-input');
      const costInput = form.querySelector('#np-cost-input');
      const priceInput = form.querySelector('#np-price-input');
      const stockInput = form.querySelector('#np-stock-input');

      // Package elements
      const pkgItemsList = form.querySelector('#package-items-list');
      const addPkgItemBtn = form.querySelector('#btn-add-pkg-item');
      const pkgCostInput = form.querySelector('#pkg-cost-input');

      // Mode switching
      modeSingleBtn.addEventListener('click', () => {
        mode = 'single';
        modeSingleBtn.classList.add('active');
        modePackageBtn.classList.remove('active');
        sectionSingle.style.display = 'block';
        sectionPackage.style.display = 'none';
        singleName.required = true;
        singleBrand.required = true;
        singleCategory.required = true;
        costInput.required = true;
        priceInput.required = true;
        if (submitBtn) submitBtn.textContent = 'Guardar producto';
      });

      modePackageBtn.addEventListener('click', () => {
        mode = 'package';
        modePackageBtn.classList.add('active');
        modeSingleBtn.classList.remove('active');
        sectionSingle.style.display = 'none';
        sectionPackage.style.display = 'block';
        singleName.required = false;
        singleBrand.required = false;
        singleCategory.required = false;
        costInput.required = false;
        priceInput.required = false;
        if (submitBtn) submitBtn.textContent = 'Guardar paquete';

        if (pkgItemsList.children.length === 0) {
          addPackageItemRow();
          addPackageItemRow();
        }
      });

      // Single calculations
      const updateSingleProfit = () => {
        const cost = Number(costInput.value) || 0;
        const price = Number(priceInput.value) || 0;
        const stock = Number(stockInput.value) || 0;
        const profit = price - cost;
        const margin = price > 0 ? Math.round((profit / price) * 100) : 0;

        const profEl = document.getElementById('np-profit-val');
        const margEl = document.getElementById('np-margin-val');
        const batEl = document.getElementById('np-batch-cost');
        if (profEl) profEl.textContent = `+${money(profit)}`;
        if (margEl) margEl.textContent = `${margin}% de margen`;
        if (batEl) batEl.textContent = `${money(cost * stock)} (${stock} piezas)`;
      };

      costInput.addEventListener('input', updateSingleProfit);
      priceInput.addEventListener('input', updateSingleProfit);
      stockInput.addEventListener('input', updateSingleProfit);

      // Package item row generator
      function addPackageItemRow() {
        const idx = pkgItemsList.children.length + 1;
        const card = document.createElement('div');
        card.className = 'package-item-card';
        card.innerHTML = `
          <div class="package-item-card-header">
            <span class="package-item-number">Artículo #${idx}</span>
            <button type="button" class="btn-remove-pkg-item" title="Quitar este artículo">&times;</button>
          </div>
          <div class="package-item-grid">
            <div class="field">
              <label>Nombre del artículo</label>
              <input class="pkg-item-name" placeholder="Ej. Crema de noche, Perfume..." required />
            </div>
            <div class="field">
              <label>Categoría</label>
              <input class="pkg-item-cat" placeholder="Cuidado facial, Fragancia..." value="Cuidado personal" />
            </div>
            <div class="field">
              <label>Cant.</label>
              <input class="pkg-item-qty" type="number" inputmode="numeric" min="1" value="1" required />
            </div>
            <div class="field">
              <label>Precio revista</label>
              <div class="input-addon-wrap">
                <span class="prefix">$</span>
                <input class="pkg-item-price" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" required />
              </div>
            </div>
          </div>
        `;

        card.querySelector('.btn-remove-pkg-item').addEventListener('click', () => {
          if (pkgItemsList.children.length > 1) {
            card.remove();
            pkgItemsList.querySelectorAll('.package-item-card').forEach((c, i) => {
              c.querySelector('.package-item-number').textContent = `Artículo #${i + 1}`;
            });
            updatePackageCalculations();
          } else {
            alert('El paquete debe contener al menos un artículo.');
          }
        });

        card.querySelectorAll('input').forEach(inp => {
          inp.addEventListener('input', updatePackageCalculations);
        });

        pkgItemsList.appendChild(card);
        updatePackageCalculations();
      }

      function updatePackageCalculations() {
        const packageCost = Number(pkgCostInput.value) || 0;
        let totalPieces = 0;
        let totalRetailValue = 0;

        pkgItemsList.querySelectorAll('.package-item-card').forEach(card => {
          const qty = Number(card.querySelector('.pkg-item-qty')?.value) || 1;
          const price = Number(card.querySelector('.pkg-item-price')?.value) || 0;
          totalPieces += qty;
          totalRetailValue += (qty * price);
        });

        const profit = totalRetailValue - packageCost;
        const marginPct = totalRetailValue > 0 ? Math.round((profit / totalRetailValue) * 100) : 0;

        const itEl = document.getElementById('pkg-summary-items');
        const retEl = document.getElementById('pkg-summary-retail');
        const costEl = document.getElementById('pkg-summary-cost');
        const profEl = document.getElementById('pkg-summary-profit');

        if (itEl) itEl.textContent = `${totalPieces} pieza(s) en ${pkgItemsList.children.length} artículo(s)`;
        if (retEl) retEl.textContent = money(totalRetailValue);
        if (costEl) costEl.textContent = money(packageCost);
        if (profEl) profEl.textContent = `+${money(profit)} (${marginPct}% de margen)`;
      }

      addPkgItemBtn.addEventListener('click', () => {
        addPackageItemRow();
      });

      pkgCostInput.addEventListener('input', updatePackageCalculations);
    },
    onSubmit: async (formData, form) => {
      if (mode === 'single') {
        const newProduct = {
          id: crypto.randomUUID(),
          name: formData.get('name').trim(),
          brand: formData.get('brand').trim() || 'General',
          category: formData.get('category').trim() || 'General',
          cost: Number(formData.get('cost')) || 0,
          price: Number(formData.get('price')) || 0,
          stock: Number(formData.get('stock')) || 0
        };

        state.products = state.products || [];
        state.products.push(newProduct);
        showToast(`Producto "${newProduct.name}" agregado al catálogo`, '✨');

        if (supabase) {
          try {
            await supabase.from('products').insert([newProduct]);
          } catch (e) {
            console.warn('Error al guardar producto en Supabase:', e);
          }
        }
      } else {
        const pkgName = (formData.get('pkg_name') || 'Paquete promocional').trim();
        const pkgBrand = (formData.get('pkg_brand') || 'General').trim();
        const pkgCost = Number(formData.get('pkg_total_cost')) || 0;

        const cards = form.querySelectorAll('.package-item-card');
        if (cards.length === 0) throw new Error('Agrega al menos un artículo al paquete.');

        const rawItems = [];
        let totalRetailSum = 0;

        cards.forEach(card => {
          const name = card.querySelector('.pkg-item-name')?.value.trim();
          const category = card.querySelector('.pkg-item-cat')?.value.trim() || 'General';
          const qty = Number(card.querySelector('.pkg-item-qty')?.value) || 1;
          const price = Number(card.querySelector('.pkg-item-price')?.value) || 0;

          if (name) {
            rawItems.push({ name, category, qty, price });
            totalRetailSum += (qty * price);
          }
        });

        if (rawItems.length === 0) throw new Error('Por favor escribe el nombre de al menos un artículo del paquete.');

        const createdProducts = [];
        rawItems.forEach(it => {
          let assignedUnitCost = 0;
          if (pkgCost > 0 && totalRetailSum > 0) {
            assignedUnitCost = Math.round(((it.price / totalRetailSum) * pkgCost) * 100) / 100;
          } else if (pkgCost > 0) {
            const totalQty = rawItems.reduce((acc, r) => acc + r.qty, 0);
            assignedUnitCost = Math.round((pkgCost / (totalQty || 1)) * 100) / 100;
          }

          const prod = {
            id: crypto.randomUUID(),
            name: it.name,
            brand: pkgBrand,
            category: it.category,
            cost: assignedUnitCost,
            price: it.price,
            stock: it.qty
          };
          createdProducts.push(prod);
          state.products.push(prod);
        });

        let newPurchase = null;
        if (pkgCost > 0) {
          newPurchase = {
            id: crypto.randomUUID(),
            purchase_date: today(),
            reference: `Paquete: ${pkgName}`,
            product_id: createdProducts[0].id,
            product_name: `${createdProducts.length} productos del paquete "${pkgName}"`,
            quantity: rawItems.reduce((acc, r) => acc + r.qty, 0),
            cost: pkgCost,
            expenses: 0,
            total: pkgCost
          };
          state.purchases = state.purchases || [];
          state.purchases.push(newPurchase);
        }

        showToast(`Paquete "${pkgName}" guardado: ${createdProducts.length} productos ingresados al catálogo.`, '📦');

        if (supabase) {
          try {
            await Promise.all([
              supabase.from('products').insert(createdProducts),
              newPurchase ? supabase.from('purchases').insert([newPurchase]) : Promise.resolve()
            ]);
          } catch (e) {
            console.warn('Error al guardar paquete en Supabase:', e);
          }
        }
      }
    }
  });
}

// -------------------------------------------------------------
// MODAL 4: EDITAR PRODUCTO
// -------------------------------------------------------------
function openEditProductModal(product) {
  const formHtml = `
    <div class="form-grid">
      <div class="form-group full">
        <label>Nombre del producto</label>
        <input name="name" value="${product.name}" required />
      </div>

      <div class="form-group">
        <label>Marca</label>
        <input name="brand" value="${product.brand}" required />
      </div>

      <div class="form-group">
        <label>Categoría</label>
        <input name="category" value="${product.category}" required />
      </div>

      <div class="form-group">
        <label>Costo de compra (tu inversión)</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="cost" id="edit-cost-input" type="number" inputmode="decimal" step="0.01" min="0" value="${product.cost}" required />
        </div>
      </div>

      <div class="form-group">
        <label>Precio de venta al público (Precio revista)</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="price" id="edit-price-input" type="number" inputmode="decimal" step="0.01" min="0" value="${product.price}" required />
        </div>
      </div>

      <div class="form-group full">
        <label>Existencia actual (piezas)</label>
        <input name="stock" type="number" inputmode="numeric" min="0" value="${product.stock}" required />
      </div>
    </div>

    <div class="calc-preview">
      <div class="calc-preview-row">
        <span>Nueva ganancia por pieza:</span>
        <strong class="green" id="edit-profit-val">+${money(product.price - product.cost)}</strong>
      </div>
      <div class="calc-preview-row">
        <span>Margen:</span>
        <strong id="edit-margin-val">${product.price ? Math.round(((product.price - product.cost) / product.price) * 100) : 0}%</strong>
      </div>
    </div>
  `;

  showModal({
    icon: '✏️',
    title: `Editar "${product.name}"`,
    subtitle: 'Modifica el costo de compra, el precio al público o la cantidad en almacén.',
    formHtml,
    onOpen: form => {
      const costInput = form.querySelector('#edit-cost-input');
      const priceInput = form.querySelector('#edit-price-input');

      const updateProfit = () => {
        const cost = Number(costInput.value) || 0;
        const price = Number(priceInput.value) || 0;
        const profit = price - cost;
        const margin = price > 0 ? Math.round((profit / price) * 100) : 0;
        const profEl = document.getElementById('edit-profit-val');
        const margEl = document.getElementById('edit-margin-val');
        if (profEl) profEl.textContent = `+${money(profit)}`;
        if (margEl) margEl.textContent = `${margin}%`;
      };

      costInput.addEventListener('input', updateProfit);
      priceInput.addEventListener('input', updateProfit);
    },
    onSubmit: async formData => {
      product.name = formData.get('name').trim();
      product.brand = formData.get('brand').trim();
      product.category = formData.get('category').trim();
      product.cost = Number(formData.get('cost')) || 0;
      product.price = Number(formData.get('price')) || 0;
      product.stock = Number(formData.get('stock')) || 0;

      showToast(`Producto "${product.name}" actualizado`);

      if (supabase) {
        try {
          await supabase.from('products').update({
            name: product.name,
            brand: product.brand,
            category: product.category,
            cost: product.cost,
            price: product.price,
            stock: product.stock
          }).eq('id', product.id);
        } catch (e) {
          console.warn('Error actualizando producto en Supabase:', e);
        }
      }
    }
  });
}

// -------------------------------------------------------------
// MODAL 5: NUEVO CLIENTE
// -------------------------------------------------------------
function openCustomerModal() {
  const formHtml = `
    <div class="form-grid">
      <div class="form-group full">
        <label>Nombre completo</label>
        <input name="name" placeholder="Ej. Doña Carmen López" required />
      </div>

      <div class="form-group">
        <label>Teléfono / WhatsApp</label>
        <input name="phone" type="tel" inputmode="tel" placeholder="Ej. 55 1234 5678" />
      </div>

      <div class="form-group">
        <label>Saldo inicial que debe (opcional)</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="balance" type="number" inputmode="decimal" step="0.01" min="0" value="0" />
        </div>
      </div>

      <div class="form-group full">
        <label>Notas / Referencia</label>
        <input name="note" placeholder="Ej. Vecina de enfrente, Amiga de la iglesia..." />
      </div>
    </div>
  `;

  showModal({
    icon: '👥',
    title: 'Nuevo cliente',
    subtitle: 'Registra los datos para contactarle y llevar el control de sus pagos.',
    formHtml,
    onSubmit: async formData => {
      const newCustomer = {
        id: crypto.randomUUID(),
        name: formData.get('name').trim(),
        phone: formData.get('phone').trim(),
        note: formData.get('note').trim(),
        balance: Number(formData.get('balance')) || 0
      };

      state.customers = state.customers || [];
      state.customers.push(newCustomer);
      showToast(`Cliente "${newCustomer.name}" registrado`, '👥');

      if (supabase) {
        try {
          await supabase.from('customers').insert([newCustomer]);
        } catch (e) {
          console.warn('Error al guardar cliente en Supabase:', e);
        }
      }
    }
  });
}

// -------------------------------------------------------------
// MODAL 6: EDITAR CLIENTE
// -------------------------------------------------------------
function openEditCustomerModal(customer) {
  const formHtml = `
    <div class="form-grid">
      <div class="form-group full">
        <label>Nombre completo</label>
        <input name="name" value="${customer.name}" required />
      </div>

      <div class="form-group">
        <label>Teléfono / WhatsApp</label>
        <input name="phone" type="tel" inputmode="tel" value="${customer.phone || ''}" placeholder="Ej. 55 1234 5678" />
      </div>

      <div class="form-group">
        <label>Saldo pendiente por cobrar</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="balance" type="number" inputmode="decimal" step="0.01" min="0" value="${customer.balance || 0}" required />
        </div>
      </div>

      <div class="form-group full">
        <label>Notas / Referencia</label>
        <input name="note" value="${customer.note || ''}" placeholder="Ej. Vecina casa azul, Colonia..." />
      </div>
    </div>
  `;

  showModal({
    icon: '✏️',
    title: `Editar a ${customer.name}`,
    subtitle: 'Modifica los datos de contacto, notas o ajusta su saldo pendiente.',
    formHtml,
    onSubmit: async formData => {
      customer.name = formData.get('name').trim();
      customer.phone = formData.get('phone').trim();
      customer.balance = Number(formData.get('balance')) || 0;
      customer.note = formData.get('note').trim();

      showToast(`Cliente "${customer.name}" actualizado`);

      if (supabase) {
        try {
          await supabase.from('customers').update({
            name: customer.name,
            phone: customer.phone,
            balance: customer.balance,
            note: customer.note
          }).eq('id', customer.id);
        } catch (e) {
          console.warn('Error actualizando cliente en Supabase:', e);
        }
      }
    }
  });
}

// -------------------------------------------------------------
// MODAL 7: REGISTRAR ABONO / PAGO
// -------------------------------------------------------------
function openPaymentModal(customer) {
  const formHtml = `
    <div class="form-grid">
      <div class="form-group full">
        <label>Cliente</label>
        <input value="${customer.name}" disabled style="background: #f4efe4; font-weight: 700;" />
      </div>

      <div class="form-group">
        <label>Fecha del abono</label>
        <input name="payment_date" type="date" value="${today()}" required />
      </div>

      <div class="form-group">
        <label>Monto a abonar</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="amount" id="abono-amount-input" type="number" inputmode="decimal" step="0.01" min="1" max="${customer.balance}" value="${customer.balance}" required />
        </div>
      </div>

      <div class="form-group full">
        <label>Nota opcional</label>
        <input name="note" placeholder="Ej. Efectivo, Transferencia, Pago en tienda..." />
      </div>
    </div>

    <!-- Resumen de saldo -->
    <div class="calc-preview">
      <div class="calc-preview-row">
        <span>Saldo anterior:</span>
        <strong class="orange">${money(customer.balance)}</strong>
      </div>
      <div class="calc-preview-row">
        <span>Abono a aplicar:</span>
        <strong class="green" id="abono-preview-amount">-${money(customer.balance)}</strong>
      </div>
      <div class="calc-preview-row highlight">
        <span>Nuevo saldo restante:</span>
        <strong id="abono-preview-remaining">$0.00</strong>
      </div>
    </div>
  `;

  showModal({
    icon: '💰',
    title: `Registrar abono de ${customer.name}`,
    subtitle: 'Descuenta el pago recibido del saldo que tiene pendiente.',
    formHtml,
    onOpen: form => {
      const amountInput = form.querySelector('#abono-amount-input');
      const previewAmount = document.getElementById('abono-preview-amount');
      const previewRemaining = document.getElementById('abono-preview-remaining');

      amountInput.addEventListener('input', () => {
        const amt = Number(amountInput.value) || 0;
        if (previewAmount) previewAmount.textContent = `-${money(amt)}`;
        const rem = Math.max(0, customer.balance - amt);
        if (previewRemaining) {
          previewRemaining.textContent = money(rem);
          previewRemaining.className = rem > 0 ? 'orange' : 'green';
        }
      });
    },
    onSubmit: async formData => {
      const amount = Number(formData.get('amount')) || 0;
      if (amount <= 0) throw new Error('El monto debe ser mayor a 0');

      customer.balance = Math.max(0, customer.balance - amount);
      showToast(`Abono de ${money(amount)} aplicado a ${customer.name}`, '💰');

      if (supabase) {
        try {
          await Promise.all([
            supabase.from('customers').update({ balance: customer.balance }).eq('id', customer.id),
            supabase.from('payments').insert([{
              id: crypto.randomUUID(),
              customer_id: customer.id,
              customer_name: customer.name,
              amount,
              payment_date: formData.get('payment_date') || today(),
              note: formData.get('note') || ''
            }])
          ]);
        } catch (e) {
          console.warn('Error al registrar abono en Supabase:', e);
        }
      }
    }
  });
}

// -------------------------------------------------------------
// MODAL 8: ESTADO DEL SISTEMA, PWA Y RESPALDOS
// -------------------------------------------------------------
function openSyncInfoModal() {
  const totalProducts = (state.products || []).length;
  const totalSales = (state.sales || []).length;
  const totalPurchases = (state.purchases || []).length;
  const totalCustomers = (state.customers || []).length;
  const isOnline = navigator.onLine;

  const formHtml = `
    <div class="sync-info-content">
      <div class="sync-status-card ${supabase ? 'online' : 'offline'}">
        <div class="sync-status-icon">${supabase ? '☁️' : '💾'}</div>
        <div>
          <h4>${supabase ? 'Conectado a la nube (Supabase)' : 'Modo local (Sin Supabase)'}</h4>
          <p>${supabase
            ? 'Tus registros se sincronizan en la nube automáticamente en tiempo real. Todos tus cambios están respaldados.'
            : 'Tus datos se guardan de forma segura en este navegador. Toda la aplicación funciona al 100% incluso sin internet.'}
          </p>
          <div class="network-indicator">
            <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
            <small>${isOnline ? 'Conexión a internet: Activa' : 'Sin conexión a internet (Operando fuera de línea)'}</small>
          </div>
        </div>
      </div>

      <div class="sync-stats-grid">
        <div class="sync-stat-item">
          <b>${totalProducts}</b>
          <small>Productos</small>
        </div>
        <div class="sync-stat-item">
          <b>${totalCustomers}</b>
          <small>Clientes</small>
        </div>
        <div class="sync-stat-item">
          <b>${totalSales}</b>
          <small>Ventas</small>
        </div>
        <div class="sync-stat-item">
          <b>${totalPurchases}</b>
          <small>Compras</small>
        </div>
      </div>

      <div class="backup-section">
        <h4 style="margin: 0 0 6px; font-size: 14px;">💾 Respaldo de seguridad de datos</h4>
        <p style="font-size: 12.5px; color: var(--muted); margin: 0 0 12px; line-height: 1.4;">
          Descarga un archivo con toda tu información para guardarlo en tu celular/computadora o transferirlo si cambias de equipo.
        </p>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary" id="btn-export-backup" style="flex: 1; justify-content: center;">
            📥 Descargar respaldo JSON
          </button>
          <label class="btn btn-outline" style="flex: 1; justify-content: center; cursor: pointer;">
            📤 Importar respaldo
            <input type="file" id="input-import-backup" accept=".json" style="display: none;" />
          </label>
        </div>
      </div>

      <div style="padding: 14px; background: #fdfaf2; border: 1px solid #ebd7af; border-radius: 12px;">
        <h4 style="margin: 0 0 6px; font-size: 14px; color: #7a4f00;">📲 ¿Cómo instalar Impulso como App?</h4>
        <div style="font-size: 12.5px; color: #5c4314; line-height: 1.5;">
          ${deferredPrompt ? `
            <p>Tu navegador permite instalar Impulso directamente con un clic:</p>
            <button type="button" class="btn btn-primary" id="btn-install-prompt-modal" style="width: 100%; justify-content: center; margin-top: 8px;">
              📲 Instalar Impulso en este dispositivo
            </button>
          ` : `
            <p><b>En Android (Chrome):</b> Toca el menú de tres puntos (⋮) arriba a la derecha y selecciona <b>"Instalar aplicación"</b> o <b>"Agregar a la pantalla principal"</b>.</p>
            <p style="margin-top: 6px;"><b>En iPhone (Safari):</b> Toca el botón <b>Compartir</b> (el cuadrado con flecha hacia arriba ⎋) y selecciona <b>"Agregar al inicio"</b> ➕.</p>
          `}
        </div>
      </div>
    </div>
  `;

  showModal({
    icon: '⚡',
    title: 'Estado del sistema & Respaldos',
    subtitle: 'Información de conectividad, almacenamiento local y copias de seguridad.',
    formHtml,
    onOpen: form => {
      const exportBtn = form.querySelector('#btn-export-backup');
      const importInput = form.querySelector('#input-import-backup');
      const installBtn = form.querySelector('#btn-install-prompt-modal');

      if (exportBtn) {
        exportBtn.addEventListener('click', exportBackupJson);
      }

      if (importInput) {
        importInput.addEventListener('change', e => {
          const file = e.target.files[0];
          if (file) importBackupJson(file);
        });
      }

      if (installBtn && deferredPrompt) {
        installBtn.addEventListener('click', async () => {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            showToast('¡Instalando Impulso!', '🎉');
          }
          deferredPrompt = null;
        });
      }
    },
    onSubmit: async () => {}
  });
}

function exportBackupJson() {
  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    app: 'Impulso',
    data: state
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `impulso-respaldo-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Respaldo descargado exitosamente', '📥');
}

function importBackupJson(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      const data = parsed.data || parsed;
      if (data && Array.isArray(data.products) && Array.isArray(data.customers)) {
        if (confirm(`¿Deseas restaurar este respaldo con ${data.products.length} productos y ${data.customers.length} clientes? Se actualizarán los datos actuales.`)) {
          state = data;
          saveLocal();
          renderApp();
          showToast('Respaldo restaurado correctamente', '✅');
          const backdrop = document.getElementById('active-modal-backdrop');
          if (backdrop) backdrop.click();
        }
      } else {
        alert('El archivo seleccionado no tiene el formato de respaldo de Impulso.');
      }
    } catch (err) {
      alert('Error al leer el archivo de respaldo: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
renderApp();
initSupabaseData();
