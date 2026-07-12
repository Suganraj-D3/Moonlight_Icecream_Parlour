// Get seat number from URL and display it
const urlParams = new URLSearchParams(window.location.search);
const seatNumber = urlParams.get('seat');
document.getElementById('seatNumber').textContent = seatNumber;

// Item prices dictionary (populated dynamically from menuData)
const itemPrices = {};
if (typeof menuData !== 'undefined' && menuData.sections) {
    menuData.sections.forEach(sec => {
        sec.items.forEach(item => {
            itemPrices[item.name] = item.price;
        });
    });
}

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
    out += `KOT - ${SHOP_INFO.name.trim()}\n`;
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

// Render menu from menuData dynamically
function renderMenu() {
    const box1 = document.querySelector('.box1');
    if (!box1 || typeof menuData === 'undefined' || !menuData.sections) return;
    box1.innerHTML = '';
    menuData.sections.forEach(section => {
        const catDiv = document.createElement('div');
        catDiv.className = 'totalitems';
        
        const h5 = document.createElement('h5');
        h5.textContent = section.name;
        catDiv.appendChild(h5);
        
        const subitemsDiv = document.createElement('div');
        subitemsDiv.className = 'subitems';
        
        section.items.forEach(item => {
            const btn = document.createElement('button');
            btn.textContent = item.name;
            btn.addEventListener('click', () => {
                addToCart(item.name);
            });
            subitemsDiv.appendChild(btn);
        });
        
        catDiv.appendChild(subitemsDiv);
        box1.appendChild(catDiv);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    renderMenu();
    loadCartFromStorage();
    updateCart();

    // Save cart
    document.getElementById("saveBtn")?.addEventListener("click", () => {
        saveCartToStorage();
        alert("Cart saved successfully!");
    });

    // Go Home
    document.getElementById("goHomeBtn")?.addEventListener("click", () => {
        window.location.href = "index.html";
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

    // Move Table
    document.getElementById("moveTableBtn")?.addEventListener("click", moveTable);

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
function showInlinePreview(items, total, dateStr, timeStr, isKOT = false) {
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
    title.textContent = isKOT ? `KOT - ${SHOP_INFO.name.trim()}` : SHOP_INFO.name;
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
    if (isKOT) {
        thead.innerHTML = '<tr><th style="text-align:left;padding:8px">Items</th><th style="text-align:right;padding:8px">Count</th></tr>';
    } else {
        thead.innerHTML = '<tr><th style="text-align:left;padding:8px">Items</th><th style="text-align:right;padding:8px">Count</th><th style="text-align:right;padding:8px">Price</th></tr>';
    }
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    items.forEach(it => {
        const tr = document.createElement('tr');
        if (isKOT) {
            tr.innerHTML = `<td style="padding:8px">${it.name}</td><td style="padding:8px;text-align:right">${it.qty}</td>`;
        } else {
            tr.innerHTML = `<td style="padding:8px">${it.name}</td><td style="padding:8px;text-align:right">${it.qty}</td><td style="padding:8px;text-align:right">₹${it.total}</td>`;
        }
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    
    if (!isKOT) {
        const tfoot = document.createElement('tfoot');
        tfoot.innerHTML = `<tr><th colspan="2" style="padding:8px;text-align:left">TOTAL</th><th style="padding:8px;text-align:right">₹${total}</th></tr>`;
        table.appendChild(tfoot);
    }
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
    printPre.textContent = isKOT ? buildKOTText(items) : buildBillText(items, total);
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
        doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${isKOT ? 'KOT' : 'Bill'}</title><style>
            @page { size: 58mm auto; margin: 4mm; }
            html,body{margin:0;padding:0;font-family:monospace;color:#000}
            .wrapper{padding:6px;font-size:12px}
            pre{white-space:pre;font-family:monospace;font-size:11px}
        </style></head><body><div class="wrapper">`);
        const thermal = isKOT ? buildKOTText(items) : buildBillText(items, total);
        doc.write('<pre>' + thermal + '</pre>');
        doc.write('</div></body></html>');
        doc.close();
        printWin.focus();
        try { printWin.print(); } catch (e) { console.warn('Print failed', e); }
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

// Open a printable HTML window for KOT
function openKOTPrintWindow(items) {
    const w = window.open('', '', 'width=600,height=800');
    if (!w) {
        // Popup blocked — fall back to inline preview
        showInlinePreview(items, '', new Date().toLocaleDateString(), new Date().toLocaleTimeString(), true);
        return null;
    }
    const doc = w.document;
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>KOT</title><style>
        @page { size: 58mm auto; margin: 4mm; }
        html,body{margin:0;padding:0;font-family:monospace; color:#000;}
        .wrapper{padding:6px; font-size:12px;}
        pre{font-family:monospace; white-space:pre; font-size:11px;}
    </style></head><body>`);
    doc.write(`<div class="wrapper">`);
    const thermal = buildKOTText(items);
    doc.write('<pre>' + thermal + '</pre>');
    doc.write('</div></body></html>');
    doc.close();
    w.focus();
    try { w.print(); } catch (e) { console.warn('KOT print failed', e); }
    return w;
}

// Function to print KOT
function printKOT() {
    disableButtons(true);
    const items = Object.keys(cart).map(name => ({ name, qty: cart[name] }));
    
    if (items.length === 0) {
        alert('No items in cart to print KOT.');
        disableButtons(false);
        return;
    }

    // Open KOT print window
    const previewWindow = openKOTPrintWindow(items);
    if (!previewWindow) {
        console.warn('Print preview opened inline (popup was blocked).');
    }
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
        const txn = {
            table: seatNumber || 'Unknown',
            timestamp: new Date().toISOString(),
            items: Array.isArray(window._currentPrintItems) ? window._currentPrintItems.slice() : [],
            total: total
        };

        if (txn.items && txn.items.length > 0) {
            // 1. Save to local storage for fallback / redundancy
            const salesKey = 'sales_summary';
            const existing = localStorage.getItem(salesKey);
            const sales = existing ? JSON.parse(existing) : [];
            sales.push(txn);
            localStorage.setItem(salesKey, JSON.stringify(sales));

            // 2. Save to Express server file
            const apiBase = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
                ? window.location.origin
                : 'http://localhost:3000';
            fetch(`${apiBase}/api/sales`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(txn)
            }).then(res => {
                if (res.ok) console.log('Transaction saved to server file successfully.');
            }).catch(err => {
                console.warn('Backend server not running; transaction saved locally only.');
            });
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

    // Automatically clear and reset the cart for the next order
    Object.keys(cart).forEach(item => delete cart[item]);
    saveCartToStorage();
    updateCart();

    disableButtons(false);
}

// Move Table transfer logic
function moveTable() {
    const currentSeat = seatNumber || 'Unknown';
    let targetInput = prompt(`Move all ordered items from ${currentSeat} to another table. Enter target table number (e.g. 4):`);
    if (!targetInput) return; // User cancelled
    
    targetInput = targetInput.trim();
    if (!targetInput) return;
    
    // Normalize to "Seat X"
    let targetSeat = targetInput;
    if (/^\d+$/.test(targetInput)) {
        targetSeat = `Seat ${targetInput}`;
    }
    
    if (targetSeat === currentSeat) {
        alert("Target table must be different from current table!");
        return;
    }
    
    if (!confirm(`Are you sure you want to move all items from ${currentSeat} to ${targetSeat}?`)) {
        return;
    }
    
    // 1. Load target seat's existing cart from localStorage (if any)
    const targetKey = `icecream_cart_${targetSeat}`;
    const rawTarget = localStorage.getItem(targetKey);
    let targetCart = {};
    if (rawTarget) {
        try { targetCart = JSON.parse(rawTarget); } catch(e) {}
    }
    
    // 2. Merge current cart items into target cart
    for (let item in cart) {
        targetCart[item] = (targetCart[item] || 0) + cart[item];
    }
    
    // 3. Save target cart to storage
    localStorage.setItem(targetKey, JSON.stringify(targetCart));
    
    // 4. Clear current cart
    Object.keys(cart).forEach(item => delete cart[item]);
    saveCartToStorage();
    
    alert(`Successfully moved items to ${targetSeat}! Redirecting to ${targetSeat}...`);
    
    // 5. Redirect browser to itemsList.html for the new seat
    const url = new URL(window.location.href);
    url.searchParams.set('seat', targetSeat);
    window.location.href = url.toString();
}
