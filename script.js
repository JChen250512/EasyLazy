// --- JavaScript 邏輯區 ---

// 全域變數：Google Apps Script 網址
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzHV8KLPw390a8MIgQg1YTTt-g5B_ughmXB86jajc32dcBjmkaQ0p7vQ8qA99mPtPNY/exec'; 

// 全域變數：用於儲存所有預約資料，避免重複向 Google 請求
let allBookedRecords = [];

// 1. 服務時間對照表
const SERVICE_DETAILS = {
    'single_custom': { text: '日式單根嫁接-客製款', time: 1 } 
};

// 2. 輔助函式：時間轉分鐘數（保留）
function timeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const [hour, minute] = timeStr.split(':').map(Number);
    return hour * 60 + minute;
}

// 3. 更新服務資訊
function updateServiceInfo() {
    // 移除不必要的 onchange="generateTimeSlots()" 判斷
    generateTimeSlots();
}

// Modal 控制輔助函式 
function showLoadingModal() {
    const modal = document.getElementById('loadingModal');
    if(modal) modal.style.display = 'flex';
}

function hideLoadingModal() {
    const modal = document.getElementById('loadingModal');
    if(modal) modal.style.display = 'none';
}

// 4. 從 Google Sheet 讀取所有預約資料 (現在只會在載入時被呼叫一次) 
async function prefetchAllBookedAppointments() {
    console.log('--- 開始預加載所有預約資料 ---');
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'GET' });
        if (!response.ok) throw new Error(response.statusText);

        const data = await response.json();
        allBookedRecords = data.records || []; // 將所有資料儲存到全域變數
        console.log(`成功載入 ${allBookedRecords.length} 筆預約記錄。`);
    } catch (err) {
        console.error('❌ 預加載預約資料失敗:', err);
        allBookedRecords = []; 
        alert('❌ 無法讀取預約資料，請檢查網路連線或 Apps Script 部署。');
        // 如果預加載失敗，強制保持 Modal 顯示，或至少禁用表單
        showLoadingModal();
    }
}


// 5. 生成時段按鈕 (從全域變數讀取資料)
async function generateTimeSlots() {
    const container = document.getElementById('timeSlotsContainer');
    const dateInput = document.getElementById('date');
    const selectedDateStr = dateInput.value;
    
    container.innerHTML = '';

    if (!selectedDateStr) {
        container.innerHTML = '<div style="grid-column:1/-1;color:#888;text-align:center;">請選擇日期</div>';
        return;
    }

    // 處理日期物件
    const parts = selectedDateStr.split('-');
    const selectedDate = new Date(parts[0], parts[1]-1, parts[2]);

    // 判斷平日/假日
    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday
    let fixedSlots = [];
    if (dayOfWeek >= 1 && dayOfWeek <= 5) fixedSlots = ['19:00'];
    else if (dayOfWeek === 0 || dayOfWeek === 6) fixedSlots = ['10:00','13:30'];
    else {
        container.innerHTML = '<div style="grid-column:1/-1;color:#888;text-align:center;">該日期不開放預約</div>';
        return;
    }

    // 從全域變數中，篩選出當日已預約資料
    const bookedAppointments = allBookedRecords.filter(app => 
        app['預約日期']?.trim() === selectedDateStr
    );
    
    const bookedTimes = bookedAppointments.map(app => app['預約時段']);
    const now = new Date();
    let availableCount = 0;

    for (const timeLabel of fixedSlots) {
        const [hour, minute] = timeLabel.split(':').map(Number);
        // 設定時區時間，避免時區轉換問題
        const slotDateTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hour, minute, 0); 

        let isDisabled = slotDateTime <= now;
        let disabledReason = isDisabled ? '此時段已過' : (bookedTimes.includes(timeLabel) ? '時段已被預約' : '');

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'time-btn';
        btn.innerText = timeLabel;
        if (isDisabled || disabledReason) {
            btn.disabled = true;
            btn.title = disabledReason;
        } else {
            btn.onclick = () => selectTime(btn, timeLabel);
            availableCount++;
        }
        container.appendChild(btn);
    }

    if (availableCount === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;color:#888;text-align:center;">本日已無空檔，請選擇其他日期</div>';
    }
}

// 6. 選擇時段 (不變)
function selectTime(btn, time) {
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('selectedTime').value = time;
}

// 7. 送出表單 (修復日期重置邏輯，並確保重新預加載)
document.getElementById('bookingForm').addEventListener('submit', function(e) {
    e.preventDefault(); 

    const submitBtn = document.querySelector('.submit-btn');
    
    // 獲取所有資料 (現在 HTML 已經有這些欄位了)
    const serviceElement = document.getElementById('service');
    const service = serviceElement.options[serviceElement.selectedIndex].text;
    const staff = document.getElementById('staff').options[document.getElementById('staff').selectedIndex].text;
    const date = document.getElementById('date').value;
    const time = document.getElementById('selectedTime').value;
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value.trim();
    const historySelect = document.getElementById('history');
    const history = historySelect.options[historySelect.selectedIndex].text;

    const nickname = document.getElementById('nickname') ? document.getElementById('nickname').value : '';
    
    // 檢查與驗證
    if (nickname.length > 0) { alert("提交失敗。"); return; }
    if (!time) { alert('請選擇預約時段！'); return; }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) { alert('請輸入有效的電子郵件地址！'); return; }

    // 鎖定按鈕
    submitBtn.disabled = true;
    submitBtn.innerText = "預約傳送中...";

    const formData = {
        service: service, staff: staff, date: date, time: time, name: name, phone: phone,
        email: email, history: history
    };

    // 發送資料 (使用全域變數 GOOGLE_SCRIPT_URL)
    fetch(GOOGLE_SCRIPT_URL, { 
        method: 'POST',
        body: JSON.stringify(formData),
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' }
    })
    .then(async () => {
        alert(`✅ 預約成功！\n\n感謝 ${name} 的預約\n確認信已發出。`);
        
        // 成功後必須重新抓取資料，確保最新的預約被記錄
        await prefetchAllBookedAppointments(); 

        // 手動清空欄位
        document.getElementById('name').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('email').value = '';
        document.getElementById('history').selectedIndex = 0;
        
        // 重設日期邏輯 (修復錯誤的日期重置)
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const realTodayStr = `${yyyy}-${mm}-${dd}`; // 今天的日期
        
        const limitDateStr = "2025-12-19"; // 限制日期

        // 判斷是否使用限制日期
        let effectiveDate = realTodayStr;
        if (realTodayStr < limitDateStr) {
            effectiveDate = limitDateStr;
        }
        
        const dateInput = document.getElementById('date');
        dateInput.min = effectiveDate;
        dateInput.value = effectiveDate; // 設置值與 min 一致，避免手機版驗證錯誤

        document.getElementById('timeSlotsContainer').innerHTML = '<div style="grid-column: 1/-1; color: #888; text-align: center;">請先選擇日期</div>';
        submitBtn.disabled = false;
        submitBtn.innerText = "確認預約";
        
        // 重新觸發時段更新
        updateServiceInfo();
    })
    .catch(error => {
        console.error('Error!', error.message);
        alert('❌ 系統忙碌中，請稍後再試。');
        submitBtn.disabled = false;
        submitBtn.innerText = "確認預約";
    });
});

// 8. 初始化設定：使用 Modal 顯示載入中
window.addEventListener('load', async function() {
    const dateInput = document.getElementById('date');
    
    // 1. 顯示 Loading Modal (鎖定畫面)
    showLoadingModal();
    dateInput.disabled = true; 
    
    // 2. 開始預加載資料
    await prefetchAllBookedAppointments(); 

    // 3. 隱藏 Loading Modal (解鎖畫面)
    hideLoadingModal();
    dateInput.disabled = false; 
    
    // 4. 設定日期輸入欄位 (確保日期正確初始化)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const realTodayStr = `${yyyy}-${mm}-${dd}`;
    
    const limitDateStr = "2025-12-19";
    
    let effectiveDate = realTodayStr;
    if (realTodayStr < limitDateStr) {
        effectiveDate = limitDateStr;
    }

    dateInput.min = effectiveDate;
    dateInput.value = effectiveDate;
    
    // 5. 觸發更新：顯示時段
    updateServiceInfo();
});
