document.addEventListener('DOMContentLoaded', () => {
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

    window.saveAppState = function() {
        localStorage.setItem('goat_table_orders', JSON.stringify(tableOrders));
        localStorage.setItem('goat_item_sales', JSON.stringify(itemSales));
        localStorage.setItem('goat_stats', JSON.stringify(stats));
        localStorage.setItem('goat_menu_items', JSON.stringify(menuItems));
        console.log("🚀 Dữ liệu đã được khóa vào bộ nhớ!");
    };

    window.initApp = function() {
        // 1. Load Tables & Orders
        tableOrders = JSON.parse(localStorage.getItem('goat_table_orders')) || {};
        
        // 2. Load Item Sales
        itemSales = JSON.parse(localStorage.getItem('goat_item_sales')) || {};

        // 3. Load Stats (Fixing numeric types)
        const savedStats = JSON.parse(localStorage.getItem('goat_stats'));
        if (savedStats) {
            stats.totalRevenue = Number(savedStats.totalRevenue) || 0;
            stats.totalOrders = Number(savedStats.totalOrders) || 0;
            stats.guestCount = Number(savedStats.guestCount) || 0;
            stats.cashTotal = Number(savedStats.cashTotal) || 0;
            stats.transferTotal = Number(savedStats.transferTotal) || 0;
        }

        // 4. Load Menu
        menuItems = JSON.parse(localStorage.getItem('goat_menu_items')) || [
            { name: 'Nâu Đá', price: 35000 },
            { name: 'Đen Đá', price: 30000 },
            { name: 'Bạc Xỉu', price: 40000 },
            { name: 'Trà Đào Cam Sả', price: 45000 }
        ];

        // 5. Check Login Session
        const savedRole = localStorage.getItem('goat_user_role');
        if (savedRole) {
            document.getElementById('login-screen').style.display = 'none';
            applyRoleSettings(savedRole);
        } else {
            document.getElementById('login-screen').style.display = 'flex';
            const loginInput = document.getElementById('login-input');
            if (loginInput) setTimeout(() => loginInput.focus(), 500);
        }

        // 6. Initial Renders
        renderTables();
        renderProducts();
        updateDashboardUI();
        updateTopSelling();
        loadQRCode();
        updateHeaderDate();
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
    function renderProducts() {
        const grid = document.getElementById('pos-products-grid');
        if (!grid) return;

        let html = '';
        menuItems.forEach(item => {
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
        grid.innerHTML = html;
    }

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

        if (sorted.length === 0) return;

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
            finishPayment();
        }
    };

    window.confirmPayment = function() {
        if (confirm(`Đã xác nhận nhận đủ tiền CHUYỂN KHOẢN cho Bàn ${selectedTableForBill}?`)) {
            stats.transferTotal += tableOrders[selectedTableForBill].total;
            finishPayment();
        }
    };

    function finishPayment() {
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
        alert('🎉 Thanh toán thành công!\nDữ liệu đã được khóa vào bộ nhớ.');
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
                const base64Image = e.target.result;
                localStorage.setItem('store_qr_code', base64Image);
                saveAppState();
                loadQRCode();
                alert('Đã lưu mã QR thành công!');
            };
            reader.readAsDataURL(input.files[0]);
        }
    };

    window.loadQRCode = function() {
        const qrData = localStorage.getItem('store_qr_code');
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

    // --- LOGIN & SECURITY LOGIC ---
    window.handleLogin = function() {
        const passInput = document.getElementById('login-input');
        if (!passInput) return;

        const pin = passInput.value.trim();
        let role = null;

        if (pin === '1111' || pin === 'goat1111') role = 'admin';
        else if (pin === '2222' || pin === 'goat2222') role = 'cashier';

        if (role) {
            localStorage.setItem('goat_user_role', role);
            saveAppState();
            applyRoleSettings(role);
            document.getElementById('login-screen').style.display = 'none';
            passInput.value = "";
            passInput.style.borderColor = "#e2e8f0";
        } else {
            // Error feedback
            passInput.style.borderColor = "#ef4444";
            passInput.style.animation = 'shake 0.4s';
            setTimeout(() => {
                passInput.style.animation = '';
            }, 400);
            
            alert("Mật khẩu không đúng. Vui lòng thử lại!");
            passInput.value = "";
            passInput.focus();
        }
    };

    window.logout = function() {
        if (confirm("Bạn có muốn đăng xuất không?")) {
            localStorage.removeItem('goat_user_role');
            location.reload(); 
        }
    };

    function applyRoleSettings(role) {
        const menuNav = document.getElementById('nav-menu');
        if (role === 'cashier') {
            if (menuNav) menuNav.style.display = 'none';
            if (document.getElementById('menu-section').style.display !== 'none') {
                switchTab('dashboard-section');
            }
        } else {
            if (menuNav) menuNav.style.display = 'flex';
        }
    }

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
    // 1. Lấy tất cả các thẻ section (màn hình)
    const sections = ['dashboard-section', 'pos-section', 'tables-section', 'menu-section'];
    
    // 2. Ẩn tất cả đi (thêm class d-none)
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('d-none');
            el.style.display = 'none'; // Ép ẩn cứng
        }
    });

    // 3. Hiện đúng tab được yêu cầu
    const targetEl = document.getElementById(tabId);
    if (targetEl) {
        targetEl.classList.remove('d-none');
        targetEl.style.display = 'block'; 
    }

    // 4. Cập nhật màu nút Active ở thanh Bottom Navigation
    const navItems = document.querySelectorAll('.bottom-nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    // Tìm nút vừa bấm dựa vào thuộc tính onclick và set active
    const activeBtn = document.querySelector(`.bottom-nav-item[onclick*="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

// Menu Action Logic
document.addEventListener('DOMContentLoaded', () => {
    const actionMenuItems = document.querySelectorAll('.menu-item');
    actionMenuItems.forEach(item => {
        item.addEventListener('click', () => {
            const label = item.querySelector('.menu-label').innerText;
            alert(`Mở tính năng: ${label}`);
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
