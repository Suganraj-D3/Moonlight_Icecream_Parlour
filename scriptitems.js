// Get seat number from URL and display it
const urlParams = new URLSearchParams(window.location.search);
const seatNumber = urlParams.get('seat');
document.getElementById('seatNumber').textContent = seatNumber;

// Item prices dictionary (updated menu)
const itemPrices = {

    // Burger
    "Veg Burger": 130,
    "Veg Cheesy Burger": 150,
    "Korean Veg Burger": 180,
    "Chicken Burger": 150,
    "Chicken Cheesy Burger": 150,
    "Korean Chicken Burger": 180,

    // Sandwich
    "Classic Veg Sandwich": 150,
    "Veg Cheese Sandwich": 160,
    "Chicken Sandwich": 150,
    "Chicken Cheese Sandwich": 160,
    "Peri Peri Chicken Sandwich": 180,
    "Chicken Stuff Sandwich": 200,

    // Roll
    "Moonlight Special Chicken Roll": 200,
    "Spicy Chicken Roll": 180,
    "Chicken Cheese Roll": 160,
    "Garlic Chicken Roll": 160,
    "Classic Chicken Roll": 150,

    // Starters
    "French Fries": 110,
    "Veg Nuggets": 120,
    "Veg Momos": 120,
    "Smiley": 100,
    "Chicken Nuggets": 150,
    "Chicken Momos": 140,

    // Mojito
    "Ice Blue": 100,
    "Lemon": 100,
    "Strawberry": 100,
    "Watermelon": 100,

    // Korean Dishes
    "Korean Boneless Chicken": 249,
    "Korean Chicken Momo": 170,
    "Korean Veg Momo": 150,
    "Chicken Loaded Fries": 200,
    "Chicken Popcorn": 200,

    // Ice Cream Sandwiches
    "Rainbow Ice Cream Sandwich": 199,
    "Choco Ice Cream Sandwich": 199,
    "Oreo Fantasy Sandwich": 199,
    "Strawberry Cream Sandwich": 199,
    "Mango Cream Sandwich": 199,

    // Special Ice Creams
    "Puttu Ice Cream": 299,
    "Titanic Ice Cream": 299,
    "Rainbow Ice Cream": 299,
    "Hot Choco Brownie": 199,

    // Ice Cream
    "Red Velvet": 150,
    "Tender Coconut": 150,
    "Kulfi": 150,
    "Blackcurrant": 120,
    "Pista": 120,
    "Chocolate": 120,
    "Butterscotch": 120,
    "Mango": 120,
    "Strawberry": 90,
    "Vanilla": 90,

    // Milkshake
    "Oreo Shake": 170,
    "Cold Coffee": 150,
    "Boost Shake": 150,
    "Red Velvet Shake": 180,
    "Tender Coconut Shake": 180,
    "Kulfi Shake": 180,
    "Blackcurrant Shake": 150,
    "Pista Shake": 150,
    "Butterscotch Shake": 150,
    "Chocolate Shake": 150,
    "Mango Shake": 150,
    "Strawberry Shake": 120,
    "Vanilla Shake": 120,

    // Brownie
    "Sizzling Brownie": 170,
    "Brownie with Chocolate": 150,
    "Brownie with Butterscotch": 140,
    "Brownie with Vanilla": 120,

    // Choco Lava
    "Chocolava with Chocolate": 150,
    "Chocolava with Butterscotch": 140,
    "Chocolava with Vanilla": 130,

    // Falooda
    "Moonlight Falooda": 250,
    "Dry Fruit Falooda": 200,
    "Chocolate Falooda": 180,
    "Fruit Falooda": 180,
    "Lassi Falooda": 150,
    "Mini Falooda": 120,
    "Choco Man": 200
};

const cart = {};

// Thermal printer settings
// For 58mm (HOP-H58) receipts, ~32 characters per line is typical.
const THERMAL_WIDTH = 32;
const SHOP_INFO = { name: '\nMoonlight Icecream Parlour', address: 'Trichy Road Dindigul', location: '', contact: '7708946529' };

function formatLine(left, right = '', width = THERMAL_WIDTH) {
    left = String(left);
    right = String(right);
    const gap = width - left.length - right.length;
    if (gap >= 0) return left + ' '.repeat(gap) + right;
    // if overflow, truncate left
    const maxLeft = Math.max(0, width - right.length - 1);
    return left.slice(0, maxLeft) + ' ' + right;
}

function buildKOTText(items) {
    let out = '';
    out += `KOT - ${SHOP_INFO.name}\n`;
    out += `Table: ${seatNumber || ''}\n`;
    out += `------------------------------\n`;
    items.forEach(i => {
        const name = i.name.length > 30 ? i.name.slice(0, 30) + '…' : i.name;
        out += formatLine(name, `x${i.qty}`) + '\n';
    });
    out += `------------------------------\n`;
    out += `\n`;
    return out;
}

function buildBillText(items, total) {
    const width = THERMAL_WIDTH;
    const now = new Date();

    const qtyW = 3;
    const priceW = 8;
    const nameW = Math.max(10, width - qtyW - priceW - 2);

    let out = '\n'.repeat(2);

    function centerLine(text) {
        const pad = Math.max(0, Math.floor((width - text.length) / 2));
        return ' '.repeat(pad) + text + '\n';
    }

    out += centerLine(SHOP_INFO.name || '');
    if (SHOP_INFO.address) out += centerLine(SHOP_INFO.address);
    if (SHOP_INFO.location) out += centerLine(SHOP_INFO.location);

    out += formatLine(
        'Date: ' + now.toLocaleDateString(),
        'Time: ' + now.toLocaleTimeString()
    ) + '\n';

    out += '-'.repeat(width) + '\n';
    out += 'QTY ITEM'.padEnd(width - 8) + 'PRICE\n';
    out += '-'.repeat(width) + '\n';

    items.forEach(i => {
        let name = i.name.length > nameW ? i.name.slice(0, nameW - 1) + '…' : i.name;
        const line = 
            String(i.qty).padEnd(qtyW) + ' ' +
            name.padEnd(nameW) + ' ' +
            (i.total).toFixed(2).padStart(priceW);
        out += line + '\n';
    });

    out += '-'.repeat(width) + '\n';
    out += formatLine('TOTAL AMOUNT', total.toFixed(2)) + '\n';
    out += '-'.repeat(width) + '\n';

    out += centerLine('THANK YOU') + '\n';

    out += '\n'.repeat(12);

    return out;

}


// Ensure QZ Tray websocket is connected (auto-connect). Resolves when connected or rejects on timeout/error.
function ensureQzConnected(timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (!(window.qz && qz.websocket)) return reject('QZ library not loaded');
        try {
            if (typeof qz.websocket.isActive === 'function' && qz.websocket.isActive()) return resolve();

            // Try to connect; qz.websocket.connect() itself returns a promise
            const connectPromise = qz.websocket.connect();
            let finished = false;

            connectPromise.then(() => {
                finished = true;
                return resolve();
            }).catch((err) => {
                // fallback to checking isActive for a short period
                console.warn('qz.connect() failed, will poll isActive briefly', err);
            });

            const start = Date.now();
            const iv = setInterval(() => {
                if (typeof qz.websocket.isActive === 'function' && qz.websocket.isActive()) {
                    clearInterval(iv);
                    if (!finished) finished = true;
                    return resolve();
                }
                if (Date.now() - start > timeout) {
                    clearInterval(iv);
                    return reject('QZ connect timeout');
                }
            }, 200);
        } catch (e) {
            return reject(e);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    loadCartFromStorage();
    updateCart();

    // Add item to cart on click
    document.querySelectorAll('.subitems button').forEach(button => {
        button.addEventListener('click', () => {
            const itemName = button.textContent.trim();
            addToCart(itemName);
        });
    });

    // Save cart
    document.getElementById("saveBtn")?.addEventListener("click", () => {
        saveCartToStorage();
        alert("Cart saved successfully!");
    });

    // Go back
    document.getElementById("goBackBtn")?.addEventListener("click", () => {
        window.history.back();
    });

    // Delete all
    document.getElementById("deleteAllBtn")?.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete all items?")) {
            Object.keys(cart).forEach(item => delete cart[item]);
            saveCartToStorage();
            updateCart();
        }
    });

    // Print KOT
    document.getElementById("kotBtn")?.addEventListener("click", printKOT);

    // Print Bill
    document.getElementById("printBtn")?.addEventListener("click", printBill);

    // Global search (filters categories and subitems)
    const globalSearch = document.getElementById('globalSearch');
    const globalSearchBtn = document.getElementById('globalSearchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    function performGlobalSearch(query) {
        const q = (query || '').trim().toLowerCase();
        document.querySelectorAll('.totalitems').forEach(cat => {
            let anyVisible = false;
            cat.querySelectorAll('.subitems button').forEach(b => {
                const txt = b.textContent.trim().toLowerCase();
                const show = !q || txt.includes(q);
                b.style.display = show ? '' : 'none';
                if (show) anyVisible = true;
            });
            cat.style.display = anyVisible ? '' : 'none';
        });
    }

    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => performGlobalSearch(e.target.value));
        globalSearch.addEventListener('keypress', (e) => { if (e.key === 'Enter') performGlobalSearch(globalSearch.value); });
    }
    globalSearchBtn?.addEventListener('click', () => performGlobalSearch(globalSearch?.value || ''));
    clearSearchBtn?.addEventListener('click', () => { if (globalSearch) { globalSearch.value = ''; performGlobalSearch(''); } });
});

// Add item to cart
function addToCart(itemName) {
    if (cart[itemName]) {
        cart[itemName]++;
    } else {
        cart[itemName] = 1;
    }
    saveCartToStorage();
    updateCart();
}

// Remove item from cart
function removeFromCart(itemName) {
    if (cart[itemName]) {
        cart[itemName]--;
        if (cart[itemName] <= 0) delete cart[itemName];
        saveCartToStorage();
        updateCart();
    }
}

// Update cart display
function updateCart() {
    const cartContainer = document.querySelector('.middle');
    cartContainer.innerHTML = '';
    let total = 0;

    for (let item in cart) {
        const qty = cart[item];
        const price = itemPrices[item] || 0;
        const itemTotal = qty * price;
        total += itemTotal;

        cartContainer.innerHTML += `
            <div>
                ${item} x ${qty} - ₹${itemTotal}
                <button onclick="removeFromCart('${item}')">❌</button>
            </div>
        `;
    }

    document.querySelector('.total').textContent = `Total: ₹${total}`;
}

// Save cart to localStorage
function saveCartToStorage() {
    localStorage.setItem(`icecream_cart_${seatNumber}`, JSON.stringify(cart));
}

// Load cart from localStorage
function loadCartFromStorage() {
    const savedCart = localStorage.getItem(`icecream_cart_${seatNumber}`);
    if (savedCart) {
        const parsed = JSON.parse(savedCart);
        Object.assign(cart, parsed);
    }
}

// Disable buttons temporarily (used during printing)
function disableButtons(disable) {
    const elKot = document.getElementById("kotBtn"); if (elKot) elKot.disabled = !!disable;
    const elSave = document.getElementById("saveBtn"); if (elSave) elSave.disabled = !!disable;
    const elPrint = document.getElementById("printBtn"); if (elPrint) elPrint.disabled = !!disable;
}

// Open a printable HTML window with a table layout for the bill (fallback/preview)
function openPrintWindow(items, total) {
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();
    const w = window.open('', '', 'width=600,height=800');
    if (!w) {
        // Popup blocked — fall back to inline preview
        showInlinePreview(items, total, dateStr, timeStr);
        return null;
    }
    const doc = w.document;
    // Print-friendly thermal CSS: set page width to 58mm and use monospace
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Bill</title><style>
        @page { size: 58mm 400mm; margin: 4mm; }
        html,body{margin:0;padding:0;font-family:monospace; color:#000;}
        .wrapper{padding:6px; font-size:12px;}
        .header{font-weight:bold;margin:0 0 2px;font-size:14px}
        .datetime{text-align:left;font-size:10px;color:#000;margin-bottom:6px}
        pre{font-family:monospace; white-space:pre; font-size:11px;}
        .sep{border-bottom:1px dashed #000;margin:6px 0}
        @media print { body { -webkit-print-color-adjust: exact; } }
    </style></head><body>`);
    doc.write(`<div class="wrapper">`);
    // header and datetime will be included inside the thermal <pre> (buildBillText)
    // Use the same thermal text generator so popup matches ESC/POS width
    const thermal = buildBillText(items, total);
    doc.write('<pre>' + thermal + '</pre>');
    doc.write('</div></body></html>');
    doc.close();
    w.focus();
    try { w.print(); } catch (e) { console.warn('Preview print failed', e); }
    return w;
}

// Show an inline modal preview when popups are blocked
function showInlinePreview(items, total, dateStr, timeStr) {
    // remove existing preview if present
    const existing = document.getElementById('inline-print-preview');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'inline-print-preview';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 9999;

    const panel = document.createElement('div');
    panel.style.width = '720px';
    panel.style.maxWidth = '95%';
    panel.style.maxHeight = '90%';
    panel.style.overflow = 'auto';
    panel.style.background = '#fff';
    panel.style.color = '#000';
    panel.style.padding = '20px';
    panel.style.borderRadius = '8px';

    const title = document.createElement('h1');
    title.textContent = SHOP_INFO.name;
    title.style.textAlign = 'center';
    title.style.margin = '0 0 4px';
    title.className = 'non-print';
    panel.appendChild(title);

    const dt = document.createElement('div');
    dt.textContent = `date: ${dateStr}    time: ${timeStr}`;
    dt.style.textAlign = 'center';
    dt.style.fontSize = '13px';
    dt.style.marginBottom = '12px';
    panel.appendChild(dt);

    const hr = document.createElement('div'); hr.style.borderBottom = '1px dotted #000'; hr.style.margin = '8px 0'; panel.appendChild(hr);
    hr.className = 'non-print';

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th style="text-align:left;padding:8px">Items</th><th style="text-align:right;padding:8px">Count</th><th style="text-align:right;padding:8px">Price</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    items.forEach(it => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="padding:8px">${it.name}</td><td style="padding:8px;text-align:right">${it.qty}</td><td style="padding:8px;text-align:right">₹${it.total}</td>`;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const tfoot = document.createElement('tfoot');
    tfoot.innerHTML = `<tr><th colspan="2" style="padding:8px;text-align:left">TOTAL</th><th style="padding:8px;text-align:right">₹${total}</th></tr>`;
    table.appendChild(tfoot);
    panel.appendChild(table);
    table.className = 'non-print';

    // hidden preformatted print area (used when user prints the overlay)
    const printPre = document.createElement('pre');
    printPre.className = 'print-area';
    printPre.style.display = 'none';
    printPre.style.whiteSpace = 'pre';
    printPre.style.fontFamily = 'monospace';
    printPre.style.fontSize = '10px';
    // populate with thermal text
    printPre.textContent = buildBillText(items, total);
    panel.appendChild(printPre);

    const btns = document.createElement('div');
    btns.style.display = 'flex';
    btns.style.gap = '8px';
    btns.style.justifyContent = 'center';
    btns.style.marginTop = '12px';
    const printBtn = document.createElement('button');
    printBtn.textContent = 'Print';
    printBtn.className = 'button-18';
    printBtn.onclick = () => {
        // open a dedicated small popup for printing (ensures page size and monospace)
        const printWin = window.open('', '', 'width=400,height=800');
        if (!printWin) {
            alert('Popup blocked — allow popups to print or use the browser Print dialog.');
            return;
        }
        const doc = printWin.document;
        doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Bill</title><style>
            @page { size: 58mm auto; margin: 4mm; }
            html,body{margin:0;padding:0;font-family:monospace;color:#000}
            .wrapper{padding:6px;font-size:12px}
            pre{white-space:pre;font-family:monospace;font-size:11px}
        </style></head><body><div class="wrapper">`);
        // header and datetime are produced by buildBillText inside the <pre>
        // use buildBillText to create a thermal-friendly preformatted receipt
        const thermal = buildBillText(items, total);
        doc.write('<pre>' + thermal + '</pre>');
        doc.write('</div></body></html>');
        doc.close();
        printWin.focus();
        try { printWin.print(); } catch (e) { console.warn('Print failed', e); }
        // Do not auto-close the print window — closing too early can cancel the print job.
    };
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.className = 'button-18';
    closeBtn.style.background = '#666';
    // remove preview and any installed handlers
    closeBtn.onclick = () => {
        window.removeEventListener('beforeprint', beforePrint);
        window.removeEventListener('afterprint', afterPrint);
        overlay.remove();
    };
    btns.appendChild(printBtn); btns.appendChild(closeBtn);
    panel.appendChild(btns);

    // print-specific CSS: hide visual preview and show the print-area when printing
    const printStyle = document.createElement('style');
    printStyle.textContent = `
        @media print {
            #inline-print-preview .non-print { display: none !important; }
            #inline-print-preview .print-area { display: block !important; }
            #inline-print-preview { position: static !important; }
        }
    `;
    panel.appendChild(printStyle);

    // when user triggers browser Print (Ctrl+P), ensure only the thermal pre prints
    function beforePrint() {
        // save current content
        if (!panel._savedHTML) panel._savedHTML = panel.innerHTML;
        // replace with the print pre (visible)
        panel.innerHTML = '';
        const preClone = printPre.cloneNode(true);
        preClone.style.display = 'block';
        panel.appendChild(preClone);
    }

    function afterPrint() {
        // restore original content
        if (panel._savedHTML) {
            panel.innerHTML = panel._savedHTML;
            delete panel._savedHTML;
        }
        // re-attach listeners cleanup
        window.removeEventListener('beforeprint', beforePrint);
        window.removeEventListener('afterprint', afterPrint);
    }

    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
}

// Simulated KOT print (can be replaced with QZ Tray logic)
function printKOT() {
    disableButtons(true);
    const items = Object.keys(cart).map(name => ({ name, qty: cart[name] }));
    const kotText = buildKOTText(items);

    // Use browser print flow (popup) — if popup blocked show inline preview
    const w = window.open('', '', 'width=400,height=600');
    if (w) {
        const pre = w.document.createElement('pre');
        pre.textContent = kotText;
        w.document.body.appendChild(pre);
        try { w.print(); } catch (e) { console.warn('KOT print failed', e); }
        try { w.close(); } catch (e) { /* ignore */ }
        disableButtons(false);
        return;
    }

    // Popup blocked — reuse inline preview to show KOT items
    const mapped = items.map(i => ({ name: i.name, qty: i.qty, total: '' }));
    showInlinePreview(mapped, '', new Date().toLocaleDateString(), new Date().toLocaleTimeString());
    disableButtons(false);
}


// Function to print the bill
function printBill() {
    disableButtons(true);
    let total = 0;
    // collect current items for printing and saving (do not build a separate text block here)
    if (!Array.isArray(window._currentPrintItems)) window._currentPrintItems = [];
    window._currentPrintItems.length = 0;
    for (let item in cart) {
        const qty = cart[item];
        const price = itemPrices[item] || 0;
        const itemTotal = qty * price;
        total += itemTotal;
        window._currentPrintItems.push({ name: item, qty: qty, price: price, total: itemTotal });
    }

    // Save transaction regardless of printer availability
    try {
        const salesKey = 'sales_summary';
        const existing = localStorage.getItem(salesKey);
        const sales = existing ? JSON.parse(existing) : [];
        const txn = {
            table: seatNumber || 'Unknown',
            timestamp: new Date().toISOString(),
            items: Array.isArray(window._currentPrintItems) ? window._currentPrintItems.slice() : [],
            total: total
        };
        if (txn.items && txn.items.length > 0) {
            sales.push(txn);
            localStorage.setItem(salesKey, JSON.stringify(sales));
            console.log('Transaction saved to sales_summary', txn);
        } else {
            console.log('No items to save for transaction');
        }
        window._currentPrintItems = [];
    } catch (e) {
        console.error('Failed to store sales summary', e);
    }

    // build thermal bill text
    const itemsForPrint = Object.keys(cart).map(name => ({ name, qty: cart[name], price: itemPrices[name] || 0, total: (itemPrices[name] || 0) * cart[name] }));
    const thermalText = buildBillText(itemsForPrint, total);
    const dataToPrint = [{ type: 'TEXT', value: thermalText }];

    console.log("Thermal print data:\n" + thermalText);

    // If no items, abort and inform the user
    if (!itemsForPrint || itemsForPrint.length === 0) {
        alert('No items in cart to print.');
        disableButtons(false);
        return;
    }

    // Open printable preview (popup or inline). User will print manually like KOT.
    const previewWindow = openPrintWindow(itemsForPrint, total);
    if (!previewWindow) {
        console.warn('Print preview opened inline (popup was blocked).');
    }

    disableButtons(false);
}

