document.addEventListener('DOMContentLoaded', () => {
    // --- FIREBASE CONFIGURATION ---
    // HƯỚNG DẪN: Dán đoạn mã config bạn lấy được từ Firebase Console vào đây
    const firebaseConfig = {
        apiKey: "AIzaSyAr6rJhgVrvWoUkeKiTIsLXMmDs7aCLcno",
        authDomain: "noforup.firebaseapp.com",
        databaseURL: "https://noforup-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "noforup",
        storageBucket: "noforup.firebasestorage.app",
        messagingSenderId: "477221025189",
        appId: "1:477221025189:web:d483f1821355e92899e44c"
    };

    // Khởi tạo Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();

    const screens = document.querySelectorAll('.screen');
    const mainContent = document.getElementById('main-content');

    // --- CORE DATA ---
    let currentCart = [];
    let tableOrders = {}; 
    let selectedTableForBill = null;
    let targetTableId = null; 
    let itemSales = {}; 
    let stats = {
        totalRevenue: 0,
        totalOrders: 0,
        guestCount: 0,
        cashTotal: 0,
        transferTotal: 0
    };
    let menuItems = [];
    let orderHistory = [];
    let store_qr_code = null;
    let printSettings = {
        paperSize: 58,
        showLogo: true,
        showQR: true,
        showWiFi: false,
        showTax: false,
        showNote: true,
        headerText: '',
        footerText: ''
    };

    // Hàm lưu toàn bộ trạng thái lên Firebase Realtime Database
    window.saveAppState = function() {
        const fullData = {
            tableOrders,
            itemSales,
            stats,
            menuItems,
            orderHistory,
            store_qr_code,
            printSettings,
            lastUpdate: firebase.database.ServerValue.TIMESTAMP
        };

        db.ref('/').set(fullData).then(() => {
            console.log("☁️ Toàn bộ dữ liệu đã được đồng bộ Realtime lên Cloud!");
        }).catch(err => {
            console.error("❌ Lỗi đồng bộ Firebase:", err.message);
        });
    };

    window.initApp = function() {
        console.log("⚡ Đang khởi tạo ứng dụng Realtime...");

        // 1. KIỂM TRA DI CƯ DỮ LIỆU (Chỉ chạy một lần nếu Firebase trống)
        db.ref('/').once('value').then((snapshot) => {
            if (!snapshot.exists()) {
                console.log("⚠️ Cloud đang trống, kiểm tra dữ liệu local để di cư...");
                const localDataStr = localStorage.getItem('goat_pos_data');
                const localHistoryStr = localStorage.getItem('goat_order_history');
                const localQR = localStorage.getItem('store_qr_code');

                if (localDataStr) {
                    const data = JSON.parse(localDataStr);
                    tableOrders = data.tableOrders || {};
                    itemSales = data.itemSales || {};
                    menuItems = data.menuItems || [];
                    if (data.stats) stats = data.stats;
                }
                if (localHistoryStr) orderHistory = JSON.parse(localHistoryStr);
                if (localQR) store_qr_code = localQR;

                console.log("📤 Đang tải dữ liệu local lên Cloud...");
                saveAppState();
            }
        });

        // 2. LẮNG NGHE DỮ LIỆU REAL-TIME
        db.ref('/').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                console.log("🔄 Cập nhật Realtime từ Cloud...");
                
                tableOrders = data.tableOrders || {};
                itemSales = data.itemSales || {};
                menuItems = data.menuItems || [
                    { name: 'Nâu Đá', price: 35000 },
                    { name: 'Đen Đá', price: 30000 },
                    { name: 'Bạc Xỉu', price: 40000 },
                    { name: 'Trà Đào Cam Sả', price: 45000 }
                ];
                orderHistory = data.orderHistory || [];
                store_qr_code = data.store_qr_code || null;
                
                if (data.stats) {
                    stats = {
                        totalRevenue: Number(data.stats.totalRevenue) || 0,
                        totalOrders: Number(data.stats.totalOrders) || 0,
                        guestCount: Number(data.stats.guestCount) || 0,
                        cashTotal: Number(data.stats.cashTotal) || 0,
                        transferTotal: Number(data.stats.transferTotal) || 0
                    };
                }

                if (data.printSettings) {
                    printSettings = data.printSettings;
                    syncPrint();
                }

                // Render lại toàn bộ UI
                renderTables();
                renderProducts();
                updateDashboardUI();
                updateTopSelling();
                renderHistory();
                loadQRCode(store_qr_code);
            }
        });

        // 3. Cập nhật ngày tháng header
        updateHeaderDate();

        // 4. PRINT OPTIMIZATION
        window.addEventListener('beforeprint', () => {
            document.body.classList.add('is-printing');
        });
        window.addEventListener('afterprint', () => {
            document.body.classList.remove('is-printing');
        });
    };

    // --- CHART INITIALIZATION ---
    let revenueChart, paymentChart;

    const revCtx = document.getElementById('revenueChart');
    if (revCtx) {
        let realDates = [];
        for (let i = 6; i >= 0; i--) {
            let d = new Date();
            d.setDate(d.getDate() - i);
            realDates.push(d.getDate() + '/' + (d.getMonth() + 1));
        }

        revenueChart = new Chart(revCtx, {
            type: 'bar',
            data: {
                labels: realDates,
                datasets: [{
                    label: 'Doanh thu',
                    data: [0, 0, 0, 0, 0, 0, stats.totalRevenue],
                    backgroundColor: '#0284c7',
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                }
            }
        });
    }

    const payCtx = document.getElementById('paymentChart');
    if (payCtx) {
        paymentChart = new Chart(payCtx, {
            type: 'doughnut',
            data: {
                labels: ['Tiền mặt', 'Chuyển khoản'],
                datasets: [{
                    data: [stats.cashTotal, stats.transferTotal],
                    backgroundColor: ['#10b981', '#3b82f6'],
                    borderWidth: 0,
                    weight: 0.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        display: true,          // BẬT lại chú thích
                        position: 'right',      // Đặt nằm bên PHẢI biểu đồ
                        labels: {
                            boxWidth: 16,       // Thu nhỏ ô vuông màu lại cho tinh tế
                            font: {
                                size: 13        // Cỡ chữ vừa phải cho Mobile
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                let value = context.raw || 0;
                                label += value.toLocaleString('vi-VN') + ' đ';
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    // Menu Items (Removed direct declaration, now in initApp)

    // --- POS MENU MANAGEMENT ---
    let currentCategory = 'Tất cả';
    let searchQuery = '';

    window.filterCategory = function(category) {
        currentCategory = category;
        
        // Update Chips UI
        document.querySelectorAll('.category-chip').forEach(chip => {
            if (chip.innerText === category) chip.classList.add('active');
            else chip.classList.remove('active');
        });

        renderProducts();
    };

    window.filterProducts = function() {
        searchQuery = document.getElementById('pos-search-input').value.toLowerCase().trim();
        renderProducts();
    };

    function renderProducts() {
        const grid = document.getElementById('pos-products-grid');
        if (!grid) return;

        let filtered = menuItems;
        
        // Filter by category
        if (currentCategory !== 'Tất cả') {
            filtered = filtered.filter(item => item.category === currentCategory || !item.category);
        }

        // Filter by search
        if (searchQuery) {
            filtered = filtered.filter(item => item.name.toLowerCase().includes(searchQuery));
        }

        let html = '';
        filtered.forEach(item => {
            html += `
                <div class="product-card" onclick="addToCart('${item.name}', ${item.price})">
                    <div class="product-img-placeholder">
                        <i class="fa-solid fa-mug-hot"></i>
                    </div>
                    <div class="product-info">
                        <h4 class="product-name">${item.name}</h4>
                        <p class="product-price">${item.price.toLocaleString()} đ</p>
                    </div>
                    <button class="btn-add-item">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            `;
        });
        grid.innerHTML = html || '<p style="grid-column: 1/-1; text-align: center; padding: 20px; color: #94a3b8;">Không tìm thấy món nào</p>';
    }

    window.toggleQuickAdd = function() {
        const form = document.getElementById('quick-add-form');
        if (form.style.display === 'none') {
            form.style.display = 'block';
            document.getElementById('qa-name').focus();
        } else {
            form.style.display = 'none';
        }
    };

    window.handleQuickAdd = function() {
        const nameEl = document.getElementById('qa-name');
        const priceEl = document.getElementById('qa-price');
        
        const name = nameEl.value.trim();
        const price = parseInt(priceEl.value);

        if (!name || isNaN(price)) {
            alert('Vui lòng nhập tên và giá món!');
            return;
        }

        // Add to local and sync
        menuItems.push({ name, price, category: currentCategory !== 'Tất cả' ? currentCategory : '' });
        saveAppState();
        renderProducts();
        
        // Reset
        nameEl.value = '';
        priceEl.value = '';
        toggleQuickAdd();
        alert(`Đã thêm "${name}" vào thực đơn!`);
    };

    window.addNewItem = function() {
        const nameInput = document.getElementById('new-item-name');
        const priceInput = document.getElementById('new-item-price');
        
        const name = nameInput.value.trim();
        const price = parseInt(priceInput.value);

        if (!name || isNaN(price)) {
            alert('Vui lòng nhập đầy đủ tên và giá món!');
            return;
        }

        menuItems.push({ name, price });
        saveAppState();
        renderProducts();
        
        // Reset and Close
        nameInput.value = '';
        priceInput.value = '';
        closeAllModals();
        alert(`Đã thêm món "${name}" vào thực đơn!`);
    };

    // --- DASHBOARD SYNC ---
    window.updateDashboardUI = function() {
        const revEl = document.getElementById('stat-revenue');
        const ordEl = document.getElementById('stat-orders');
        const avgEl = document.getElementById('stat-avg');
        const gstEl = document.getElementById('stat-guests');

        if (revEl) revEl.innerText = `${stats.totalRevenue.toLocaleString()} đ`;
        if (ordEl) ordEl.innerText = stats.totalOrders;
        
        if (avgEl) {
            const avg = stats.totalOrders > 0 ? Math.round(stats.totalRevenue / stats.totalOrders) : 0;
            avgEl.innerText = `${avg.toLocaleString()} đ`;
        }
        
        if (gstEl) gstEl.innerText = stats.guestCount;

        // Sync Charts
        if (revenueChart) {
            revenueChart.data.datasets[0].data[6] = stats.totalRevenue;
            revenueChart.update();
        }
        if (paymentChart) {
            paymentChart.data.datasets[0].data = [stats.cashTotal, stats.transferTotal];
            paymentChart.update();
        }
    };

    window.updateTopSelling = function() {
        const container = document.getElementById('top-selling-list');
        if (!container) return;

        // Sort items by sales count
        let sorted = Object.keys(itemSales).map(key => ({
            name: key,
            count: itemSales[key]
        })).sort((a, b) => b.count - a.count).slice(0, 3);

        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="no-data-view">
                    <span class="coffee-icon">☕</span>
                    <p>Chưa có dữ liệu bán chạy</p>
                </div>
            `;
            return;
        }

        const medals = ['🥇', '🥈', '🥉'];
        let html = '';
        sorted.forEach((item, index) => {
            html += `
                <div class="top-selling-item">
                    <div class="item-name-medal">
                        <span>${medals[index]}</span>
                        <span>${item.name}</span>
                    </div>
                    <span class="item-count">${item.count} ly</span>
                </div>
            `;
        });
        container.innerHTML = html;
    };

    // --- POS BUSINESS LOGIC ---
    window.addToCart = function(itemName, price) {
        const existingItem = currentCart.find(item => item.name === itemName);
        if (existingItem) {
            existingItem.qty += 1;
        } else {
            currentCart.push({ name: itemName, price: price, qty: 1 });
        }
        renderCart();
    };

    function renderCart() {
        const cartList = document.getElementById('cart-items-list');
        const bottomCount = document.getElementById('bottom-cart-count');
        const bottomTotal = document.getElementById('bottom-cart-total');
        
        if (!cartList) return;

        if (currentCart.length === 0) {
            cartList.innerHTML = '<p class="empty-cart-msg">Chưa có món nào được chọn</p>';
            bottomCount.innerText = '0 món';
            bottomTotal.innerText = '0 đ';
            return;
        }

        let html = '';
        let totalAmount = 0;
        let totalItems = 0;

        currentCart.forEach((item, index) => {
            const itemTotal = item.price * item.qty;
            totalAmount += itemTotal;
            totalItems += item.qty;
            
            html += `
                <div class="cart-item-row">
                    <div class="cart-item-info">
                        <span class="cart-item-name">${item.name}</span>
                        <div class="qty-controller">
                            <button class="qty-btn dec" onclick="decreaseQuantity(${index})">−</button>
                            <span class="qty-num">${item.qty}</span>
                            <button class="qty-btn inc" onclick="increaseQuantity(${index})">+</button>
                        </div>
                    </div>
                    <span class="cart-item-price">${(itemTotal).toLocaleString()} đ</span>
                </div>
            `;
        });

        cartList.innerHTML = html;
        bottomCount.innerText = `${totalItems} món`;
        bottomTotal.innerText = `${totalAmount.toLocaleString()} đ`;
    }

    window.increaseQuantity = function(index) {
        if (currentCart[index]) {
            currentCart[index].qty += 1;
            renderCart();
        }
    };

    window.decreaseQuantity = function(index) {
        if (currentCart[index]) {
            if (currentCart[index].qty > 1) {
                currentCart[index].qty -= 1;
                renderCart();
            } else {
                if (confirm(`Bạn có muốn xóa món "${currentCart[index].name}" khỏi giỏ hàng không?`)) {
                    currentCart.splice(index, 1);
                    renderCart();
                }
            }
        }
    };

    // Modal & Sheet Helpers
    window.closeAllModals = function() {
        document.getElementById('modal-overlay').style.display = 'none';
        document.querySelectorAll('.bottom-sheet').forEach(s => {
            s.classList.remove('active');
            s.classList.remove('show');
        });
        setTimeout(() => {
            document.querySelectorAll('.bottom-sheet').forEach(s => s.style.display = 'none');
        }, 300);
    };

    function openBottomSheet(id) {
        document.getElementById('modal-overlay').style.display = 'block';
        const sheet = document.getElementById(id);
        if (sheet) {
            sheet.style.display = 'block';
            setTimeout(() => {
                sheet.classList.add('active');
                sheet.classList.add('show');
            }, 10);
        }
    }

    // --- NEW TABLE SELECTOR LOGIC ---
    window.openTableSelector = function() {
        if (currentCart.length === 0) {
            alert("Giỏ hàng đang trống. Vui lòng chọn món trước!");
            return;
        }

        const grid = document.getElementById('select-table-grid');
        if (!grid) return;

        let html = '';
        for (let i = 1; i <= 40; i++) {
            const isOccupied = tableOrders[i] ? 'occupied' : '';
            html += `
                <button class="select-table-btn ${isOccupied}" onclick="confirmSelection(${i})">
                    ${i}
                </button>
            `;
        }
        grid.innerHTML = html;
        openBottomSheet('tableSelectorSheet');
    };

    window.handleSaveOrder = function() {
        if (currentCart.length === 0) {
            alert("Giỏ hàng đang trống!");
            return;
        }

        if (targetTableId !== null) {
            // MERGE MODE: Lập tức gộp vào bàn đã chọn
            confirmSelection(targetTableId);
        } else {
            // NORMAL MODE: Hiện bảng chọn 40 bàn
            openTableSelector();
        }
    };

    window.confirmSelection = function(num) {
        // Check if we are merging
        const isMerging = tableOrders[num] !== undefined;

        const cartTotal = currentCart.reduce((sum, item) => sum + (item.price * item.qty), 0);

        if (isMerging) {
            // Merge into existing order
            const existingOrder = tableOrders[num];
            currentCart.forEach(newItem => {
                const sameItem = existingOrder.items.find(i => i.name === newItem.name);
                if (sameItem) {
                    sameItem.qty += newItem.qty;
                } else {
                    existingOrder.items.push(JSON.parse(JSON.stringify(newItem)));
                }
            });
            existingOrder.total += cartTotal;
        } else {
            // Create New Order
            tableOrders[num] = {
                items: JSON.parse(JSON.stringify(currentCart)),
                total: cartTotal
            };
        }

        // Update UI
        let tableEl = document.getElementById("table-" + num);
        if (tableEl) {
            tableEl.classList.remove("table-empty");
            tableEl.classList.add("table-active");
            tableEl.onclick = function() { viewTableBill(num); };
            
            // Cleanup
            currentCart = [];
            targetTableId = null; 
            document.getElementById('pos-notice-bar').style.display = 'none';
            renderCart();
            closeAllModals();
            
            alert(isMerging ? `Đã thêm món vào Bàn ${num} thành công!` : `Đã lưu đơn vào Bàn ${num} thành công!`);
            saveAppState();
            updateTableStats();
            switchTab('tables-section');
        }
    };

    window.addMoreItems = function() {
        if (selectedTableForBill === null) return;
        targetTableId = selectedTableForBill;
        
        // Show Notice in POS
        document.getElementById('pos-target-table-name').innerText = `Bàn ${targetTableId}`;
        document.getElementById('pos-notice-bar').style.display = 'block';
        
        closeAllModals();
        switchTab('pos-section');
    };

    window.cancelAddMore = function() {
        targetTableId = null;
        document.getElementById('pos-notice-bar').style.display = 'none';
        alert("Đã hủy chế độ thêm món.");
    };

    window.moveTable = function() {
        if (!selectedTableForBill || !tableOrders[selectedTableForBill]) return;
        openTransferTableSelector();
    };

    window.openTransferTableSelector = function() {
        const grid = document.getElementById('transfer-table-grid');
        if (!grid) return;

        let html = '';
        for (let i = 1; i <= 40; i++) {
            const isOccupied = tableOrders[i] ? 'occupied' : '';
            const isCurrent = i === selectedTableForBill ? 'current' : '';
            html += `
                <button class="select-table-btn ${isOccupied} ${isCurrent}" onclick="confirmTransfer(${i})">
                    ${i}
                </button>
            `;
        }
        grid.innerHTML = html;
        openBottomSheet('transferTableSheet');
    };

    window.confirmTransfer = function(newNum) {
        const oldNum = selectedTableForBill;
        if (newNum === oldNum) return;
        if (tableOrders[newNum]) {
            alert(`Bàn ${newNum} đang có khách!`);
            return;
        }

        // Move Data
        tableOrders[newNum] = tableOrders[oldNum];
        delete tableOrders[oldNum];

        // Update UI
        [oldNum, newNum].forEach(num => {
            let el = document.getElementById("table-" + num);
            if (el) {
                if (num === oldNum) {
                    el.classList.remove("table-active");
                    el.classList.add("table-empty");
                    el.onclick = null;
                } else {
                    el.classList.remove("table-empty");
                    el.classList.add("table-active");
                    el.onclick = function() { viewTableBill(newNum); };
                }
            }
        });

        closeAllModals();
        saveAppState();
        updateTableStats();
        alert(`Đã chuyển đơn từ Bàn ${oldNum} sang Bàn ${newNum}.`);
    };

    window.viewTableBill = function(id) {
        const order = tableOrders[id];
        if (!order) return;

        selectedTableForBill = id;
        document.getElementById('bill-sheet-title').innerText = `Chi tiết Bàn ${id}`;
        
        let html = '';
        order.items.forEach(item => {
            html += `
                <div class="cart-item-row">
                    <div class="cart-item-info">
                        <span class="cart-item-name">${item.name}</span>
                        <span class="cart-item-qty">x${item.qty}</span>
                    </div>
                    <span class="cart-item-price">${(item.price * item.qty).toLocaleString()} đ</span>
                </div>
            `;
        });
        document.getElementById('bill-items-list').innerHTML = html;
        document.getElementById('bill-total-amount').innerText = `${order.total.toLocaleString()} đ`;
        
        showBillDetail();
        openBottomSheet('bill-detail-sheet');
    };

    window.showBillDetail = function() {
        const content = document.getElementById('bill-sheet-content');
        const qr = document.getElementById('qr-transfer-view');
        if (content) content.style.display = 'block';
        if (qr) qr.style.display = 'none';
    };

    window.showQRTransfer = function() {
        const content = document.getElementById('bill-sheet-content');
        const qr = document.getElementById('qr-transfer-view');
        if (content) content.style.display = 'none';
        if (qr) qr.style.display = 'block';
    };

    window.payWithCash = function() {
        if (confirm(`Xác nhận thanh toán TIỀN MẶT cho Bàn ${selectedTableForBill}?`)) {
            stats.cashTotal += tableOrders[selectedTableForBill].total;
            finishPayment('Tiền mặt');
        }
    };

    window.confirmPayment = function() {
        if (confirm(`Đã xác nhận nhận đủ tiền CHUYỂN KHOẢN cho Bàn ${selectedTableForBill}?`)) {
            stats.transferTotal += tableOrders[selectedTableForBill].total;
            finishPayment('Chuyển khoản');
        }
    };

    function finishPayment(method = 'Khác') {
        const id = selectedTableForBill;
        const order = tableOrders[id];
        const orderTotal = order.total;

        // Update Item Sales for Top Selling
        order.items.forEach(item => {
            if (!itemSales[item.name]) itemSales[item.name] = 0;
            itemSales[item.name] += item.qty;
        });

        // Update Global Stats
        stats.totalRevenue += orderTotal;
        stats.totalOrders += 1;
        stats.guestCount += 1; 
        
        // Sync Dashboard and Charts
        updateDashboardUI();
        updateTopSelling();

        // Archive Order to History
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + 
                        now.getMinutes().toString().padStart(2, '0') + ' ' + 
                        now.getDate().toString().padStart(2, '0') + '/' + 
                        (now.getMonth() + 1).toString().padStart(2, '0') + '/' + 
                        now.getFullYear();

        const archiveOrder = {
            id: 'ORD-' + Date.now().toString().slice(-6),
            time: timeStr,
            items: JSON.parse(JSON.stringify(order.items)),
            total: orderTotal,
            tableId: id,
            paymentMethod: method
        };
        orderHistory.unshift(archiveOrder);

        delete tableOrders[id];
        
        let tableEl = document.getElementById("table-" + id);
        if (tableEl) {
            tableEl.classList.remove("table-active");
            tableEl.classList.add("table-empty");
            tableEl.onclick = null;
        }

        updateTableStats();
        saveAppState();
        closeAllModals();
        alert('🎉 Thanh toán thành công!\nĐơn hàng đã được lưu vào lịch sử.');
        renderHistory();
    }

    function updateTableStats() {
        const activeCount = Object.keys(tableOrders).length;
        const statsEl = document.getElementById('table-stats');
        if (statsEl) {
            statsEl.innerText = `Tổng: 40 bàn | Đang phục vụ: ${activeCount}`;
        }
    }

    function renderTables() {
        const container = document.getElementById('table-grid-container');
        if (!container) return;

        let html = '';
        for (let i = 1; i <= 40; i++) {
            const hasOrder = tableOrders[i];
            const statusClass = hasOrder ? 'table-active' : 'table-empty';
            const clickAttr = hasOrder ? `onclick="viewTableBill(${i})"` : '';
            html += `<div id="table-${i}" class="table-item ${statusClass}" ${clickAttr}>Bàn ${i}</div>`;
        }
        container.innerHTML = html;
        updateTableStats();
    }

    // Initial Renders
    renderTables();
    renderProducts();
    updateDashboardUI();
    updateTopSelling();

    // --- QR CODE MANAGEMENT ---
    window.handleQRUpload = function(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                store_qr_code = e.target.result;
                saveAppState();
                alert('Đã lưu mã QR thành công!');
            };
            reader.readAsDataURL(input.files[0]);
        }
    };

    window.loadQRCode = function(qrDataFromFirebase) {
        const qrData = qrDataFromFirebase || store_qr_code;
        const previewImg = document.getElementById('qr-preview-img');
        const previewPlaceholder = document.getElementById('qr-preview-placeholder');
        const billQRImg = document.getElementById('bill-qr-code-img');
        const missingMsg = document.getElementById('qr-missing-msg');

        if (qrData) {
            // Update Preview in Menu
            if (previewImg) {
                previewImg.src = qrData;
                previewImg.style.display = 'block';
            }
            if (previewPlaceholder) previewPlaceholder.style.display = 'none';

            // Update Bill QR
            if (billQRImg) {
                billQRImg.src = qrData;
                billQRImg.style.display = 'block';
            }
            if (missingMsg) missingMsg.style.display = 'none';
        } else {
            if (previewImg) previewImg.style.display = 'none';
            if (previewPlaceholder) previewPlaceholder.style.display = 'block';
            
            if (billQRImg) billQRImg.style.display = 'none';
            if (missingMsg) missingMsg.style.display = 'block';
        }
    };

    window.updateHeaderDate = function() {
        const now = new Date();
        const day = now.getDate();
        const month = now.getMonth() + 1; // Tháng trong JS chạy từ 0-11
        const year = now.getFullYear();
        
        const dateString = `${day} Tháng ${month}, ${year}`;
        
        const dateEl = document.getElementById('header-date');
        if (dateEl) {
            dateEl.innerText = dateString;
        }
    };



    // --- CLEAN PRINT CONFIGURATION LOGIC ---
    window.selectPaper = function(size) {
        printSettings.paperSize = size;
        
        // Update UI items
        document.querySelectorAll('.paper-item').forEach(item => {
            if (item.innerText.includes(size)) item.classList.add('active');
            else item.classList.remove('active');
        });

        // Update Visual Preview Box Class
        const box = document.getElementById('bill-preview-box');
        if (box) {
            box.classList.remove('size-58', 'size-80');
            box.classList.add(`size-${size}`);
        }
        
        savePrintSettings();
    };

    window.syncPrint = function() {
        // Sync settings object from DOM
        const headerEl = document.getElementById('p-header');
        const footerEl = document.getElementById('p-footer');
        
        if (headerEl) {
            printSettings.showLogo = document.getElementById('p-show-logo').checked;
            printSettings.showQR = document.getElementById('p-show-qr').checked;
            printSettings.showWiFi = document.getElementById('p-show-wifi').checked;
            printSettings.showTax = document.getElementById('p-show-tax').checked;
            printSettings.showNote = document.getElementById('p-show-note').checked;
            printSettings.headerText = headerEl.value;
            printSettings.footerText = footerEl.value;
        }

        // --- REAL-TIME VISUAL BINDING ---
        const toggleV = (id, show) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', !show);
        };

        toggleV('v-logo', printSettings.showLogo);
        toggleV('v-qr', printSettings.showQR);
        toggleV('v-wifi', printSettings.showWiFi);
        toggleV('v-tax', printSettings.showTax);
        toggleV('v-note', printSettings.showNote);

        const vHeader = document.getElementById('v-header');
        if (vHeader) vHeader.innerText = printSettings.headerText;
        const vFooter = document.getElementById('v-footer');
        if (vFooter) vFooter.innerText = printSettings.footerText;

        saveAppState();
    };

    function togglePreviewElement(id, isShow) {
        const el = document.getElementById(id);
        if (el) {
            if (isShow) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    }

    // --- ORDER HISTORY LOGIC ---
    window.renderHistory = function(filterData = orderHistory) {
        const container = document.getElementById('history-list-container');
        if (!container) return;

        if (filterData.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:#94a3b8; font-size:14px;">Chưa có đơn hàng nào.</p>';
            return;
        }

        let html = '';
        filterData.forEach(order => {
            const methodColor = order.paymentMethod === 'Tiền mặt' ? '#16a34a' : '#0284c7';
            const methodBg = order.paymentMethod === 'Tiền mặt' ? '#dcfce7' : '#e0f2fe';
            
            html += `
                <div class="order-card" onclick="showOrderDetail('${order.id}')">
                    <div class="order-info-left">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="order-id">${order.id} (Bàn ${order.tableId})</span>
                            <span style="font-size:10px; padding:2px 6px; border-radius:4px; background:${methodBg}; color:${methodColor}; font-weight:700;">${order.paymentMethod || 'N/A'}</span>
                        </div>
                        <span class="order-time">${order.time}</span>
                    </div>
                    <span class="order-amount">${order.total.toLocaleString()} đ</span>
                </div>
            `;
        });
        container.innerHTML = html;
    };

    window.filterHistory = function() {
        const query = document.getElementById('history-search').value.toLowerCase();
        const dateFilter = document.getElementById('history-date-filter').value; // YYYY-MM-DD
        const methodFilter = document.getElementById('history-method-filter').value;

        const filtered = orderHistory.filter(o => {
            // 1. Text Search (ID or Table)
            const matchesQuery = o.id.toLowerCase().includes(query) || 
                               o.tableId.toString().includes(query);
            
            // 2. Date Filter
            // o.time format: "HH:mm DD/MM/YYYY"
            let matchesDate = true;
            if (dateFilter) {
                const [d, m, y] = o.time.split(' ')[1].split('/');
                const orderDateFormatted = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                matchesDate = orderDateFormatted === dateFilter;
            }

            // 3. Method Filter
            let matchesMethod = true;
            if (methodFilter !== 'all') {
                matchesMethod = o.paymentMethod === methodFilter;
            }

            return matchesQuery && matchesDate && matchesMethod;
        });
        renderHistory(filtered);
    };

    window.showOrderDetail = function(orderId) {
        const order = orderHistory.find(o => o.id === orderId);
        if (!order) return;

        let itemsHtml = '';
        order.items.forEach(item => {
            itemsHtml += `
                <div class="detail-item">
                    <span>${item.qty} x ${item.name}</span>
                    <span>${(item.price * item.qty).toLocaleString()} đ</span>
                </div>
            `;
        });

        const detailHtml = `
            <div style="margin-bottom:20px;">
                <p style="font-weight:700; color:#1e293b; margin-bottom:5px;">Mã đơn: ${order.id}</p>
                <p style="font-size:13px; color:#64748b;">Thời gian: ${order.time}</p>
                <p style="font-size:13px; color:#64748b;">Phục vụ tại: Bàn ${order.tableId}</p>
            </div>
            <div class="detail-items-list">
                ${itemsHtml}
            </div>
            <div class="detail-total-row">
                <span>TỔNG CỘNG:</span>
                <span>${order.total.toLocaleString()} đ</span>
            </div>
            <div class="detail-meta-row">
                <span>Phương thức:</span>
                <span style="font-weight:700; color:${order.paymentMethod === 'Tiền mặt' ? '#16a34a' : '#0284c7'}">${order.paymentMethod || 'Hoàn tất'}</span>
            </div>
            <div style="margin-top:30px;">
                <button class="btn-outline-test" onclick="alert('Đang in lại hóa đơn...')">
                    <i class="fa-solid fa-print"></i> In lại hóa đơn
                </button>
            </div>
        `;

        document.getElementById('order-detail-content').innerHTML = detailHtml;
        document.getElementById('order-detail-modal').style.display = 'block';
    };

    window.closeOrderModal = function() {
        document.getElementById('order-detail-modal').style.display = 'none';
    };

    window.confirmClearHistory = function() {
        const password = prompt("🔐 Nhập mật khẩu xác nhận để xóa lịch sử:");
        
        if (password === null) return; // User cancelled
        
        if (password === "6666") {
            if (confirm("⚠️ Bạn có chắc chắn muốn xóa TOÀN BỘ lịch sử không?")) {
                orderHistory = [];
                saveAppState();
                renderHistory();
                alert("✅ Đã xóa sạch lịch sử đơn hàng.");
            }
        } else {
            alert("❌ Sai mật khẩu! Không thể thực hiện thao tác này.");
        }
    };
    
    window.resetRevenueData = function() {
        if (confirm("Bạn có chắc chắn muốn xóa toàn bộ dữ liệu doanh thu không? Thao tác này không thể hoàn tác.")) {
            // Reset stats
            stats = {
                totalRevenue: 0,
                totalOrders: 0,
                guestCount: 0,
                cashTotal: 0,
                transferTotal: 0
            };
            
            // Reset item sales
            itemSales = {};
            
            // Clear history
            orderHistory = [];
            
            // Save state (this updates both LocalStorage and Firebase)
            saveAppState();
            
            // Update UI
            updateDashboardUI();
            updateTopSelling();
            renderHistory();
            
            alert("✅ Đã xóa toàn bộ dữ liệu doanh thu và lịch sử!");
        }
    };


    window.testPrint = function() {
        console.log("In thử hóa đơn:", printSettings.paperSize + "mm");
        window.print();
    };

    // Start App
    initApp();
});

// --- SHAKE ANIMATION CSS ---
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes shake {
    0% { transform: translateX(0); }
    25% { transform: translateX(-8px); }
    50% { transform: translateX(8px); }
    75% { transform: translateX(-8px); }
    100% { transform: translateX(0); }
}
`;
document.head.appendChild(styleSheet);

// --- GLOBAL NAVIGATION LOGIC ---
function switchTab(tabId) {
    // 1. Lấy tất cả các thẻ section (màn hình) bao gồm cả các phân hệ cấu hình
    const sections = [
        'dashboard-section', 
        'pos-section', 
        'tables-section', 
        'menu-section', 
        'print-config-section', 
        'payment-config-section',
        'order-history-section',
        'shift-management-section'
    ];
    
    // 2. Ẩn tất cả đi
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('d-none');
            el.style.display = 'none'; 
        }
    });

    // 3. Hiện đúng tab được yêu cầu
    const targetEl = document.getElementById(tabId);
    if (targetEl) {
        targetEl.classList.remove('d-none');
        targetEl.style.display = 'block'; 
        
        // Cập nhật dữ liệu nếu là trang Lịch sử
        if (tabId === 'order-history-section') {
            renderHistory();
        }
    }

    // 4. Cập nhật màu nút Active ở thanh Bottom Navigation
    const navItems = document.querySelectorAll('.bottom-nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    // Tìm nút tương ứng với tabId hoặc tab gốc (nếu là sub-page của Menu)
    let searchId = tabId;
    if (tabId === 'print-config-section' || tabId === 'payment-config-section' || tabId === 'order-history-section' || tabId === 'shift-management-section') {
        searchId = 'menu-section';
    }

    const activeBtn = document.querySelector(`.bottom-nav-item[onclick*="${searchId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

window.openShiftManagement = function() {
    switchTab('shift-management-section');
    
    const modal = document.getElementById('update-modal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.querySelector('.update-popup').style.transform = 'scale(1)';
        }, 50);
    }
};

window.closeUpdateModal = function() {
    const modal = document.getElementById('update-modal');
    if (modal) {
        modal.querySelector('.update-popup').style.transform = 'scale(0.9)';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 200);
    }
};

// Menu Action Logic
document.addEventListener('DOMContentLoaded', () => {
    // Xóa bỏ hoặc tinh chỉnh listener để không hiện alert đè lên logic chuyển trang
    const actionMenuItems = document.querySelectorAll('.menu-item');
    actionMenuItems.forEach(item => {
        item.addEventListener('click', () => {
            // Logic chuyển trang đã được xử lý qua thuộc tính onclick="switchTab(...)"
            // Chỉ log ra console để debug nếu cần
            console.log("Navigating to:", item.querySelector('.menu-label').innerText);
        });
    });

    // Notification button
    const notifBtn = document.getElementById('notif-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            alert('Thông báo: Hệ thống Tiệm GOAT POS đã sẵn sàng.');
        });
    }
});
