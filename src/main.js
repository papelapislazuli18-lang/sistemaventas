import { createClient } from '@supabase/supabase-js';
import './style.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey && !supabaseUrl.includes('tu-proyecto')
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const initialData = {
  products: [
    { id: 'p1', name: 'Set de brochas Glow', brand: "L'Bel", category: 'Cosméticos', cost: 180, price: 290, stock: 5 },
    { id: 'p2', name: 'Organizador multiuso', brand: 'Betterware', category: 'Hogar', cost: 125, price: 210, stock: 2 },
    { id: 'p3', name: 'Crema corporal karité', brand: 'Chantal', category: 'Cuidado personal', cost: 95, price: 160, stock: 8 }
  ],
  sales: [], purchases: [], customers: []
};

let state = JSON.parse(localStorage.getItem('impulso-data')) || initialData;
let view = 'summary';
const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value || 0);
const save = () => localStorage.setItem('impulso-data', JSON.stringify(state));
const today = () => new Date().toISOString().slice(0, 10);
const byId = (items, id) => items.find(item => item.id === id);

function app() {
  document.querySelector('#app').innerHTML = `<div class="shell"><aside><div class="brand"><small>Tu negocio en orden</small><h1>Impulso</h1></div><nav>${navButton('summary', 'Resumen')}${navButton('products', 'Productos')}${navButton('purchases', 'Compras')}${navButton('sales', 'Ventas')}${navButton('customers', 'Clientes')}</nav><div class="connection ${supabase ? 'online' : ''}">${supabase ? 'Sincronización activa' : 'Modo local'}<small>${supabase ? 'Datos protegidos en Supabase' : 'Configura Supabase para usarlo desde cualquier dispositivo'}</small></div></aside><main>${content()}</main></div>`;
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.view; app(); }));
  document.querySelectorAll('[data-action="add-product"]').forEach(button => button.addEventListener('click', addProduct));
  document.querySelectorAll('[data-action="add-purchase"]').forEach(button => button.addEventListener('click', addPurchase));
  document.querySelectorAll('[data-action="add-sale"]').forEach(button => button.addEventListener('click', addSale));
}

function navButton(id, label) { return `<button class="${view === id ? 'active' : ''}" data-view="${id}">${label}</button>`; }
function content() { return view === 'summary' ? summary() : view === 'products' ? products() : view === 'purchases' ? purchases() : view === 'sales' ? sales() : customers(); }
function layout(title, subtitle, body, action = '') { return `<header><div><span class="eyebrow">Impulso</span><h2>${title}</h2><p>${subtitle}</p></div>${action}</header>${body}`; }

function summary() {
  const month = new Date().toISOString().slice(0, 7);
  const sales = state.sales.filter(item => item.date.startsWith(month));
  const purchases = state.purchases.filter(item => item.date.startsWith(month));
  const revenue = sales.reduce((sum, item) => sum + item.total, 0);
  const investment = purchases.reduce((sum, item) => sum + item.total, 0);
  const profit = sales.reduce((sum, item) => sum + item.profit, 0);
  const receivable = state.customers.reduce((sum, item) => sum + (item.balance || 0), 0);
  return layout('Tu negocio, en una mirada', 'Ventas, inversión y dinero pendiente del mes actual.', `<section class="metrics"><article><small>Ventas del periodo</small><strong>${money(revenue)}</strong><span>${sales.length} operaciones</span></article><article><small>Inversión realizada</small><strong>${money(investment)}</strong><span>${purchases.length} compras</span></article><article><small>Ganancia estimada</small><strong>${money(profit)}</strong><span>Margen ${revenue ? Math.round(profit / revenue * 100) : 0}%</span></article><article class="warning"><small>Por cobrar</small><strong>${money(receivable)}</strong><span>${state.customers.filter(item => item.balance > 0).length} clientes</span></article></section><section class="columns"><div class="panel"><h3>Inventario atento</h3>${state.products.filter(item => item.stock <= 2).map(item => `<div class="row"><div><b>${item.name}</b><small>${item.brand}</small></div><em>${item.stock} disponibles</em></div>`).join('') || '<p class="empty">No hay alertas de inventario.</p>'}</div><div class="panel"><h3>Últimas ventas</h3>${state.sales.slice(-5).reverse().map(item => `<div class="row"><div><b>${item.product}</b><small>${item.customer || 'Venta directa'}</small></div><em>${money(item.total)}</em></div>`).join('') || '<p class="empty">Registra tu primera venta.</p>'}</div></section>`);
}

function products() { return layout('Productos', 'Tu catálogo organizado por marca y categoría.', `<section class="toolbar"><button class="primary" data-action="add-product">+ Nuevo producto</button></section><div class="panel table-wrap"><table><thead><tr><th>Producto</th><th>Marca</th><th>Categoría</th><th>Precio</th><th>Existencia</th></tr></thead><tbody>${state.products.map(item => `<tr><td><b>${item.name}</b><small>Costo ${money(item.cost)}</small></td><td>${item.brand}</td><td>${item.category}</td><td>${money(item.price)}</td><td><span class="pill ${item.stock <= 2 ? 'orange' : ''}">${item.stock}</span></td></tr>`).join('')}</tbody></table></div>`); }
function purchases() { return layout('Compras', 'Registra la inversión que entra al negocio.', `<section class="toolbar"><button class="primary" data-action="add-purchase">+ Registrar compra</button></section><div class="panel table-wrap"><table><thead><tr><th>Fecha</th><th>Referencia</th><th>Productos</th><th>Gastos</th><th>Total</th></tr></thead><tbody>${state.purchases.slice().reverse().map(item => `<tr><td>${item.date}</td><td>${item.reference || 'Sin referencia'}</td><td>${item.items.length} productos</td><td>${money(item.expenses)}</td><td><b>${money(item.total)}</b></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Aún no hay compras.</td></tr>'}</tbody></table></div>`); }
function sales() { return layout('Ventas', 'Registra ventas y conoce tu ganancia.', `<section class="toolbar"><button class="primary" data-action="add-sale">+ Registrar venta</button></section><div class="panel table-wrap"><table><thead><tr><th>Fecha</th><th>Cliente</th><th>Producto</th><th>Total</th><th>Ganancia</th></tr></thead><tbody>${state.sales.slice().reverse().map(item => `<tr><td>${item.date}</td><td>${item.customer}</td><td>${item.product}</td><td>${money(item.total)}</td><td class="green">+${money(item.profit)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Aún no hay ventas.</td></tr>'}</tbody></table></div>`); }
function customers() { return layout('Clientes', 'Consulta compras y saldos pendientes.', `<section class="panel table-wrap"><table><thead><tr><th>Cliente</th><th>Teléfono</th><th>Saldo pendiente</th></tr></thead><tbody>${state.customers.map(item => `<tr><td><b>${item.name}</b></td><td>${item.phone || 'Sin teléfono'}</td><td class="${item.balance ? 'orange-text' : 'green'}">${item.balance ? money(item.balance) : 'Al corriente'}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Agrega clientes desde el registro de ventas.</td></tr>'}</tbody></table></div>`); }

function addProduct() { const name = prompt('Nombre del producto'); if (!name) return; const brand = prompt('Marca', 'L\'Bel'); const category = prompt('Categoría', 'Cuidado personal'); const cost = Number(prompt('Costo unitario', '0')); const price = Number(prompt('Precio de venta', '0')); const stock = Number(prompt('Existencia inicial', '0')); state.products.push({ id: crypto.randomUUID(), name, brand, category, cost, price, stock }); save(); app(); }
function addPurchase() { if (!state.products.length) return alert('Primero crea un producto.'); const product = state.products[0]; const quantity = Number(prompt(`Cantidad de ${product.name}`, '1')); const cost = Number(prompt('Costo unitario', String(product.cost))); const expenses = Number(prompt('Gastos adicionales', '0')); if (!quantity || quantity < 1) return; product.stock += quantity; product.cost = cost; state.purchases.push({ id: crypto.randomUUID(), date: today(), reference: prompt('Referencia', 'Compra'), items: [{ productId: product.id, quantity, cost }], expenses, total: quantity * cost + expenses }); save(); app(); }
function addSale() { if (!state.products.length) return alert('Primero crea un producto.'); const product = state.products[0]; const customer = prompt('Nombre del cliente', 'Venta directa'); const quantity = Number(prompt(`Cantidad de ${product.name}`, '1')); const price = Number(prompt('Precio unitario', String(product.price))); if (!quantity || quantity < 1) return; product.stock = Math.max(0, product.stock - quantity); state.sales.push({ id: crypto.randomUUID(), date: today(), customer, product: product.name, total: quantity * price, profit: (price - product.cost) * quantity }); save(); app(); }

app();
