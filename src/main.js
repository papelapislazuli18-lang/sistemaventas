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
    { id: 'b1', purchase_date: '2026-10-01', reference: 'Campaña 14 L\'Bel', product_id: 'p1', product_name: 'Set de brochas Glow', quantity: 4, cost: 180, expenses: 50, total: 770 },
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

  appEl.innerHTML = `
    <div class="shell">
      <aside>
        <div class="brand">
          <small>Tu negocio en orden</small>
          <h1>Impulso</h1>
        </div>
        <nav>
          ${navButton('summary', '📊 Resumen')}
          ${navButton('products', '📦 Productos')}
          ${navButton('sales', '🛍️ Ventas')}
          ${navButton('purchases', '🚚 Compras')}
          ${navButton('customers', '👥 Clientes')}
        </nav>
        <div class="connection ${supabase ? 'online' : 'offline'}">
          <div>
            <span class="status-dot ${supabase ? 'online' : 'offline'}"></span>
            ${supabase ? 'Supabase conectado' : 'Modo local (Sin Supabase)'}
          </div>
          <small>
            ${supabase
              ? 'Tus datos están protegidos en la nube en tiempo real.'
              : 'Los datos se guardan en este navegador. Para sincronizar en la nube, configura Supabase.'}
          </small>
        </div>
      </aside>
      <main>
        ${renderContent()}
      </main>
    </div>
  `;

  // Attach navigation listeners
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      view = btn.dataset.view;
      renderApp();
    });
  });

  // Attach action buttons
  document.querySelectorAll('[data-action="add-sale"]').forEach(b => b.addEventListener('click', openSaleModal));
  document.querySelectorAll('[data-action="add-purchase"]').forEach(b => b.addEventListener('click', () => openPurchaseModal()));
  document.querySelectorAll('[data-action="add-product"]').forEach(b => b.addEventListener('click', openProductModal));
  document.querySelectorAll('[data-action="add-customer"]').forEach(b => b.addEventListener('click', openCustomerModal));

  // View-specific listeners
  attachViewEvents();
}

function navButton(id, label) {
  return `<button class="${view === id ? 'active' : ''}" data-view="${id}">${label}</button>`;
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
                <div>
                  <b>${c.name}</b>
                  <small>${c.phone ? '📱 ' + c.phone : 'Sin teléfono'} ${c.note ? '· ' + c.note : ''}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
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
                  <div>
                    <b>${p.name}</b>
                    <small>${p.brand} · Costo compra: ${money(p.cost)}</small>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="pill ${p.stock === 0 ? 'red' : 'orange'}">
                      ${p.stock === 0 ? 'Agotado (0)' : p.stock + ' disponibles'}
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
                  <div>
                    <b>${s.product_name}</b>
                    <small>${s.customer_name} · ${s.quantity} pza(s) · ${s.sale_date}</small>
                  </div>
                  <div style="text-align: right;">
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
// VIEW 2: PRODUCTS (TABLA CON COSTO DE COMPRA Y COSTO AL PÚBLICO)
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

    <!-- Barra de búsqueda y filtros -->
    <div class="toolbar">
      <div class="filters">
        <input
          id="product-search-input"
          type="text"
          placeholder="🔍 Buscar por producto, marca o categoría..."
          value="${productSearchQuery}"
          style="min-width: 280px;"
        />
        <select id="product-brand-filter">
          <option value="">Todas las marcas (${brands.length})</option>
          ${brands.map(b => `<option value="${b}" ${productBrandFilter === b ? 'selected' : ''}>${b}</option>`).join('')}
        </select>
        ${(productSearchQuery || productBrandFilter) ? `<button class="btn btn-sm btn-outline" id="clear-product-filters">Limpiar filtros</button>` : ''}
      </div>
      <small class="subtle">Mostrando <b>${filtered.length}</b> de ${(state.products || []).length} productos</small>
    </div>

    <!-- Tabla de productos con Costo de compra y Precio al público -->
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
                  <td>
                    <b>${p.name}</b>
                  </td>
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

    <div style="margin-top: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: #fffdf9; padding: 14px 20px; border-radius: 12px; border: 1px solid var(--line);">
      <small style="color: var(--muted); font-size: 13px;">
        💡 <b>Resumen del inventario:</b> Tienes <b>${(state.products || []).reduce((acc, p) => acc + p.stock, 0)}</b> piezas en stock.
      </small>
      <div style="display: flex; gap: 20px; font-size: 13px;">
        <span>Inversión en mercancía: <b>${money(totalCatalogCost)}</b></span>
        <span>Venta potencial: <b>${money(totalCatalogRetail)}</b></span>
        <span style="color: var(--primary); font-weight: 700;">Ganancia potencial: +${money(potentialProfit)}</span>
      </div>
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
                <td>${s.sale_date}</td>
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
                <td>${p.purchase_date}</td>
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
                    ? `<a href="https://wa.me/52${c.phone.replace(/\D/g, '')}" target="_blank" rel="noopener" style="color: var(--primary); text-decoration: none; font-weight: 600;">📱 ${c.phone}</a>`
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
// GENERIC MODAL CONTROLLER
// -------------------------------------------------------------
function showModal({ icon, title, subtitle, formHtml, onOpen, onSubmit }) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-backdrop open" id="active-modal-backdrop">
      <div class="modal-card">
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
        <input name="quantity" id="sale-quantity-input" type="number" min="1" value="1" required />
      </div>

      <div class="form-group">
        <label>Precio unitario al público</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="unit_price" id="sale-price-input" type="number" step="0.01" min="0" required />
        </div>
      </div>

      <div class="form-group">
        <label>Pago recibido de inmediato</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="paid" id="sale-paid-input" type="number" step="0.01" min="0" required />
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
        const total = qty * unitPrice;
        const costTotal = qty * prod.cost;
        const profit = total - costTotal;
        const paid = Number(paidInput.value);

        const costEl = document.getElementById('sale-preview-cost');
        const totEl = document.getElementById('sale-preview-total');
        const profEl = document.getElementById('sale-preview-profit');
        if (costEl) costEl.textContent = money(costTotal);
        if (totEl) totEl.textContent = money(total);
        if (profEl) profEl.textContent = `+${money(profit)} (${total ? Math.round((profit / total) * 100) : 0}%)`;

        const statusVal = document.getElementById('sale-preview-status-val');
        const statusLabel = document.getElementById('sale-preview-status-label');

        if (statusVal && statusLabel) {
          if (paid >= total) {
            statusLabel.textContent = 'Estado de pago:';
            statusVal.className = 'green';
            statusVal.textContent = '✅ Pagada de contado';
          } else if (paid > 0) {
            const debt = total - paid;
            statusLabel.textContent = 'Queda a deber al cliente:';
            statusVal.className = 'orange';
            statusVal.textContent = `Abono de ${money(paid)} · Debe ${money(debt)}`;
          } else {
            statusLabel.textContent = 'Total a crédito:';
            statusVal.className = 'orange';
            statusVal.textContent = `Pendiente por cobrar ${money(total)}`;
          }
        }
      };

      const initialProd = byId(state.products, prodSelect.value);
      if (initialProd) {
        priceInput.value = initialProd.price;
        paidInput.value = initialProd.price;
      }

      prodSelect.addEventListener('change', () => {
        const p = byId(state.products, prodSelect.value);
        if (p) {
          priceInput.value = p.price;
          paidInput.value = (Number(qtyInput.value) || 1) * p.price;
          updateCalculations();
        }
      });

      qtyInput.addEventListener('input', () => {
        const p = byId(state.products, prodSelect.value);
        if (p) {
          paidInput.value = (Number(qtyInput.value) || 1) * Number(priceInput.value);
        }
        updateCalculations();
      });

      priceInput.addEventListener('input', () => {
        paidInput.value = (Number(qtyInput.value) || 1) * Number(priceInput.value);
        updateCalculations();
      });

      paidInput.addEventListener('input', updateCalculations);

      updateCalculations();
    },
    onSubmit: async formData => {
      const productId = formData.get('product_id');
      const product = byId(state.products, productId);
      if (!product) throw new Error('Producto no encontrado');

      const quantity = Number(formData.get('quantity')) || 1;
      const unitPrice = Number(formData.get('unit_price')) || product.price;
      const paid = Number(formData.get('paid')) || 0;
      const total = quantity * unitPrice;
      const profit = (unitPrice - product.cost) * quantity;
      const saleDate = formData.get('sale_date') || today();
      const dueDate = formData.get('due_date') || '';
      const customerId = formData.get('customer_id');

      let customerName = 'Venta al mostrador';
      let customer = null;

      if (customerId !== '__direct__') {
        customer = byId(state.customers, customerId);
        if (customer) customerName = customer.name;
      }

      // Descontar inventario
      product.stock = Math.max(0, product.stock - quantity);

      // Calcular estado y deuda
      let status = 'Pagada';
      const debt = Math.max(0, total - paid);
      if (debt > 0) {
        status = paid > 0 ? 'Abono' : 'Pendiente';
        if (customer) {
          customer.balance = (customer.balance || 0) + debt;
        }
      }

      const newSale = {
        id: crypto.randomUUID(),
        sale_date: saleDate,
        customer_id: customer ? customer.id : null,
        customer_name: customerName,
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: unitPrice,
        unit_cost: product.cost,
        total,
        profit,
        paid,
        status,
        due_date: dueDate
      };

      state.sales = state.sales || [];
      state.sales.push(newSale);
      showToast(`Venta de "${product.name}" registrada con éxito!`, '🛍️');

      if (supabase) {
        try {
          await Promise.all([
            supabase.from('sales').insert([newSale]),
            supabase.from('products').update({ stock: product.stock }).eq('id', product.id),
            customer ? supabase.from('customers').update({ balance: customer.balance }).eq('id', customer.id) : Promise.resolve()
          ]);
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
        <input name="quantity" id="purchase-qty-input" type="number" min="1" value="1" required />
      </div>

      <div class="form-group">
        <label>Costo unitario de compra</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="cost" id="purchase-cost-input" type="number" step="0.01" min="0" required />
        </div>
      </div>

      <div class="form-group">
        <label>Gastos adicionales / Envío</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="expenses" id="purchase-expenses-input" type="number" step="0.01" min="0" value="0" />
        </div>
      </div>

      <div class="form-group" style="justify-content: center;">
        <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; margin-top: 18px; text-transform: none; font-size: 13px;">
          <input type="checkbox" name="update_catalog_cost" checked style="width: auto;" />
          Actualizar costo en el catálogo
        </label>
      </div>
    </div>

    <!-- Resumen dinámico -->
    <div class="calc-preview">
      <div class="calc-preview-row">
        <span>Subtotal mercancía:</span>
        <strong id="purchase-subtotal-val">$0.00</strong>
      </div>
      <div class="calc-preview-row">
        <span>Flete / Envío:</span>
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
      showToast(`Compra registrada. Ahora tienes ${product.stock} piezas de "${product.name}".`, '📦');

      if (supabase) {
        try {
          await Promise.all([
            supabase.from('purchases').insert([newPurchase]),
            supabase.from('products').update({ stock: product.stock, cost: product.cost }).eq('id', product.id)
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
            <input name="cost" id="np-cost-input" type="number" step="0.01" min="0" placeholder="0.00" required />
          </div>
        </div>

        <div class="form-group">
          <label>Costo de venta al público (lo que cobras)</label>
          <div class="input-addon-wrap">
            <span class="prefix">$</span>
            <input name="price" id="np-price-input" type="number" step="0.01" min="0" placeholder="0.00" required />
          </div>
        </div>

        <div class="form-group full">
          <label>Existencia inicial (piezas disponibles)</label>
          <input name="stock" id="np-stock-input" type="number" min="0" value="1" required />
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
            <input name="pkg_total_cost" id="pkg-cost-input" type="number" step="0.01" min="0" value="0" placeholder="0.00" />
          </div>
          <small style="font-size: 11px; color: var(--muted); margin-top: 2px;">
            (Si fue un regalo o incentivo sin costo, déjalo en $0.00).
          </small>
        </div>
      </div>

      <div class="package-section">
        <div class="package-section-title">
          <span>Artículos incluidos (se venderán a precio de revista)</span>
          <span style="font-weight: 500; font-size: 11px; text-transform: none; color: var(--muted);">
            Solo ingresa el precio al público de cada uno
          </span>
        </div>

        <div class="package-items-list" id="package-items-list">
          <!-- Las filas de artículos del paquete se agregan dinámicamente -->
        </div>

        <button type="button" class="btn btn-sm btn-outline btn-add-package-item" id="btn-add-pkg-item">
          + Agregar otro artículo al paquete
        </button>
      </div>

      <div class="calc-preview" style="margin-top: 14px;">
        <div class="calc-preview-row">
          <span>Total de artículos en el paquete:</span>
          <strong id="pkg-summary-items">0 piezas</strong>
        </div>
        <div class="calc-preview-row">
          <span>Venta total esperada (Precio de revista):</span>
          <strong class="green" id="pkg-summary-retail">$0.00</strong>
        </div>
        <div class="calc-preview-row">
          <span>Inversión pagada por el paquete:</span>
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
        if (submitBtn) submitBtn.textContent = 'Guardar paquete y artículos';
        if (pkgItemsList.children.length === 0) {
          addPackageItemRow();
          addPackageItemRow();
        }
        updatePackageCalculations();
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
              <input class="pkg-item-qty" type="number" min="1" value="1" required />
            </div>
            <div class="field">
              <label>Precio revista</label>
              <div class="input-addon-wrap">
                <span class="prefix">$</span>
                <input class="pkg-item-price" type="number" step="0.01" min="0" placeholder="0.00" required />
              </div>
            </div>
          </div>
        `;

        card.querySelector('.btn-remove-pkg-item').addEventListener('click', () => {
          if (pkgItemsList.children.length > 1) {
            card.remove();
            // Re-number badges
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
        // MODO PRODUCTO INDIVIDUAL
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
        // MODO PAQUETE / SET DE REVISTA
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

        // Crear los productos distribuyendo el costo proporcionalmente al precio de revista
        const createdProducts = [];
        rawItems.forEach(it => {
          let assignedUnitCost = 0;
          if (pkgCost > 0 && totalRetailSum > 0) {
            // Prorrateo ponderado según el precio de revista
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

        // Registrar la compra del paquete si tuvo costo de inversión
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

        showToast(`Paquete "${pkgName}" guardado: ${createdProducts.length} productos ingresados al catálogo a precio de revista.`, '📦');

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
          <input name="cost" id="edit-cost-input" type="number" step="0.01" min="0" value="${product.cost}" required />
        </div>
      </div>

      <div class="form-group">
        <label>Precio de venta al público (Precio revista)</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="price" id="edit-price-input" type="number" step="0.01" min="0" value="${product.price}" required />
        </div>
      </div>

      <div class="form-group full">
        <label>Existencia actual (piezas)</label>
        <input name="stock" type="number" min="0" value="${product.stock}" required />
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
        <input name="phone" placeholder="Ej. 55 1234 5678" />
      </div>

      <div class="form-group">
        <label>Saldo inicial que debe (opcional)</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="balance" type="number" step="0.01" min="0" value="0" />
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
// MODAL 6: EDITAR CLIENTE (NUEVO)
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
        <input name="phone" value="${customer.phone || ''}" placeholder="Ej. 55 1234 5678" />
      </div>

      <div class="form-group">
        <label>Saldo pendiente por cobrar</label>
        <div class="input-addon-wrap">
          <span class="prefix">$</span>
          <input name="balance" type="number" step="0.01" min="0" value="${customer.balance || 0}" required />
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
          <input name="amount" id="abono-amount-input" type="number" step="0.01" min="1" max="${customer.balance}" value="${customer.balance}" required />
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
// INITIALIZATION
// -------------------------------------------------------------
renderApp();
initSupabaseData();
